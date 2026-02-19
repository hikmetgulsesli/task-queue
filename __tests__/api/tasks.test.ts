import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDb, closeDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

describe('Tasks API', () => {
  let db: ReturnType<typeof getDb>;
  const testTaskIds: string[] = [];

  beforeEach(() => {
    db = getDb();
    // Clean up any test tasks
    db.prepare('DELETE FROM tasks WHERE title LIKE ?').run('Test Task%');
  });

  afterEach(() => {
    // Clean up test tasks after each test
    for (const id of testTaskIds) {
      try {
        db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
      } catch (e) {
        // Ignore errors during cleanup
      }
    }
    testTaskIds.length = 0;
    closeDb();
  });

  describe('GET /api/tasks', () => {
    it('should return tasks with pagination metadata', async () => {
      const response = await fetch('http://localhost:3518/api/tasks');
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.data).toBeDefined();
      expect(Array.isArray(json.data)).toBe(true);
      expect(json.meta).toBeDefined();
      expect(json.meta.total).toBeDefined();
      expect(json.meta.limit).toBeDefined();
      expect(json.meta.offset).toBeDefined();
    });

    it('should filter tasks by status', async () => {
      // Create a task
      const taskId = uuidv4();
      testTaskIds.push(taskId);
      
      const task = {
        id: taskId,
        title: 'Test Task Status Filter',
        description: null,
        priority: 'medium',
        status: 'backlog',
        workflow: 'feature-dev',
        target_repo: null,
        scheduled_at: null,
        queue_order: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      db.prepare(`
        INSERT INTO tasks (id, title, description, priority, status, workflow, target_repo, scheduled_at, queue_order, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(task.id, task.title, task.description, task.priority, task.status, task.workflow, task.target_repo, task.scheduled_at, task.queue_order, task.created_at, task.updated_at);

      const response = await fetch('http://localhost:3518/api/tasks?status=backlog');
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.data.length).toBeGreaterThan(0);
      expect(json.data[0].status).toBe('backlog');
    });

    it('should filter tasks by priority', async () => {
      const response = await fetch('http://localhost:3518/api/tasks?priority=high');
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(Array.isArray(json.data)).toBe(true);
    });

    it('should filter tasks by workflow', async () => {
      const response = await fetch('http://localhost:3518/api/tasks?workflow=feature-dev');
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(Array.isArray(json.data)).toBe(true);
    });

    it('should support pagination', async () => {
      const response = await fetch('http://localhost:3518/api/tasks?limit=10&offset=0');
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.meta.limit).toBe(10);
      expect(json.meta.offset).toBe(0);
    });
  });

  describe('POST /api/tasks', () => {
    it('should create a task with valid input', async () => {
      const newTask = {
        title: 'Test Task Create',
        description: 'Test description',
        priority: 'high',
        status: 'backlog',
        workflow: 'feature-dev',
      };

      const response = await fetch('http://localhost:3518/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTask),
      });

      expect(response.status).toBe(201);
      const json = await response.json();
      expect(json.data.id).toBeDefined();
      expect(json.data.title).toBe(newTask.title);
      expect(json.data.priority).toBe(newTask.priority);
      expect(json.data.status).toBe(newTask.status);
      testTaskIds.push(json.data.id);
    });

    it('should return 400 for missing title', async () => {
      const newTask = {
        description: 'Test description',
        priority: 'high',
      };

      const response = await fetch('http://localhost:3518/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTask),
      });

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for invalid priority', async () => {
      const newTask = {
        title: 'Test Task',
        priority: 'invalid',
      };

      const response = await fetch('http://localhost:3518/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTask),
      });

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for invalid status', async () => {
      const newTask = {
        title: 'Test Task',
        status: 'invalid',
      };

      const response = await fetch('http://localhost:3518/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTask),
      });

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/tasks/[id]', () => {
    it('should return a task by id', async () => {
      // First create a task
      const taskId = uuidv4();
      testTaskIds.push(taskId);
      
      const task = {
        id: taskId,
        title: 'Test Task Get',
        description: null,
        priority: 'medium',
        status: 'backlog',
        workflow: 'feature-dev',
        target_repo: null,
        scheduled_at: null,
        queue_order: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      db.prepare(`
        INSERT INTO tasks (id, title, description, priority, status, workflow, target_repo, scheduled_at, queue_order, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(task.id, task.title, task.description, task.priority, task.status, task.workflow, task.target_repo, task.scheduled_at, task.queue_order, task.created_at, task.updated_at);

      const response = await fetch(`http://localhost:3518/api/tasks/${taskId}`);
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.data.id).toBe(taskId);
      expect(json.data.title).toBe(task.title);
    });

    it('should return 404 for non-existent task', async () => {
      const fakeId = uuidv4();
      const response = await fetch(`http://localhost:3518/api/tasks/${fakeId}`);
      expect(response.status).toBe(404);
      const json = await response.json();
      expect(json.error.code).toBe('NOT_FOUND');
    });
  });

  describe('PATCH /api/tasks/[id]', () => {
    it('should update a task', async () => {
      // First create a task
      const taskId = uuidv4();
      testTaskIds.push(taskId);
      
      const task = {
        id: taskId,
        title: 'Test Task Update',
        description: null,
        priority: 'medium',
        status: 'backlog',
        workflow: 'feature-dev',
        target_repo: null,
        scheduled_at: null,
        queue_order: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      db.prepare(`
        INSERT INTO tasks (id, title, description, priority, status, workflow, target_repo, scheduled_at, queue_order, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(task.id, task.title, task.description, task.priority, task.status, task.workflow, task.target_repo, task.scheduled_at, task.queue_order, task.created_at, task.updated_at);

      const updateData = {
        title: 'Updated Title',
        priority: 'high',
      };

      const response = await fetch(`http://localhost:3518/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.data.title).toBe('Updated Title');
      expect(json.data.priority).toBe('high');
    });

    it('should return 404 when updating non-existent task', async () => {
      const fakeId = uuidv4();
      const response = await fetch(`http://localhost:3518/api/tasks/${fakeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Updated' }),
      });

      expect(response.status).toBe(404);
      const json = await response.json();
      expect(json.error.code).toBe('NOT_FOUND');
    });

    it('should set started_at when status changes to running', async () => {
      // Create a task in backlog
      const taskId = uuidv4();
      testTaskIds.push(taskId);
      
      const task = {
        id: taskId,
        title: 'Test Task Start Time',
        description: null,
        priority: 'medium',
        status: 'backlog',
        workflow: 'feature-dev',
        target_repo: null,
        scheduled_at: null,
        started_at: null,
        queue_order: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      db.prepare(`
        INSERT INTO tasks (id, title, description, priority, status, workflow, target_repo, scheduled_at, started_at, queue_order, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(task.id, task.title, task.description, task.priority, task.status, task.workflow, task.target_repo, task.scheduled_at, task.started_at, task.queue_order, task.created_at, task.updated_at);

      const response = await fetch(`http://localhost:3518/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'running' }),
      });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.data.status).toBe('running');
      expect(json.data.started_at).toBeDefined();
    });

    it('should set completed_at when status changes to done', async () => {
      // Create a task in running state
      const taskId = uuidv4();
      testTaskIds.push(taskId);
      
      const task = {
        id: taskId,
        title: 'Test Task Complete',
        description: null,
        priority: 'medium',
        status: 'running',
        workflow: 'feature-dev',
        target_repo: null,
        scheduled_at: null,
        started_at: new Date().toISOString(),
        completed_at: null,
        queue_order: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      db.prepare(`
        INSERT INTO tasks (id, title, description, priority, status, workflow, target_repo, scheduled_at, started_at, completed_at, queue_order, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(task.id, task.title, task.description, task.priority, task.status, task.workflow, task.target_repo, task.scheduled_at, task.started_at, task.completed_at, task.queue_order, task.created_at, task.updated_at);

      const response = await fetch(`http://localhost:3518/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'done' }),
      });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.data.status).toBe('done');
      expect(json.data.completed_at).toBeDefined();
    });
  });

  describe('DELETE /api/tasks/[id]', () => {
    it('should delete a task', async () => {
      // First create a task
      const taskId = uuidv4();
      
      const task = {
        id: taskId,
        title: 'Test Task Delete',
        description: null,
        priority: 'medium',
        status: 'backlog',
        workflow: 'feature-dev',
        target_repo: null,
        scheduled_at: null,
        queue_order: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      db.prepare(`
        INSERT INTO tasks (id, title, description, priority, status, workflow, target_repo, scheduled_at, queue_order, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(task.id, task.title, task.description, task.priority, task.status, task.workflow, task.target_repo, task.scheduled_at, task.queue_order, task.created_at, task.updated_at);

      const response = await fetch(`http://localhost:3518/api/tasks/${taskId}`, {
        method: 'DELETE',
      });

      expect(response.status).toBe(204);

      // Verify task is deleted
      const checkResponse = await fetch(`http://localhost:3518/api/tasks/${taskId}`);
      expect(checkResponse.status).toBe(404);
    });

    it('should return 404 when deleting non-existent task', async () => {
      const fakeId = uuidv4();
      const response = await fetch(`http://localhost:3518/api/tasks/${fakeId}`, {
        method: 'DELETE',
      });

      expect(response.status).toBe(404);
      const json = await response.json();
      expect(json.error.code).toBe('NOT_FOUND');
    });
  });
});
