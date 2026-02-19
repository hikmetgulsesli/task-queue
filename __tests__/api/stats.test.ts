import { describe, it, expect } from 'vitest';

describe('Stats API', () => {
  describe('GET /api/stats', () => {
    it('should return statistics with all required fields', async () => {
      const response = await fetch('http://localhost:3518/api/stats');
      expect(response.status).toBe(200);
      const json = await response.json();
      
      expect(json.data).toBeDefined();
      expect(json.data.total).toBeDefined();
      expect(json.data.byStatus).toBeDefined();
      expect(json.data.byPriority).toBeDefined();
      expect(json.data.byWorkflow).toBeDefined();
      expect(json.data.successRate).toBeDefined();
      expect(json.data.averageCompletionTimeMinutes).toBeDefined();
    });

    it('should return correct status counts structure', async () => {
      const response = await fetch('http://localhost:3518/api/stats');
      const json = await response.json();
      
      expect(json.data.byStatus).toHaveProperty('backlog');
      expect(json.data.byStatus).toHaveProperty('queued');
      expect(json.data.byStatus).toHaveProperty('running');
      expect(json.data.byStatus).toHaveProperty('done');
      expect(json.data.byStatus).toHaveProperty('failed');
      expect(json.data.byStatus).toHaveProperty('cancelled');
    });

    it('should return correct priority counts structure', async () => {
      const response = await fetch('http://localhost:3518/api/stats');
      const json = await response.json();
      
      expect(json.data.byPriority).toHaveProperty('low');
      expect(json.data.byPriority).toHaveProperty('medium');
      expect(json.data.byPriority).toHaveProperty('high');
      expect(json.data.byPriority).toHaveProperty('critical');
    });

    it('should return workflow counts as array', async () => {
      const response = await fetch('http://localhost:3518/api/stats');
      const json = await response.json();
      
      expect(Array.isArray(json.data.byWorkflow)).toBe(true);
    });

    it('should return success rate as number', async () => {
      const response = await fetch('http://localhost:3518/api/stats');
      const json = await response.json();
      
      expect(typeof json.data.successRate).toBe('number');
      expect(json.data.successRate).toBeGreaterThanOrEqual(0);
      expect(json.data.successRate).toBeLessThanOrEqual(100);
    });

    it('should return average completion time as number or null', async () => {
      const response = await fetch('http://localhost:3518/api/stats');
      const json = await response.json();
      
      expect(
        json.data.averageCompletionTimeMinutes === null || 
        typeof json.data.averageCompletionTimeMinutes === 'number'
      ).toBe(true);
    });
  });
});
