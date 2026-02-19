import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

const API_URL = 'http://localhost:3518';

describe('Queue Page', () => {
  // Helper to create a task
  const createTask = async (taskData: {
    title: string;
    priority?: string;
    status?: string;
    workflow?: string;
    queue_order?: number;
  }) => {
    const response = await fetch(`${API_URL}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(taskData),
    });
    return response.json();
  };

  // Helper to get queue
  const getQueue = async () => {
    const response = await fetch(`${API_URL}/api/queue`);
    return response.json();
  };

  describe('Queue API', () => {
    beforeEach(async () => {
      // Clean up queued tasks before each test
      await fetch(`${API_URL}/api/queue/cancel-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true }),
      });
    });

    it('GET /api/queue returns only queued tasks ordered by queue_order', async () => {
      // Create tasks with different statuses
      await createTask({ title: 'Task 1', status: 'queued', queue_order: 2 });
      await createTask({ title: 'Task 2', status: 'queued', queue_order: 1 });
      await createTask({ title: 'Task 3', status: 'backlog', queue_order: 0 });
      await createTask({ title: 'Task 4', status: 'running', queue_order: 0 });

      const result = await getQueue();

      expect(result.data).toHaveLength(2);
      expect(result.data[0].title).toBe('Task 2'); // queue_order: 1
      expect(result.data[1].title).toBe('Task 1'); // queue_order: 2
      expect(result.meta.total).toBe(2);
    });

    it('POST /api/queue reorders tasks', async () => {
      // Create tasks
      const task1 = await createTask({ title: 'Task A', status: 'queued', queue_order: 1 });
      const task2 = await createTask({ title: 'Task B', status: 'queued', queue_order: 2 });
      const task3 = await createTask({ title: 'Task C', status: 'queued', queue_order: 3 });

      // Reorder: swap first and last
      const response = await fetch(`${API_URL}/api/queue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orders: [
            { id: task1.data.id, queue_order: 3 },
            { id: task2.data.id, queue_order: 2 },
            { id: task3.data.id, queue_order: 1 },
          ],
        }),
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.data[0].id).toBe(task3.data.id);
      expect(result.data[2].id).toBe(task1.data.id);
    });

    it('POST /api/queue rejects reordering non-queued tasks', async () => {
      const task = await createTask({ title: 'Backlog Task', status: 'backlog' });

      const response = await fetch(`${API_URL}/api/queue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orders: [{ id: task.data.id, queue_order: 1 }],
        }),
      });

      expect(response.status).toBe(409);
    });

    it('POST /api/queue/start-next claims the next task atomically', async () => {
      // Create queued tasks
      await createTask({ title: 'First Task', status: 'queued', queue_order: 1 });
      await createTask({ title: 'Second Task', status: 'queued', queue_order: 2 });

      // Start next task
      const response = await fetch(`${API_URL}/api/queue/start-next`, {
        method: 'POST',
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.data).not.toBeNull();
      expect(result.data.title).toBe('First Task');
      expect(result.data.status).toBe('running');
      expect(result.data.started_at).not.toBeNull();

      // Verify queue now has only 1 task
      const queueResult = await getQueue();
      expect(queueResult.data).toHaveLength(1);
      expect(queueResult.data[0].title).toBe('Second Task');
    });

    it('POST /api/queue/start-next returns null when queue is empty', async () => {
      const response = await fetch(`${API_URL}/api/queue/start-next`, {
        method: 'POST',
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.data).toBeNull();
      expect(result.message).toBe('No queued tasks available');
    });

    it('POST /api/queue/cancel-all requires confirmation', async () => {
      const response = await fetch(`${API_URL}/api/queue/cancel-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(400);
      const result = await response.json();
      expect(result.error.code).toBe('CONFIRMATION_REQUIRED');
    });

    it('POST /api/queue/cancel-all cancels all queued tasks', async () => {
      // Create queued tasks
      await createTask({ title: 'Task 1', status: 'queued' });
      await createTask({ title: 'Task 2', status: 'queued' });
      await createTask({ title: 'Task 3', status: 'backlog' }); // Should not be cancelled

      const response = await fetch(`${API_URL}/api/queue/cancel-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true }),
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.data.cancelled).toBe(2);

      // Verify queue is empty
      const queueResult = await getQueue();
      expect(queueResult.data).toHaveLength(0);
    });

    it('POST /api/queue/cancel-all returns 0 when no queued tasks', async () => {
      const response = await fetch(`${API_URL}/api/queue/cancel-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true }),
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.data.cancelled).toBe(0);
      expect(result.message).toBe('No queued tasks to cancel');
    });
  });

  describe('Queue Page UI', () => {
    it('queue page loads successfully', async () => {
      const response = await fetch(`${API_URL}/queue`);
      expect(response.status).toBe(200);
      
      const html = await response.text();
      expect(html).toContain('Queue Management');
      expect(html).toContain('Bulk Actions');
    }, 10000);

    it('queue page includes drag-and-drop elements', async () => {
      const response = await fetch(`${API_URL}/queue`);
      const html = await response.text();
      
      // Check for key UI elements
      expect(html).toContain('Start Next');
      expect(html).toContain('Cancel All');
      expect(html).toContain('Refresh');
    }, 10000);
  });
});
