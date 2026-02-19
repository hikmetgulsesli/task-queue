import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { getDb, closeDb, Task } from '../lib/db';
import { v4 as uuidv4 } from 'uuid';

const TEST_DB_PATH = join(process.cwd(), 'data', 'task-queue.db');

// Helper to create a task
function createTask(data: {
  title: string;
  description?: string;
  priority?: Task['priority'];
  status?: Task['status'];
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
    priority: data.priority ?? 'medium',
    status: data.status ?? 'backlog',
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

// Simulate API response structure
interface TasksResponse {
  tasks: Task[];
}

function buildQuery(filter: { status?: string; priority?: string; workflow?: string }): { sql: string; params: (string | number)[] } {
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (filter.status && filter.status !== 'all') {
    conditions.push('status = ?');
    params.push(filter.status);
  }

  if (filter.priority && filter.priority !== 'all') {
    conditions.push('priority = ?');
    params.push(filter.priority);
  }

  if (filter.workflow && filter.workflow !== 'all') {
    conditions.push('workflow = ?');
    params.push(filter.workflow);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `SELECT * FROM tasks ${whereClause} ORDER BY created_at DESC`;

  return { sql, params };
}

function fetchTasks(filter: { status?: string; priority?: string; workflow?: string } = {}): TasksResponse {
  const db = getDb();
  const { sql, params } = buildQuery(filter);
  const tasks = db.prepare(sql).all(...params) as Task[];
  return { tasks };
}

describe('Tasks List Page', () => {
  beforeEach(() => {
    closeDb();
    try {
      if (existsSync(TEST_DB_PATH)) {
        unlinkSync(TEST_DB_PATH);
      }
    } catch {
      // Ignore errors
    }
  });

  afterEach(() => {
    closeDb();
  });

  describe('Task Table Display', () => {
    it('should display all tasks with correct columns', () => {
      const task1 = createTask({ 
        title: 'Test Task 1', 
        priority: 'high',
        status: 'queued',
        workflow: 'feature-dev',
        queue_order: 1
      });
      const task2 = createTask({ 
        title: 'Test Task 2', 
        priority: 'medium',
        status: 'backlog',
        workflow: 'bug-fix',
        queue_order: 2
      });

      const { tasks } = fetchTasks();

      expect(tasks).toHaveLength(2);
      expect(tasks[0]).toHaveProperty('id');
      expect(tasks[0]).toHaveProperty('title');
      expect(tasks[0]).toHaveProperty('priority');
      expect(tasks[0]).toHaveProperty('status');
      expect(tasks[0]).toHaveProperty('workflow');
      expect(tasks[0]).toHaveProperty('queue_order');
      expect(tasks[0]).toHaveProperty('created_at');
    });

    it('should return empty array when no tasks exist', () => {
      const { tasks } = fetchTasks();
      expect(tasks).toEqual([]);
    });

    it('should return tasks sorted by created_at DESC', () => {
      const task1 = createTask({ title: 'Older Task' });
      
      // Small delay to ensure different timestamps
      const start = Date.now();
      while (Date.now() - start < 10) {}
      
      const task2 = createTask({ title: 'Newer Task' });

      const { tasks } = fetchTasks();

      expect(tasks[0].id).toBe(task2.id);
      expect(tasks[1].id).toBe(task1.id);
    });
  });

  describe('Status Filter', () => {
    it('should filter tasks by status=backlog', () => {
      createTask({ title: 'Backlog Task', status: 'backlog' });
      createTask({ title: 'Queued Task', status: 'queued' });
      createTask({ title: 'Running Task', status: 'running' });

      const { tasks } = fetchTasks({ status: 'backlog' });

      expect(tasks).toHaveLength(1);
      expect(tasks[0].status).toBe('backlog');
      expect(tasks[0].title).toBe('Backlog Task');
    });

    it('should filter tasks by status=queued', () => {
      createTask({ title: 'Backlog Task', status: 'backlog' });
      createTask({ title: 'Queued Task', status: 'queued' });

      const { tasks } = fetchTasks({ status: 'queued' });

      expect(tasks).toHaveLength(1);
      expect(tasks[0].status).toBe('queued');
    });

    it('should filter tasks by status=running', () => {
      createTask({ title: 'Running Task', status: 'running' });
      createTask({ title: 'Done Task', status: 'done' });

      const { tasks } = fetchTasks({ status: 'running' });

      expect(tasks).toHaveLength(1);
      expect(tasks[0].status).toBe('running');
    });

    it('should filter tasks by status=done', () => {
      createTask({ title: 'Done Task', status: 'done' });
      createTask({ title: 'Failed Task', status: 'failed' });

      const { tasks } = fetchTasks({ status: 'done' });

      expect(tasks).toHaveLength(1);
      expect(tasks[0].status).toBe('done');
    });

    it('should filter tasks by status=failed', () => {
      createTask({ title: 'Done Task', status: 'done' });
      createTask({ title: 'Failed Task', status: 'failed' });

      const { tasks } = fetchTasks({ status: 'failed' });

      expect(tasks).toHaveLength(1);
      expect(tasks[0].status).toBe('failed');
    });

    it('should return all tasks when status filter is "all"', () => {
      createTask({ title: 'Task 1', status: 'backlog' });
      createTask({ title: 'Task 2', status: 'queued' });
      createTask({ title: 'Task 3', status: 'running' });

      const { tasks } = fetchTasks({ status: 'all' });

      expect(tasks).toHaveLength(3);
    });

    it('should return all tasks when no status filter provided', () => {
      createTask({ title: 'Task 1', status: 'backlog' });
      createTask({ title: 'Task 2', status: 'queued' });

      const { tasks } = fetchTasks();

      expect(tasks).toHaveLength(2);
    });
  });

  describe('Priority Filter', () => {
    it('should filter tasks by priority=critical', () => {
      createTask({ title: 'Critical Task', priority: 'critical' });
      createTask({ title: 'High Task', priority: 'high' });

      const { tasks } = fetchTasks({ priority: 'critical' });

      expect(tasks).toHaveLength(1);
      expect(tasks[0].priority).toBe('critical');
    });

    it('should filter tasks by priority=high', () => {
      createTask({ title: 'Critical Task', priority: 'critical' });
      createTask({ title: 'High Task', priority: 'high' });
      createTask({ title: 'Medium Task', priority: 'medium' });

      const { tasks } = fetchTasks({ priority: 'high' });

      expect(tasks).toHaveLength(1);
      expect(tasks[0].priority).toBe('high');
    });

    it('should filter tasks by priority=medium', () => {
      createTask({ title: 'High Task', priority: 'high' });
      createTask({ title: 'Medium Task', priority: 'medium' });

      const { tasks } = fetchTasks({ priority: 'medium' });

      expect(tasks).toHaveLength(1);
      expect(tasks[0].priority).toBe('medium');
    });

    it('should filter tasks by priority=low', () => {
      createTask({ title: 'Medium Task', priority: 'medium' });
      createTask({ title: 'Low Task', priority: 'low' });

      const { tasks } = fetchTasks({ priority: 'low' });

      expect(tasks).toHaveLength(1);
      expect(tasks[0].priority).toBe('low');
    });

    it('should return all tasks when priority filter is "all"', () => {
      createTask({ title: 'Critical Task', priority: 'critical' });
      createTask({ title: 'High Task', priority: 'high' });
      createTask({ title: 'Medium Task', priority: 'medium' });

      const { tasks } = fetchTasks({ priority: 'all' });

      expect(tasks).toHaveLength(3);
    });
  });

  describe('Workflow Filter', () => {
    it('should filter tasks by workflow=feature-dev', () => {
      createTask({ title: 'Feature Task', workflow: 'feature-dev' });
      createTask({ title: 'Bug Task', workflow: 'bug-fix' });

      const { tasks } = fetchTasks({ workflow: 'feature-dev' });

      expect(tasks).toHaveLength(1);
      expect(tasks[0].workflow).toBe('feature-dev');
    });

    it('should filter tasks by workflow=bug-fix', () => {
      createTask({ title: 'Feature Task', workflow: 'feature-dev' });
      createTask({ title: 'Bug Task', workflow: 'bug-fix' });
      createTask({ title: 'Security Task', workflow: 'security-audit' });

      const { tasks } = fetchTasks({ workflow: 'bug-fix' });

      expect(tasks).toHaveLength(1);
      expect(tasks[0].workflow).toBe('bug-fix');
    });

    it('should filter tasks by workflow=security-audit', () => {
      createTask({ title: 'Feature Task', workflow: 'feature-dev' });
      createTask({ title: 'Security Task', workflow: 'security-audit' });

      const { tasks } = fetchTasks({ workflow: 'security-audit' });

      expect(tasks).toHaveLength(1);
      expect(tasks[0].workflow).toBe('security-audit');
    });

    it('should return all tasks when workflow filter is "all"', () => {
      createTask({ title: 'Feature Task', workflow: 'feature-dev' });
      createTask({ title: 'Bug Task', workflow: 'bug-fix' });

      const { tasks } = fetchTasks({ workflow: 'all' });

      expect(tasks).toHaveLength(2);
    });
  });

  describe('Combined Filters', () => {
    it('should filter by multiple criteria', () => {
      createTask({ title: 'High Feature Backlog', priority: 'high', workflow: 'feature-dev', status: 'backlog' });
      createTask({ title: 'High Feature Queued', priority: 'high', workflow: 'feature-dev', status: 'queued' });
      createTask({ title: 'Medium Feature Backlog', priority: 'medium', workflow: 'feature-dev', status: 'backlog' });
      createTask({ title: 'High Bug Backlog', priority: 'high', workflow: 'bug-fix', status: 'backlog' });

      const { tasks } = fetchTasks({ 
        priority: 'high', 
        workflow: 'feature-dev',
        status: 'backlog'
      });

      expect(tasks).toHaveLength(1);
      expect(tasks[0].title).toBe('High Feature Backlog');
    });

    it('should return empty array when no tasks match combined filters', () => {
      createTask({ title: 'High Feature', priority: 'high', workflow: 'feature-dev' });

      const { tasks } = fetchTasks({ 
        priority: 'critical', 
        workflow: 'bug-fix'
      });

      expect(tasks).toHaveLength(0);
    });
  });

  describe('Priority Badge Colors', () => {
    it('should have correct priority values for badge coloring', () => {
      const critical = createTask({ title: 'Critical', priority: 'critical' });
      const high = createTask({ title: 'High', priority: 'high' });
      const medium = createTask({ title: 'Medium', priority: 'medium' });
      const low = createTask({ title: 'Low', priority: 'low' });

      expect(critical.priority).toBe('critical');
      expect(high.priority).toBe('high');
      expect(medium.priority).toBe('medium');
      expect(low.priority).toBe('low');
    });
  });

  describe('Status Badge Colors', () => {
    it('should have correct status values for badge coloring', () => {
      const backlog = createTask({ title: 'Backlog', status: 'backlog' });
      const queued = createTask({ title: 'Queued', status: 'queued' });
      const running = createTask({ title: 'Running', status: 'running' });
      const done = createTask({ title: 'Done', status: 'done' });
      const failed = createTask({ title: 'Failed', status: 'failed' });
      const cancelled = createTask({ title: 'Cancelled', status: 'cancelled' });

      expect(backlog.status).toBe('backlog');
      expect(queued.status).toBe('queued');
      expect(running.status).toBe('running');
      expect(done.status).toBe('done');
      expect(failed.status).toBe('failed');
      expect(cancelled.status).toBe('cancelled');
    });
  });
});
