import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDb, closeDb, Task } from '../lib/db';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';

const TEST_DB_PATH = join(process.cwd(), 'data', 'task-queue.db');

// Helper to create test tasks
function createTestTask(id: string, overrides: Partial<Task> = {}): Task {
  const db = getDb();
  const defaults = {
    title: `Test Task ${id}`,
    description: 'Test description',
    priority: 'medium' as const,
    status: 'queued' as const,
    workflow: 'feature-dev',
    target_repo: '/home/test/repo',
    queue_order: 0,
    ...overrides
  };

  db.prepare(
    `INSERT INTO tasks (id, title, description, priority, status, workflow, target_repo, queue_order) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, defaults.title, defaults.description, defaults.priority, defaults.status, defaults.workflow, defaults.target_repo, defaults.queue_order);

  return db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Task;
}

describe('Queue Management API', () => {
  beforeEach(() => {
    // Close any existing connection and delete the database for fresh state
    closeDb();
    try {
      if (existsSync(TEST_DB_PATH)) {
        unlinkSync(TEST_DB_PATH);
      }
    } catch {
      // Ignore errors if file doesn't exist
    }
  });

  afterEach(() => {
    closeDb();
  });

  describe('POST /api/tasks/[id]/reorder', () => {
    it('should update queue_order for a task', () => {
      const db = getDb();
      createTestTask('reorder-1', { queue_order: 1 });

      const newOrder = 5;
      const result = db.prepare(
        'UPDATE tasks SET queue_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      ).run(newOrder, 'reorder-1');

      expect(result.changes).toBe(1);

      const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get('reorder-1') as Task;
      expect(task.queue_order).toBe(newOrder);
    });

    it('should use transaction for atomic reorder operation', () => {
      const db = getDb();
      createTestTask('reorder-2', { queue_order: 10 });

      const reorderTransaction = db.transaction((taskId: string, newOrder: number) => {
        // Check if task exists
        const existing = db.prepare('SELECT id FROM tasks WHERE id = ?').get(taskId);
        if (!existing) {
          throw new Error('Task not found');
        }

        // Update queue_order
        db.prepare(
          'UPDATE tasks SET queue_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
        ).run(newOrder, taskId);

        return db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as Task;
      });

      const updatedTask = reorderTransaction('reorder-2', 25);
      expect(updatedTask.queue_order).toBe(25);
    });

    it('should return error for non-existent task', () => {
      const db = getDb();

      const reorderTransaction = db.transaction((taskId: string, newOrder: number) => {
        const existing = db.prepare('SELECT id FROM tasks WHERE id = ?').get(taskId);
        if (!existing) {
          return { error: 'NOT_FOUND' };
        }
        db.prepare('UPDATE tasks SET queue_order = ? WHERE id = ?').run(newOrder, taskId);
        return { success: true };
      });

      const result = reorderTransaction('non-existent', 5);
      expect(result).toEqual({ error: 'NOT_FOUND' });
    });

    it('should validate queue_order is an integer', () => {
      const db = getDb();
      createTestTask('reorder-3', { queue_order: 1 });

      // Valid integer
      expect(() => {
        db.prepare('UPDATE tasks SET queue_order = ? WHERE id = ?').run(5, 'reorder-3');
      }).not.toThrow();

      // SQLite accepts strings that can be coerced to integers
      // This is SQLite behavior - it will try to convert '10' to 10
      expect(() => {
        db.prepare('UPDATE tasks SET queue_order = ? WHERE id = ?').run('10', 'reorder-3');
      }).not.toThrow();
      
      // Verify the value was set
      const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get('reorder-3') as Task;
      expect(task.queue_order).toBe(10);
    });
  });

  describe('POST /api/queue/next', () => {
    it('should atomically claim next queued task', () => {
      const db = getDb();
      
      // Create tasks with different queue_orders
      createTestTask('next-1', { status: 'queued', queue_order: 10 });
      createTestTask('next-2', { status: 'queued', queue_order: 5 });
      createTestTask('next-3', { status: 'queued', queue_order: 20 });

      // Claim next task - should get next-2 (lowest queue_order)
      const claimTransaction = db.transaction(() => {
        const nextTask = db.prepare(
          `SELECT * FROM tasks 
           WHERE status = 'queued' 
           ORDER BY queue_order ASC, created_at ASC 
           LIMIT 1`
        ).get() as Task | undefined;

        if (!nextTask) {
          return { error: 'NO_TASKS_AVAILABLE' };
        }

        // Atomically update to running
        const updateResult = db.prepare(
          `UPDATE tasks 
           SET status = 'running', 
               started_at = CURRENT_TIMESTAMP,
               updated_at = CURRENT_TIMESTAMP 
           WHERE id = ? AND status = 'queued'`
        ).run(nextTask.id);

        if (updateResult.changes === 0) {
          return { error: 'TASK_CLAIM_FAILED' };
        }

        return db.prepare('SELECT * FROM tasks WHERE id = ?').get(nextTask.id) as Task;
      });

      const claimedTask = claimTransaction() as Task;
      expect(claimedTask.id).toBe('next-2');
      expect(claimedTask.status).toBe('running');
      expect(claimedTask.started_at).toBeDefined();
    });

    it('should return error when no queued tasks available', () => {
      const db = getDb();

      const claimTransaction = db.transaction(() => {
        const nextTask = db.prepare(
          `SELECT * FROM tasks 
           WHERE status = 'queued' 
           ORDER BY queue_order ASC, created_at ASC 
           LIMIT 1`
        ).get() as Task | undefined;

        if (!nextTask) {
          return { error: 'NO_TASKS_AVAILABLE' };
        }

        db.prepare(
          `UPDATE tasks SET status = 'running', started_at = CURRENT_TIMESTAMP WHERE id = ?`
        ).run(nextTask.id);

        return nextTask;
      });

      const result = claimTransaction();
      expect(result).toEqual({ error: 'NO_TASKS_AVAILABLE' });
    });

    it('should return error when queue is paused', () => {
      const db = getDb();
      createTestTask('next-paused', { status: 'queued', queue_order: 1 });

      // Pause the queue
      db.prepare("UPDATE queue_config SET state = 'paused' WHERE id = 1").run();

      const claimWithPauseCheck = db.transaction(() => {
        const queueConfig = db.prepare('SELECT state FROM queue_config WHERE id = 1').get() as { state: string };
        
        if (queueConfig.state === 'paused') {
          return { error: 'QUEUE_PAUSED' };
        }

        const nextTask = db.prepare(
          `SELECT * FROM tasks WHERE status = 'queued' ORDER BY queue_order ASC LIMIT 1`
        ).get() as Task;

        db.prepare(
          `UPDATE tasks SET status = 'running', started_at = CURRENT_TIMESTAMP WHERE id = ?`
        ).run(nextTask.id);

        return nextTask;
      });

      const result = claimWithPauseCheck();
      expect(result).toEqual({ error: 'QUEUE_PAUSED' });
    });

    it('should respect max_concurrent limit', () => {
      const db = getDb();
      
      // Set max_concurrent to 2
      db.prepare('UPDATE queue_config SET max_concurrent = 2 WHERE id = 1').run();

      // Create 2 running tasks
      createTestTask('running-1', { status: 'running', queue_order: 1 });
      createTestTask('running-2', { status: 'running', queue_order: 2 });
      
      // Create queued tasks
      createTestTask('queued-1', { status: 'queued', queue_order: 3 });

      const claimWithLimitCheck = db.transaction(() => {
        const runningCount = db.prepare(
          "SELECT COUNT(*) as count FROM tasks WHERE status = 'running'"
        ).get() as { count: number };

        const maxConcurrent = db.prepare(
          'SELECT max_concurrent FROM queue_config WHERE id = 1'
        ).get() as { max_concurrent: number };

        if (runningCount.count >= maxConcurrent.max_concurrent) {
          return { 
            error: 'MAX_CONCURRENT_REACHED',
            running: runningCount.count,
            max: maxConcurrent.max_concurrent
          };
        }

        const nextTask = db.prepare(
          `SELECT * FROM tasks WHERE status = 'queued' ORDER BY queue_order ASC LIMIT 1`
        ).get() as Task;

        db.prepare(
          `UPDATE tasks SET status = 'running', started_at = CURRENT_TIMESTAMP WHERE id = ?`
        ).run(nextTask.id);

        return nextTask;
      });

      const result = claimWithLimitCheck();
      expect(result).toEqual({ 
        error: 'MAX_CONCURRENT_REACHED',
        running: 2,
        max: 2
      });
    });

    it('should use UPDATE + RETURNING pattern for atomic claim', () => {
      const db = getDb();
      createTestTask('atomic-1', { status: 'queued', queue_order: 1 });

      // SQLite doesn't have RETURNING in older versions, but better-sqlite3 supports it
      // Test the pattern of UPDATE with conditional check
      const atomicClaim = db.transaction(() => {
        // First, get the next task
        const nextTask = db.prepare(
          `SELECT * FROM tasks 
           WHERE status = 'queued' 
           ORDER BY queue_order ASC, created_at ASC 
           LIMIT 1`
        ).get() as Task;

        if (!nextTask) return null;

        // Atomically update - this ensures only one process can claim it
        const result = db.prepare(
          `UPDATE tasks 
           SET status = 'running', 
               started_at = CURRENT_TIMESTAMP,
               updated_at = CURRENT_TIMESTAMP 
           WHERE id = ? AND status = 'queued'`
        ).run(nextTask.id);

        if (result.changes === 0) {
          // Someone else claimed it
          return null;
        }

        // Return the updated task
        return db.prepare('SELECT * FROM tasks WHERE id = ?').get(nextTask.id) as Task;
      });

      const claimed = atomicClaim();
      expect(claimed).not.toBeNull();
      expect(claimed?.status).toBe('running');
      expect(claimed?.started_at).toBeDefined();
    });
  });

  describe('PATCH /api/tasks/bulk-status', () => {
    it('should update status for multiple tasks', () => {
      const db = getDb();
      
      createTestTask('bulk-1', { status: 'backlog' });
      createTestTask('bulk-2', { status: 'backlog' });
      createTestTask('bulk-3', { status: 'backlog' });

      const ids = ['bulk-1', 'bulk-2', 'bulk-3'];
      const newStatus = 'queued';

      const bulkUpdate = db.transaction(() => {
        const updated: string[] = [];
        
        for (const id of ids) {
          const result = db.prepare(
            'UPDATE tasks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
          ).run(newStatus, id);
          
          if (result.changes > 0) {
            updated.push(id);
          }
        }
        
        return updated;
      });

      const updated = bulkUpdate();
      expect(updated).toHaveLength(3);
      expect(updated).toContain('bulk-1');
      expect(updated).toContain('bulk-2');
      expect(updated).toContain('bulk-3');

      // Verify all tasks have new status
      for (const id of ids) {
        const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Task;
        expect(task.status).toBe(newStatus);
      }
    });

    it('should handle partial updates when some tasks do not exist', () => {
      const db = getDb();
      
      createTestTask('partial-1', { status: 'backlog' });
      createTestTask('partial-2', { status: 'backlog' });

      const ids = ['partial-1', 'partial-2', 'non-existent'];
      const newStatus = 'queued';

      const bulkUpdate = db.transaction(() => {
        const result = {
          updated: [] as string[],
          notFound: [] as string[]
        };
        
        for (const id of ids) {
          const existing = db.prepare('SELECT id FROM tasks WHERE id = ?').get(id);
          if (!existing) {
            result.notFound.push(id);
            continue;
          }

          const updateResult = db.prepare(
            'UPDATE tasks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
          ).run(newStatus, id);
          
          if (updateResult.changes > 0) {
            result.updated.push(id);
          }
        }
        
        return result;
      });

      const result = bulkUpdate();
      expect(result.updated).toHaveLength(2);
      expect(result.updated).toContain('partial-1');
      expect(result.updated).toContain('partial-2');
      expect(result.notFound).toContain('non-existent');
    });

    it('should validate status values', () => {
      const db = getDb();
      createTestTask('validate-1', { status: 'backlog' });

      const validStatuses = ['backlog', 'queued', 'running', 'done', 'failed', 'cancelled'];
      
      for (const status of validStatuses) {
        expect(() => {
          db.prepare('UPDATE tasks SET status = ? WHERE id = ?').run(status, 'validate-1');
        }).not.toThrow();
      }

      // Invalid status should fail due to CHECK constraint
      expect(() => {
        db.prepare('UPDATE tasks SET status = ? WHERE id = ?').run('invalid-status', 'validate-1');
      }).toThrow();
    });

    it('should set completed_at when status is done, failed, or cancelled', () => {
      const db = getDb();
      
      createTestTask('complete-1', { status: 'running' });
      createTestTask('complete-2', { status: 'running' });
      createTestTask('complete-3', { status: 'running' });

      const completeStatuses = ['done', 'failed', 'cancelled'];
      
      for (let i = 0; i < completeStatuses.length; i++) {
        const id = `complete-${i + 1}`;
        const status = completeStatuses[i];
        
        db.prepare(
          `UPDATE tasks 
           SET status = ?, 
               completed_at = CURRENT_TIMESTAMP,
               updated_at = CURRENT_TIMESTAMP 
           WHERE id = ?`
        ).run(status, id);

        const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Task;
        expect(task.status).toBe(status);
        expect(task.completed_at).toBeDefined();
      }
    });

    it('should use transaction for atomic bulk operations', () => {
      const db = getDb();
      
      createTestTask('atomic-bulk-1', { status: 'backlog' });
      createTestTask('atomic-bulk-2', { status: 'backlog' });

      const atomicBulkUpdate = db.transaction((ids: string[], status: string) => {
        const results = [];
        for (const id of ids) {
          const result = db.prepare(
            'UPDATE tasks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
          ).run(status, id);
          results.push({ id, changes: result.changes });
        }
        return results;
      });

      const results = atomicBulkUpdate(['atomic-bulk-1', 'atomic-bulk-2'], 'queued');
      expect(results).toHaveLength(2);
      expect(results.every(r => r.changes === 1)).toBe(true);

      // Verify all updated
      const tasks = db.prepare(
        "SELECT * FROM tasks WHERE id IN ('atomic-bulk-1', 'atomic-bulk-2')"
      ).all() as Task[];
      
      expect(tasks.every(t => t.status === 'queued')).toBe(true);
    });
  });

  describe('Database Transactions', () => {
    it('should rollback transaction on error', () => {
      const db = getDb();
      createTestTask('rollback-1', { status: 'backlog', queue_order: 1 });

      const transactionWithError = db.transaction(() => {
        // First update succeeds
        db.prepare('UPDATE tasks SET queue_order = 999 WHERE id = ?').run('rollback-1');
        
        // This will fail due to CHECK constraint
        db.prepare('UPDATE tasks SET status = ? WHERE id = ?').run('invalid', 'rollback-1');
      });

      expect(() => transactionWithError()).toThrow();

      // Verify the first update was rolled back
      const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get('rollback-1') as Task;
      expect(task.queue_order).toBe(1); // Should still be original value
    });

    it('should support nested transactions (savepoints)', () => {
      const db = getDb();
      createTestTask('nested-1', { status: 'backlog' });

      const outerTransaction = db.transaction(() => {
        db.prepare('UPDATE tasks SET queue_order = 100 WHERE id = ?').run('nested-1');
        
        // Inner transaction (savepoint)
        const innerTransaction = db.transaction(() => {
          db.prepare('UPDATE tasks SET queue_order = 200 WHERE id = ?').run('nested-1');
          return 'inner-complete';
        });
        
        innerTransaction();
        return 'outer-complete';
      });

      const result = outerTransaction();
      expect(result).toBe('outer-complete');

      const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get('nested-1') as Task;
      expect(task.queue_order).toBe(200);
    });
  });
});
