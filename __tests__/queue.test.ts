import { describe, it, beforeEach, afterEach } from 'vitest';
import { expect } from 'vitest';
import { getDb, closeDb, Task, getQueueStatus, setQueuePaused, reorderTasks, getNextQueuedTask } from '../lib/db';
import { v4 as uuidv4 } from 'uuid';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';

const TEST_DB_PATH = join(process.cwd(), 'data', 'task-queue.db');

// Helper to create a task
function createTask(data: {
  title: string;
  description?: string;
  priority?: string;
  status?: string;
  workflow?: string;
  target_repo?: string;
  queue_order?: number;
}): Task {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();

  const task: Task = {
    id,
    title: data.title,
    description: data.description ?? null,
    priority: (data.priority as Task['priority']) ?? 'medium',
    status: (data.status as Task['status']) ?? 'backlog',
    workflow: data.workflow ?? 'feature-dev',
    target_repo: data.target_repo ?? null,
    scheduled_at: null,
    started_at: null,
    completed_at: null,
    antfarm_run_id: null,
    queue_order: data.queue_order ?? 0,
    created_at: now,
    updated_at: now
  };

  db.prepare(`
    INSERT INTO tasks (
      id, title, description, priority, status, workflow, target_repo,
      scheduled_at, started_at, completed_at, antfarm_run_id, queue_order,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    task.id, task.title, task.description, task.priority, task.status,
    task.workflow, task.target_repo, task.scheduled_at, task.started_at,
    task.completed_at, task.antfarm_run_id, task.queue_order, task.created_at, task.updated_at
  );

  return task;
}

describe('Queue API', () => {
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

  describe('GET /api/queue/status', () => {
    it('returns initial queue status with paused=false', () => {
      const status = getQueueStatus();
      
      expect(status.paused).toBe(false);
      expect(status.runningCount).toBe(0);
      expect(status.maxConcurrent).toBe(1);
    });

    it('returns correct running count', () => {
      createTask({ title: 'Running Task 1', status: 'running' });
      createTask({ title: 'Running Task 2', status: 'running' });
      createTask({ title: 'Queued Task', status: 'queued' });
      
      const status = getQueueStatus();
      
      expect(status.runningCount).toBe(2);
    });

    it('returns paused=true after pause is set', () => {
      setQueuePaused(true);
      
      const status = getQueueStatus();
      
      expect(status.paused).toBe(true);
    });

    it('returns paused=false after resume is set', () => {
      setQueuePaused(true);
      setQueuePaused(false);
      
      const status = getQueueStatus();
      
      expect(status.paused).toBe(false);
    });
  });

  describe('POST /api/queue/pause', () => {
    it('sets paused state to true', () => {
      setQueuePaused(true);
      
      const db = getDb();
      const config = db.prepare('SELECT paused FROM queue_config WHERE id = 1').get() as { paused: number };
      
      expect(config.paused).toBe(1);
    });
  });

  describe('POST /api/queue/resume', () => {
    it('sets paused state to false', () => {
      setQueuePaused(true);
      setQueuePaused(false);
      
      const db = getDb();
      const config = db.prepare('SELECT paused FROM queue_config WHERE id = 1').get() as { paused: number };
      
      expect(config.paused).toBe(0);
    });
  });

  describe('POST /api/queue/reorder', () => {
    it('updates queue_order for multiple tasks', () => {
      const task1 = createTask({ title: 'Task 1', status: 'queued', queue_order: 1 });
      const task2 = createTask({ title: 'Task 2', status: 'queued', queue_order: 2 });
      const task3 = createTask({ title: 'Task 3', status: 'queued', queue_order: 3 });

      // Reorder: swap task1 and task3
      reorderTasks([
        { id: task1.id, order: 3 },
        { id: task2.id, order: 2 },
        { id: task3.id, order: 1 }
      ]);

      const db = getDb();
      const updated1 = db.prepare('SELECT queue_order FROM tasks WHERE id = ?').get(task1.id) as { queue_order: number };
      const updated2 = db.prepare('SELECT queue_order FROM tasks WHERE id = ?').get(task2.id) as { queue_order: number };
      const updated3 = db.prepare('SELECT queue_order FROM tasks WHERE id = ?').get(task3.id) as { queue_order: number };

      expect(updated1.queue_order).toBe(3);
      expect(updated2.queue_order).toBe(2);
      expect(updated3.queue_order).toBe(1);
    });

    it('updates updated_at timestamp when reordering', () => {
      const task = createTask({ title: 'Task', status: 'queued', queue_order: 1 });
      
      // Wait a bit to ensure timestamp changes
      const beforeUpdate = new Date().toISOString();
      
      reorderTasks([{ id: task.id, order: 5 }]);

      const db = getDb();
      const updated = db.prepare('SELECT updated_at FROM tasks WHERE id = ?').get(task.id) as { updated_at: string };

      expect(updated.updated_at >= beforeUpdate).toBe(true);
    });
  });

  describe('getNextQueuedTask helper', () => {
    it('returns null when no queued tasks exist', () => {
      createTask({ title: 'Backlog Task', status: 'backlog' });
      
      const nextTask = getNextQueuedTask();
      
      expect(nextTask).toBeNull();
    });

    it('returns the task with lowest queue_order', () => {
      createTask({ title: 'Task 3', status: 'queued', queue_order: 3 });
      createTask({ title: 'Task 1', status: 'queued', queue_order: 1 });
      createTask({ title: 'Task 2', status: 'queued', queue_order: 2 });
      
      const nextTask = getNextQueuedTask();
      
      expect(nextTask).not.toBeNull();
      expect(nextTask!.title).toBe('Task 1');
    });

    it('returns task with earliest created_at when queue_orders are equal', () => {
      const task1 = createTask({ title: 'First Task', status: 'queued', queue_order: 1 });
      
      // Small delay
      const start = Date.now();
      while (Date.now() - start < 10) {}
      
      const task2 = createTask({ title: 'Second Task', status: 'queued', queue_order: 1 });
      
      const nextTask = getNextQueuedTask();
      
      expect(nextTask).not.toBeNull();
      expect(nextTask!.id).toBe(task1.id);
    });

    it('only returns tasks with status=queued', () => {
      createTask({ title: 'Running Task', status: 'running', queue_order: 1 });
      createTask({ title: 'Done Task', status: 'done', queue_order: 2 });
      const queuedTask = createTask({ title: 'Queued Task', status: 'queued', queue_order: 3 });
      
      const nextTask = getNextQueuedTask();
      
      expect(nextTask).not.toBeNull();
      expect(nextTask!.id).toBe(queuedTask.id);
    });
  });
});
