import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { AppError } from '@/lib/errors';

export async function GET(request: NextRequest) {
  try {
    const db = getDb();

    // Get counts by status
    const statusCounts = db.prepare(`
      SELECT status, COUNT(*) as count 
      FROM tasks 
      GROUP BY status
    `).all() as { status: string; count: number }[];

    const statusMap: Record<string, number> = {
      backlog: 0,
      queued: 0,
      running: 0,
      done: 0,
      failed: 0,
      cancelled: 0,
    };
    for (const row of statusCounts) {
      statusMap[row.status] = row.count;
    }

    // Get counts by priority
    const priorityCounts = db.prepare(`
      SELECT priority, COUNT(*) as count 
      FROM tasks 
      GROUP BY priority
    `).all() as { priority: string; count: number }[];

    const priorityMap: Record<string, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };
    for (const row of priorityCounts) {
      priorityMap[row.priority] = row.count;
    }

    // Get counts by workflow
    const workflowCounts = db.prepare(`
      SELECT workflow, COUNT(*) as count 
      FROM tasks 
      GROUP BY workflow
    `).all() as { workflow: string; count: number }[];

    // Calculate success rate
    const doneCount = statusMap.done || 0;
    const failedCount = statusMap.failed || 0;
    const totalCompleted = doneCount + failedCount;
    const successRate = totalCompleted > 0 ? (doneCount / totalCompleted) * 100 : 0;

    // Calculate average completion time (in minutes)
    const avgCompletionResult = db.prepare(`
      SELECT AVG(
        (julianday(completed_at) - julianday(started_at)) * 24 * 60
      ) as avg_minutes
      FROM tasks
      WHERE completed_at IS NOT NULL 
        AND started_at IS NOT NULL
        AND status = 'done'
    `).get() as { avg_minutes: number | null };

    const avgCompletionTime = avgCompletionResult.avg_minutes 
      ? Math.round(avgCompletionResult.avg_minutes * 10) / 10 
      : null;

    // Get total tasks
    const totalResult = db.prepare('SELECT COUNT(*) as count FROM tasks').get() as { count: number };
    const total = totalResult.count;

    return NextResponse.json({
      data: {
        total,
        byStatus: statusMap,
        byPriority: priorityMap,
        byWorkflow: workflowCounts.map(w => ({
          workflow: w.workflow,
          count: w.count,
        })),
        successRate: Math.round(successRate * 100) / 100,
        averageCompletionTimeMinutes: avgCompletionTime,
      },
    });
  } catch (err) {
    console.error('GET /api/stats error:', err);
    if (err instanceof AppError) {
      return NextResponse.json(err.toJSON(), { status: err.statusCode });
    }
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}
