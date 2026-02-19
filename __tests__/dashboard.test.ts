import { describe, it, expect } from 'vitest';

const API_BASE = process.env.TEST_API_URL || 'http://localhost:3518';

describe('Dashboard', () => {
  describe('Stats API', () => {
    it('should return stats with required fields', async () => {
      const response = await fetch(`${API_BASE}/api/stats`);
      expect(response.status).toBe(200);
      
      const json = await response.json();
      expect(json.data).toBeDefined();
      
      // Check required fields
      expect(typeof json.data.total).toBe('number');
      expect(json.data.byStatus).toBeDefined();
      expect(json.data.byPriority).toBeDefined();
      expect(typeof json.data.successRate).toBe('number');
    });

    it('should return status breakdown with all statuses', async () => {
      const response = await fetch(`${API_BASE}/api/stats`);
      const json = await response.json();
      
      const statuses = ['backlog', 'queued', 'running', 'done', 'failed', 'cancelled'];
      for (const status of statuses) {
        expect(typeof json.data.byStatus[status]).toBe('number');
      }
    });

    it('should return priority breakdown', async () => {
      const response = await fetch(`${API_BASE}/api/stats`);
      const json = await response.json();
      
      const priorities = ['low', 'medium', 'high', 'critical'];
      for (const priority of priorities) {
        expect(typeof json.data.byPriority[priority]).toBe('number');
      }
    });

    it('should calculate success rate between 0 and 100', async () => {
      const response = await fetch(`${API_BASE}/api/stats`);
      const json = await response.json();
      
      expect(json.data.successRate).toBeGreaterThanOrEqual(0);
      expect(json.data.successRate).toBeLessThanOrEqual(100);
    });
  });

  describe('Recent Tasks API', () => {
    it('should return tasks list', async () => {
      const response = await fetch(`${API_BASE}/api/tasks?limit=10`);
      expect(response.status).toBe(200);
      
      const json = await response.json();
      expect(json.data).toBeDefined();
      expect(Array.isArray(json.data)).toBe(true);
      expect(json.meta).toBeDefined();
      expect(typeof json.meta.total).toBe('number');
    });

    it('should respect limit parameter', async () => {
      const response = await fetch(`${API_BASE}/api/tasks?limit=5`);
      const json = await response.json();
      
      expect(json.data.length).toBeLessThanOrEqual(5);
      expect(json.meta.limit).toBe(5);
    });
  });

  describe('Dashboard Stats Display', () => {
    it('should have all required stat fields for dashboard cards', async () => {
      const response = await fetch(`${API_BASE}/api/stats`);
      const json = await response.json();
      
      // Stats cards show: Total Tasks, Queued, Running, Done, Failed
      expect(typeof json.data.total).toBe('number');
      expect(typeof json.data.byStatus.queued).toBe('number');
      expect(typeof json.data.byStatus.running).toBe('number');
      expect(typeof json.data.byStatus.done).toBe('number');
      expect(typeof json.data.byStatus.failed).toBe('number');
    });
  });
});
