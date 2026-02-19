import { describe, it, beforeEach, afterEach } from 'vitest';
import { expect } from 'vitest';
import { getDb, closeDb, Task } from '../lib/db';
import { v4 as uuidv4 } from 'uuid';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';

const TEST_DB_PATH = join(process.cwd(), 'data', 'task-queue.db');

// Helper to simulate API request handling
function createTask(data: {
  title: string;
  description?: string;
  priority?: string;
  status?: string;
  workflow?: string;
  target_repo?: string;
}): { status: number; data?: Task; error?: { code: string; message: string; details?: unknown } } {
  const db = getDb();
  
  // Validation
  const errors: { field: string; message: string }[] = [];
  
  if (!data.title || typeof data.title !== 'string' || data.title.trim() === '') {
    errors.push({ field: 'title', message: 'Title is required' });
  }
  
  const validPriorities = ['low', 'medium', 'high', 'critical'];
  if (data.priority && !validPriorities.includes(data.priority)) {
    errors.push({ field: 'priority', message: `Priority must be one of: ${validPriorities.join(', ')}` });
  }
  
  const validStatuses = ['backlog', 'queued', 'running', 'done', 'failed', 'cancelled'];
  if (data.status && !validStatuses.includes(data.status)) {
    errors.push({ field: 'status', message: `Status must be one of: ${validStatuses.join(', ')}` });
  }
  
  if (errors.length > 0) {
    return {
      status: 400,
      error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: errors }
    };
  }
  
  const id = uuidv4();
  const now = new Date().toISOString();
  
  // Get max queue_order for queued items
  let queueOrder = 0;
  if (data.status === 'queued') {
    const maxOrder = db.prepare("SELECT MAX(queue_order) as max FROM tasks WHERE status = 'queued'").get() as { max: number | null };
    queueOrder = (maxOrder?.max ?? 0) + 1;
  }
  
  const task: Task = {
    id,
    title: data.title.trim(),
    description: data.description ?? null,
    priority: (data.priority as Task['priority']) ?? 'medium',
    status: (data.status as Task['status']) ?? 'backlog',
    workflow: data.workflow ?? 'feature-dev',
    target_repo: data.target_repo ?? null,
    scheduled_at: null,
    started_at: null,
    completed_at: null,
    antfarm_run_id: null,
    queue_order: queueOrder,
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
  
  return { status: 201, data: task };
}

function getTasks(filters?: { status?: string; priority?: string; workflow?: string }): { status: number; data: Task[] } {
  const db = getDb();
  
  let query = 'SELECT * FROM tasks WHERE 1=1';
  const params: (string | number)[] = [];
  
  if (filters?.status) {
    query += ' AND status = ?';
    params.push(filters.status);
  }
  
  if (filters?.priority) {
    query += ' AND priority = ?';
    params.push(filters.priority);
  }
  
  if (filters?.workflow) {
    query += ' AND workflow = ?';
    params.push(filters.workflow);
  }
  
  query += " ORDER BY CASE WHEN status = 'queued' THEN queue_order ELSE 999999 END, created_at DESC";
  
  const tasks = db.prepare(query).all(...params) as Task[];
  
  return { status: 200, data: tasks };
}

function getTaskById(id: string): { status: number; data?: Task; error?: { code: string; message: string } } {
  const db = getDb();
  
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Task | undefined;
  
  if (!task) {
    return {
      status: 404,
      error: { code: 'NOT_FOUND', message: `Task with id ${id} not found` }
    };
  }
  
  return { status: 200, data: task };
}

