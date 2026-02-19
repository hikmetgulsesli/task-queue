import { NextRequest, NextResponse } from 'next/server';
import { getDb, Task } from '@/lib/db';

// POST /api/queue/next - Atomically claim next queued task
export async function POST() {
  try {
    const db = getDb();

    // Use transaction for atomic claim operation
    const claimNextTask = db.transaction(() => {
      // Check queue state
      const queueConfig = db.prepare('SELECT state FROM queue_config WHERE id = 1').get() as { state: string } | undefined;
      
      if (queueConfig?.state === 'paused') {
        return { error: 'QUEUE_PAUSED', message: 'Queue is currently paused' };
      }

      // Check current running tasks count
      const runningCount = db.prepare(
        "SELECT COUNT(*) as count FROM tasks WHERE status = 'running'"
      ).get() as { count: number };

      const maxConcurrent = db.prepare(
        'SELECT max_concurrent FROM queue_config WHERE id = 1'
      ).get() as { max_concurrent: number };

      if (runningCount.count >= maxConcurrent.max_concurrent) {
        return { 
          error: 'MAX_CONCURRENT_REACHED', 
          message: 'Maximum concurrent tasks reached',
          data: { running: runningCount.count, max: maxConcurrent.max_concurrent }
        };
      }

      // Find next queued task with lowest queue_order
      const nextTask = db.prepare(
        `SELECT * FROM tasks 
         WHERE status = 'queued' 
         ORDER BY queue_order ASC, created_at ASC 
         LIMIT 1`
      ).get() as Task | undefined;

      if (!nextTask) {
        return { error: 'NO_TASKS_AVAILABLE', message: 'No queued tasks available' };
      }

      // Atomically update task to running status and set started_at
      const updateResult = db.prepare(
        `UPDATE tasks 
         SET status = 'running', 
             started_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP 
         WHERE id = ? AND status = 'queued'`
      ).run(nextTask.id);

      if (updateResult.changes === 0) {
        // Task was claimed by another process
        return { error: 'TASK_CLAIM_FAILED', message: 'Task was claimed by another process' };
      }

      // Return the claimed task
      const claimedTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(nextTask.id) as Task;
      return { success: true, task: claimedTask };
    });

    const result = claimNextTask();

    if ('error' in result) {
      const statusCode = result.error === 'NO_TASKS_AVAILABLE' ? 404 :
                        result.error === 'QUEUE_PAUSED' ? 503 :
                        result.error === 'MAX_CONCURRENT_REACHED' ? 429 : 409;
      
      return NextResponse.json(
        { 
          error: { 
            code: result.error, 
            message: result.message,
            ...(result.data && { details: result.data })
          } 
        },
        { status: statusCode }
      );
    }

    return NextResponse.json({ data: result.task });
  } catch (error) {
    console.error('Error claiming next task:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to claim next task' } },
      { status: 500 }
    );
  }
}
