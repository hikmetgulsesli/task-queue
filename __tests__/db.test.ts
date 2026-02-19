import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDb, closeDb, Task, QueueConfig } from '../lib/db';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';

const TEST_DB_PATH = join(process.cwd(), 'data', 'task-queue.db');

describe('Database Schema', () => {
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

  describe('Database Connection', () => {
    it('should create database file at data/task-queue.db', () => {
      const db = getDb();
      expect(db).toBeDefined();
      expect(existsSync(TEST_DB_PATH)).toBe(true);
    });

    it('should return the same database instance on multiple calls', () => {
      const db1 = getDb();
      const db2 = getDb();
      expect(db1).toBe(db2);
    });
  });

  describe('Tasks Table', () => {
    it('should create tasks table with all required columns', () => {
      const db = getDb();
      const columns = db.prepare(
        "SELECT name FROM pragma_table_info('tasks')"
      ).all() as Array<{ name: string }>;
      
      const columnNames = columns.map(c => c.name);
      
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('title');
      expect(columnNames).toContain('description');
      expect(columnNames).toContain('priority');
      expect(columnNames).toContain('status');
      expect(columnNames).toContain('workflow');
      expect(columnNames).toContain('target_repo');
      expect(columnNames).toContain('scheduled_at');
      expect(columnNames).toContain('started_at');
      expect(columnNames).toContain('completed_at');
      expect(columnNames).toContain('antfarm_run_id');
      expect(columnNames).toContain('queue_order');
      expect(columnNames).toContain('created_at');
      expect(columnNames).toContain('updated_at');
    });

    it('should have correct column types and constraints', () => {
      const db = getDb();
      const columns = db.prepare(
        "SELECT name, type, [notnull], dflt_value FROM pragma_table_info('tasks')"
      ).all() as Array<{ name: string; type: string; notnull: number; dflt_value: string | null }>;
      
      const idCol = columns.find(c => c.name === 'id');
      expect(idCol?.type).toBe('TEXT');
      expect(idCol?.notnull).toBe(0);

      const titleCol = columns.find(c => c.name === 'title');
      expect(titleCol?.type).toBe('TEXT');
      expect(titleCol?.notnull).toBe(1);

      const priorityCol = columns.find(c => c.name === 'priority');
      expect(priorityCol?.dflt_value).toBe("'medium'");

      const statusCol = columns.find(c => c.name === 'status');
      expect(statusCol?.dflt_value).toBe("'backlog'");

      const queueOrderCol = columns.find(c => c.name === 'queue_order');
      expect(queueOrderCol?.type).toBe('INTEGER');
      expect(queueOrderCol?.dflt_value).toBe('0');
    });

    it('should enforce priority check constraint', () => {
      const db = getDb();
      
      // Valid priorities should work
      expect(() => {
        db.prepare("INSERT INTO tasks (id, title, priority) VALUES (?, ?, ?)")
          .run('test-1', 'Test Task', 'low');
      }).not.toThrow();

      expect(() => {
        db.prepare("INSERT INTO tasks (id, title, priority) VALUES (?, ?, ?)")
          .run('test-2', 'Test Task', 'critical');
      }).not.toThrow();

      // Invalid priority should fail
      expect(() => {
        db.prepare("INSERT INTO tasks (id, title, priority) VALUES (?, ?, ?)")
          .run('test-3', 'Test Task', 'invalid');
      }).toThrow();
    });

    it('should enforce status check constraint', () => {
      const db = getDb();
      
      // Valid statuses should work
      expect(() => {
        db.prepare("INSERT INTO tasks (id, title, status) VALUES (?, ?, ?)")
          .run('test-4', 'Test Task', 'backlog');
      }).not.toThrow();

      expect(() => {
        db.prepare("INSERT INTO tasks (id, title, status) VALUES (?, ?, ?)")
          .run('test-5', 'Test Task', 'running');
      }).not.toThrow();

      // Invalid status should fail
      expect(() => {
        db.prepare("INSERT INTO tasks (id, title, status) VALUES (?, ?, ?)")
          .run('test-6', 'Test Task', 'unknown');
      }).toThrow();
    });

    it('should create indexes for performance', () => {
      const db = getDb();
      const indexes = db.prepare(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'tasks'"
      ).all() as Array<{ name: string }>;
      
      const indexNames = indexes.map(i => i.name);
      
      expect(indexNames).toContain('idx_tasks_queue_order');
      expect(indexNames).toContain('idx_tasks_status');
      expect(indexNames).toContain('idx_tasks_priority');
      expect(indexNames).toContain('idx_tasks_workflow');
    });

    it('should insert and retrieve a task', () => {
      const db = getDb();
      
      const taskId = 'test-task-001';
      const title = 'Test Task Title';
      const description = 'Test description';
      
      db.prepare(
        `INSERT INTO tasks (id, title, description, priority, status, workflow, target_repo, queue_order) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(taskId, title, description, 'high', 'queued', 'feature-dev', '/home/test/repo', 1);

      const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as Task;
      
      expect(task).toBeDefined();
      expect(task.id).toBe(taskId);
      expect(task.title).toBe(title);
      expect(task.description).toBe(description);
      expect(task.priority).toBe('high');
      expect(task.status).toBe('queued');
      expect(task.workflow).toBe('feature-dev');
      expect(task.target_repo).toBe('/home/test/repo');
      expect(task.queue_order).toBe(1);
    });
  });

  describe('Queue Config Table', () => {
    it('should create queue_config table', () => {
      const db = getDb();
      const tables = db.prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'queue_config'"
      ).all() as Array<{ name: string }>;
      
      expect(tables.length).toBe(1);
    });

    it('should have correct queue_config columns', () => {
      const db = getDb();
      const columns = db.prepare(
        "SELECT name FROM pragma_table_info('queue_config')"
      ).all() as Array<{ name: string }>;
      
      const columnNames = columns.map(c => c.name);
      
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('paused');
      expect(columnNames).toContain('max_concurrent');
      expect(columnNames).toContain('updated_at');
    });

    it('should have default queue config with state running', () => {
      const db = getDb();
      const config = db.prepare('SELECT * FROM queue_config WHERE id = 1').get() as QueueConfig;
      
      expect(config).toBeDefined();
      expect(config.id).toBe(1);
      expect(config.paused).toBe(0);
      expect(config.max_concurrent).toBe(1);
    });

    it('should enforce paused check constraint', () => {
      const db = getDb();
      
      // Valid paused values should work
      expect(() => {
        db.prepare("UPDATE queue_config SET paused = ? WHERE id = 1").run(1);
      }).not.toThrow();

      expect(() => {
        db.prepare("UPDATE queue_config SET paused = ? WHERE id = 1").run(0);
      }).not.toThrow();

      // Invalid paused value should fail
      expect(() => {
        db.prepare("UPDATE queue_config SET paused = ? WHERE id = 1").run(2);
      }).toThrow();
    });

    it('should enforce single row constraint on queue_config', () => {
      const db = getDb();
      
      // Trying to insert a second row should fail due to the CHECK constraint
      expect(() => {
        db.prepare("INSERT INTO queue_config (id, paused, max_concurrent) VALUES (?, ?, ?)")
          .run(2, 0, 1);
      }).toThrow();
    });

    it('should update queue config', () => {
      const db = getDb();
      
      db.prepare("UPDATE queue_config SET paused = ?, max_concurrent = ? WHERE id = 1")
        .run(1, 2);

      const config = db.prepare('SELECT * FROM queue_config WHERE id = 1').get() as QueueConfig;
      
      expect(config.paused).toBe(1);
      expect(config.max_concurrent).toBe(2);
    });
  });

  describe('CRUD Operations', () => {
    beforeEach(() => {
      const db = getDb();
      // Clean up test data
      db.prepare("DELETE FROM tasks WHERE id LIKE 'crud-%'").run();
    });

    it('should create a task', () => {
      const db = getDb();
      
      const result = db.prepare(
        'INSERT INTO tasks (id, title, priority) VALUES (?, ?, ?)'
      ).run('crud-001', 'CRUD Test Task', 'medium');

      expect(result.changes).toBe(1);
    });

    it('should read a task', () => {
      const db = getDb();
      
      db.prepare('INSERT INTO tasks (id, title, priority) VALUES (?, ?, ?)')
        .run('crud-002', 'CRUD Read Test', 'high');

      const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get('crud-002') as Task;
      
      expect(task.title).toBe('CRUD Read Test');
      expect(task.priority).toBe('high');
    });

    it('should update a task', () => {
      const db = getDb();
      
      db.prepare('INSERT INTO tasks (id, title, status) VALUES (?, ?, ?)')
        .run('crud-003', 'Original Title', 'backlog');

      const result = db.prepare('UPDATE tasks SET title = ?, status = ? WHERE id = ?')
        .run('Updated Title', 'queued', 'crud-003');

      expect(result.changes).toBe(1);

      const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get('crud-003') as Task;
      expect(task.title).toBe('Updated Title');
      expect(task.status).toBe('queued');
    });

    it('should delete a task', () => {
      const db = getDb();
      
      db.prepare('INSERT INTO tasks (id, title) VALUES (?, ?)')
        .run('crud-004', 'Task to Delete');

      const result = db.prepare('DELETE FROM tasks WHERE id = ?').run('crud-004');
      
      expect(result.changes).toBe(1);

      const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get('crud-004');
      expect(task).toBeUndefined();
    });
  });
});