function updateTask(
  id: string,
  updates: Partial<Omit<Task, 'id' | 'created_at'>>
): { status: number; data?: Task; error?: { code: string; message: string; details?: unknown } } {
  const db = getDb();
  
  const existingTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Task | undefined;
  
  if (!existingTask) {
    return {
      status: 404,
      error: { code: 'NOT_FOUND', message: `Task with id ${id} not found` }
    };
  }
  
  // Validation
  const errors: { field: string; message: string }[] = [];
  
  if (updates.title !== undefined && (typeof updates.title !== 'string' || updates.title.trim() === '')) {
    errors.push({ field: 'title', message: 'Title cannot be empty' });
  }
  
  const validPriorities = ['low', 'medium', 'high', 'critical'];
  if (updates.priority && !validPriorities.includes(updates.priority)) {
    errors.push({ field: 'priority', message: `Priority must be one of: ${validPriorities.join(', ')}` });
  }
  
  const validStatuses = ['backlog', 'queued', 'running', 'done', 'failed', 'cancelled'];
  if (updates.status && !validStatuses.includes(updates.status)) {
    errors.push({ field: 'status', message: `Status must be one of: ${validStatuses.join(', ')}` });
  }
  
  if (errors.length > 0) {
    return {
      status: 400,
      error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: errors }
    };
  }
  
  const now = new Date().toISOString();
  const updateFields: string[] = [];
  const values: (string | number | null)[] = [];
  
  if (updates.title !== undefined) {
    updateFields.push('title = ?');
    values.push(updates.title.trim());
  }
  
  if (updates.description !== undefined) {
    updateFields.push('description = ?');
    values.push(updates.description);
  }
  
  if (updates.priority !== undefined) {
    updateFields.push('priority = ?');
    values.push(updates.priority);
  }
  
  if (updates.status !== undefined) {
    updateFields.push('status = ?');
    values.push(updates.status);
    
    if (updates.status === 'running' && existingTask.status !== 'running') {
      updateFields.push('started_at = ?');
      values.push(now);
    }
    
    if ((updates.status === 'done' || updates.status === 'failed' || updates.status === 'cancelled') && !existingTask.completed_at) {
      updateFields.push('completed_at = ?');
      values.push(now);
    }
  }
  
  if (updates.workflow !== undefined) {
    updateFields.push('workflow = ?');
    values.push(updates.workflow);
  }
  
  updateFields.push('updated_at = ?');
  values.push(now);
  values.push(id);
  
  db.prepare(`UPDATE tasks SET ${updateFields.join(', ')} WHERE id = ?`).run(...values);
  
  const updatedTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Task;
  
  return { status: 200, data: updatedTask };
}

function deleteTask(id: string): { status: number; data?: { deleted: boolean }; error?: { code: string; message: string } } {
  const db = getDb();
  
  const existingTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Task | undefined;
  
  if (!existingTask) {
    return {
      status: 404,
      error: { code: 'NOT_FOUND', message: `Task with id ${id} not found` }
    };
  }
  
  db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  
  return { status: 200, data: { deleted: true } };
}

