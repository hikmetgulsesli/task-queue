import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDb, closeDb } from '../lib/db';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';

const TEST_DB_PATH = join(process.cwd(), 'data', 'task-queue.db');

// Stats calculation function (extracted from route for testing)
interface StatsResult {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  averageDuration: number | null;
  successRate: number;
  workflowDistribution: Record<string, number>;
}

function calculateStats(): StatsResult {
  const db = getDb();

  // Total tasks count
  const totalResult = db.prepare('SELECT COUNT(*) as count FROM tasks').get() as { count: number };
  const totalTasks = totalResult.count;

  // Completed tasks count
  const completedResult = db.prepare(
    "SELECT COUNT(*) as count FROM tasks WHERE status = 'done'"
  ).get() as { count: number };
  const completedTasks = completedResult.count;

  // Failed tasks count
  const failedResult = db.prepare(
    "SELECT COUNT(*) as count FROM tasks WHERE status = 'failed'"
  ).get() as { count: number };
  const failedTasks = failedResult.count;

  // Average duration for completed tasks
  const avgDurationResult = db.prepare(`
    SELECT AVG(
      (julianday(completed_at) - julianday(started_at)) * 24 * 60 * 60 * 1000
    ) as avg_duration
    FROM tasks
    WHERE status = 'done'
    AND started_at IS NOT NULL
    AND completed_at IS NOT NULL
  `).get() as { avg_duration: number | null };
  const averageDuration = avgDurationResult.avg_duration 
    ? Math.round(avgDurationResult.avg_duration) 
    : null;

  // Success rate: completed / (completed + failed)
  const finishedTasks = completedTasks + failedTasks;
  const successRate = finishedTasks > 0 
    ? Math.round((completedTasks / finishedTasks) * 100) 
    : 0;

  // Workflow distribution
  const workflowResult = db.prepare(`
    SELECT workflow, COUNT(*) as count 
    FROM tasks 
    GROUP BY workflow
  `).all() as Array<{ workflow: string; count: number }>;
  
  const workflowDistribution: Record<string, number> = {};
  for (const row of workflowResult) {
    workflowDistribution[row.workflow] = row.count;
  }

  return {
    totalTasks,
    completedTasks,
    failedTasks,
    averageDuration,
    successRate,
    workflowDistribution,
  };
}

