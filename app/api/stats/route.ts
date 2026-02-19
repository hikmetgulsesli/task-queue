import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

interface StatsResult {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  averageDuration: number | null;
  successRate: number;
  workflowDistribution: Record<string, number>;
}

// Simple in-memory cache
let cachedStats: { data: StatsResult; timestamp: number } | null = null;
const CACHE_TTL_MS = 30000; // 30 seconds

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

export async function GET(_request: NextRequest): Promise<NextResponse> {
  try {
    // Check cache
    const now = Date.now();
    if (cachedStats && (now - cachedStats.timestamp) < CACHE_TTL_MS) {
      return NextResponse.json(cachedStats.data);
    }

    // Calculate fresh stats
    const stats = calculateStats();
    
    // Update cache
    cachedStats = { data: stats, timestamp: now };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error calculating stats:', error);
    return NextResponse.json(
      { 
        error: { 
          code: 'INTERNAL_ERROR', 
          message: 'Failed to calculate statistics' 
        } 
      },
      { status: 500 }
    );
  }
}