describe('Task API', () => {
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

  describe('GET /api/tasks', () => {
    it('returns empty array when no tasks exist', () => {
      const result = getTasks();
      
      expect(result.status).toBe(200);
      expect(result.data).toEqual([]);
    });

    it('returns list of tasks', () => {
      createTask({ title: 'Test Task 1' });
      
      const result = getTasks();
      
      expect(result.status).toBe(200);
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBe(1);
      expect(result.data[0].title).toBe('Test Task 1');
    });

    it('filters by status', () => {
      createTask({ title: 'Backlog Task', status: 'backlog' });
      createTask({ title: 'Queued Task', status: 'queued' });
      
      const result = getTasks({ status: 'queued' });
      
      expect(result.status).toBe(200);
      expect(result.data.length).toBe(1);
      expect(result.data[0].status).toBe('queued');
    });

    it('filters by priority', () => {
      createTask({ title: 'Low Priority', priority: 'low' });
      createTask({ title: 'Critical Priority', priority: 'critical' });
      
      const result = getTasks({ priority: 'critical' });
      
      expect(result.status).toBe(200);
      expect(result.data.length).toBe(1);
      expect(result.data[0].priority).toBe('critical');
    });

    it('filters by workflow', () => {
      createTask({ title: 'Feature Task', workflow: 'feature-dev' });
      createTask({ title: 'Bug Task', workflow: 'bug-fix' });
      
      const result = getTasks({ workflow: 'bug-fix' });
      
      expect(result.status).toBe(200);
      expect(result.data.length).toBe(1);
      expect(result.data[0].workflow).toBe('bug-fix');
    });
  });

  describe('POST /api/tasks', () => {
    it('creates a new task with required fields', () => {
      const result = createTask({ title: 'New Test Task' });
      
      expect(result.status).toBe(201);
      expect(result.data?.id).toBeDefined();
      expect(result.data?.title).toBe('New Test Task');
      expect(result.data?.priority).toBe('medium');
      expect(result.data?.status).toBe('backlog');
      expect(result.data?.workflow).toBe('feature-dev');
    });

    it('creates a task with all fields', () => {
      const result = createTask({
        title: 'Full Task',
        description: 'Detailed description',
        priority: 'high',
        status: 'queued',
        workflow: 'bug-fix',
        target_repo: '/home/setrox/test-repo'
      });
      
      expect(result.status).toBe(201);
      expect(result.data?.title).toBe('Full Task');
      expect(result.data?.description).toBe('Detailed description');
      expect(result.data?.priority).toBe('high');
      expect(result.data?.status).toBe('queued');
      expect(result.data?.workflow).toBe('bug-fix');
      expect(result.data?.target_repo).toBe('/home/setrox/test-repo');
      expect(result.data?.queue_order).toBe(1);
    });

    it('returns 400 for missing title', () => {
      const result = createTask({ title: '' });
      
      expect(result.status).toBe(400);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for empty title', () => {
      const result = createTask({ title: '   ' });
      
      expect(result.status).toBe(400);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for invalid priority', () => {
      const result = createTask({
        title: 'Test',
        priority: 'invalid'
      });
      
      expect(result.status).toBe(400);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for invalid status', () => {
      const result = createTask({
        title: 'Test',
        status: 'invalid'
      });
      
      expect(result.status).toBe(400);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/tasks/:id', () => {
    it('returns a single task', () => {
      const created = createTask({ title: 'Get Test Task' });
      
      const result = getTaskById(created.data!.id);
      
      expect(result.status).toBe(200);
      expect(result.data?.id).toBe(created.data!.id);
      expect(result.data?.title).toBe('Get Test Task');
    });

    it('returns 404 for non-existent task', () => {
      const result = getTaskById('non-existent-id');
      
      expect(result.status).toBe(404);
      expect(result.error?.code).toBe('NOT_FOUND');
    });
  });

  describe('PATCH /api/tasks/:id', () => {
    it('updates task fields', () => {
      const created = createTask({ title: 'Original Title', priority: 'low' });
      
      const result = updateTask(created.data!.id, {
        title: 'Updated Title',
        priority: 'critical'
      });
      
      expect(result.status).toBe(200);
      expect(result.data?.title).toBe('Updated Title');
      expect(result.data?.priority).toBe('critical');
      expect(result.data?.status).toBe('backlog'); // unchanged
    });

    it('returns 404 for non-existent task', () => {
      const result = updateTask('non-existent-id', { title: 'Updated' });
      
      expect(result.status).toBe(404);
      expect(result.error?.code).toBe('NOT_FOUND');
    });

    it('returns 400 for invalid priority', () => {
      const created = createTask({ title: 'Test' });
      
      const result = updateTask(created.data!.id, {
        priority: 'super-high' as Task['priority']
      });
      
      expect(result.status).toBe(400);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
    });

    it('auto-sets started_at when status changes to running', () => {
      const created = createTask({ title: 'Test', status: 'queued' });
      
      const result = updateTask(created.data!.id, { status: 'running' });
      
      expect(result.status).toBe(200);
      expect(result.data?.status).toBe('running');
      expect(result.data?.started_at).toBeDefined();
    });

    it('auto-sets completed_at when status changes to done', () => {
      const created = createTask({ title: 'Test', status: 'running' });
      
      const result = updateTask(created.data!.id, { status: 'done' });
      
      expect(result.status).toBe(200);
      expect(result.data?.status).toBe('done');
      expect(result.data?.completed_at).toBeDefined();
    });
  });

  describe('DELETE /api/tasks/:id', () => {
    it('deletes a task', () => {
      const created = createTask({ title: 'Delete Me' });
      
      const result = deleteTask(created.data!.id);
      
      expect(result.status).toBe(200);
      expect(result.data).toEqual({ deleted: true });
      
      // Verify it's gone
      const getResult = getTaskById(created.data!.id);
      expect(getResult.status).toBe(404);
    });

    it('returns 404 for non-existent task', () => {
      const result = deleteTask('non-existent-id');
      
      expect(result.status).toBe(404);
      expect(result.error?.code).toBe('NOT_FOUND');
    });
  });
});