describe('Stats API', () => {
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

  describe('GET /api/stats', () => {
    it('should return total task count', () => {
      const db = getDb();
      
      // Insert test tasks
      db.prepare('INSERT INTO tasks (id, title, status) VALUES (?, ?, ?)')
        .run('stats-1', 'Task 1', 'backlog');
      db.prepare('INSERT INTO tasks (id, title, status) VALUES (?, ?, ?)')
        .run('stats-2', 'Task 2', 'queued');
      db.prepare('INSERT INTO tasks (id, title, status) VALUES (?, ?, ?)')
        .run('stats-3', 'Task 3', 'done');

      const stats = calculateStats();
      expect(stats.totalTasks).toBe(3);
    });

    it('should return zero for empty database', () => {
      const stats = calculateStats();
      
      expect(stats.totalTasks).toBe(0);
      expect(stats.completedTasks).toBe(0);
      expect(stats.failedTasks).toBe(0);
      expect(stats.successRate).toBe(0);
      expect(stats.averageDuration).toBeNull();
      expect(stats.workflowDistribution).toEqual({});
    });

    it('should return completed tasks count', () => {
      const db = getDb();
      
      db.prepare('INSERT INTO tasks (id, title, status) VALUES (?, ?, ?)')
        .run('stats-4', 'Task 4', 'done');
      db.prepare('INSERT INTO tasks (id, title, status) VALUES (?, ?, ?)')
        .run('stats-5', 'Task 5', 'done');
      db.prepare('INSERT INTO tasks (id, title, status) VALUES (?, ?, ?)')
        .run('stats-6', 'Task 6', 'failed');

      const stats = calculateStats();
      
      expect(stats.completedTasks).toBe(2);
      expect(stats.failedTasks).toBe(1);
    });

    it('should return average completion duration', () => {
      const db = getDb();
      
      // Insert completed task with known duration (1 hour = 3600000 ms)
      const startedAt = new Date('2024-01-01T10:00:00Z').toISOString();
      const completedAt = new Date('2024-01-01T11:00:00Z').toISOString();
      
      db.prepare(`
        INSERT INTO tasks (id, title, status, started_at, completed_at) 
        VALUES (?, ?, ?, ?, ?)
      `).run('stats-7', 'Task 7', 'done', startedAt, completedAt);

      const stats = calculateStats();
      
      expect(stats.averageDuration).toBeGreaterThan(0);
      // Should be approximately 1 hour in milliseconds (3600000)
      expect(stats.averageDuration).toBeGreaterThan(3500000);
      expect(stats.averageDuration).toBeLessThan(3700000);
    });

    it('should return null average duration when no completed tasks', () => {
      const db = getDb();
      
      db.prepare('INSERT INTO tasks (id, title, status) VALUES (?, ?, ?)')
        .run('stats-8', 'Task 8', 'backlog');

      const stats = calculateStats();
      
      expect(stats.averageDuration).toBeNull();
    });

    it('should calculate success rate correctly', () => {
      const db = getDb();
      
      // 3 completed, 1 failed = 75% success rate
      db.prepare('INSERT INTO tasks (id, title, status) VALUES (?, ?, ?)')
        .run('stats-9', 'Task 9', 'done');
      db.prepare('INSERT INTO tasks (id, title, status) VALUES (?, ?, ?)')
        .run('stats-10', 'Task 10', 'done');
      db.prepare('INSERT INTO tasks (id, title, status) VALUES (?, ?, ?)')
        .run('stats-11', 'Task 11', 'done');
      db.prepare('INSERT INTO tasks (id, title, status) VALUES (?, ?, ?)')
        .run('stats-12', 'Task 12', 'failed');

      const stats = calculateStats();
      
      expect(stats.successRate).toBe(75);
    });

    it('should return 0 success rate when no finished tasks', () => {
      const db = getDb();
      
      db.prepare('INSERT INTO tasks (id, title, status) VALUES (?, ?, ?)')
        .run('stats-13', 'Task 13', 'backlog');
      db.prepare('INSERT INTO tasks (id, title, status) VALUES (?, ?, ?)')
        .run('stats-14', 'Task 14', 'running');

      const stats = calculateStats();
      
      expect(stats.successRate).toBe(0);
    });

    it('should return workflow distribution', () => {
      const db = getDb();
      
      db.prepare('INSERT INTO tasks (id, title, workflow) VALUES (?, ?, ?)')
        .run('stats-15', 'Task 15', 'feature-dev');
      db.prepare('INSERT INTO tasks (id, title, workflow) VALUES (?, ?, ?)')
        .run('stats-16', 'Task 16', 'feature-dev');
      db.prepare('INSERT INTO tasks (id, title, workflow) VALUES (?, ?, ?)')
        .run('stats-17', 'Task 17', 'bug-fix');
      db.prepare('INSERT INTO tasks (id, title, workflow) VALUES (?, ?, ?)')
        .run('stats-18', 'Task 18', 'security-audit');

      const stats = calculateStats();
      
      expect(stats.workflowDistribution).toEqual({
        'feature-dev': 2,
        'bug-fix': 1,
        'security-audit': 1,
      });
    });

    it('should return correct response structure', () => {
      const stats = calculateStats();
      
      expect(stats).toHaveProperty('totalTasks');
      expect(stats).toHaveProperty('completedTasks');
      expect(stats).toHaveProperty('failedTasks');
      expect(stats).toHaveProperty('averageDuration');
      expect(stats).toHaveProperty('successRate');
      expect(stats).toHaveProperty('workflowDistribution');
      
      expect(typeof stats.totalTasks).toBe('number');
      expect(typeof stats.completedTasks).toBe('number');
      expect(typeof stats.failedTasks).toBe('number');
      expect(typeof stats.successRate).toBe('number');
      expect(typeof stats.workflowDistribution).toBe('object');
    });
  });
});
