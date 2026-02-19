import { NextRequest, NextResponse } from 'next/server';
import { getDb, Task } from '@/lib/db';
import { AppError, NotFoundError, ConflictError } from '@/lib/errors';

/**
 * POST /api/queue/start-next
 * Atomically claims the next task in the queue (lowest queue_order)
 * Returns the claimed task or null if queue is empty
 */
export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const now = new Date().toISOString();

    // Atomically get and update the next queued task
    // Use a transaction to ensure atomicity
    let claimedTask: Task | undefined;

    db.transaction(() => {
      // Find the next queued task (lowest queue_order)
      const nextTask = db
        .prepare(`
          SELECT * FROM tasks 
          WHERE status = 'queued' 
          ORDER BY queue_order ASC, created_at ASC 
          LIMIT 1
        `)
        .get() as Task | undefined;

      if (!nextTask) {
        return;
      }

      // Update the task to running status
      db.prepare(`
        UPDATE tasks 
        SET status = 'running', started_at = ?, updated_at = ? 
        WHERE id = ?
      `).run(now, now, nextTask.id);

      // Retrieve the updated task
      claimedTask = db
        .prepare('SELECT * FROM tasks WHERE id = ?')
        .get(nextTask.id) as Task;
    })();

    if (!claimedTask) {
      return NextResponse.json({
        data: null,
        message: 'No queued tasks available',
      });
    }

    return NextResponse.json({
      data: claimedTask,
      message: 'Task claimed successfully',
    });
  } catch (err) {
    console.error('POST /api/queue/start-next error:', err);
    if (err instanceof AppError) {
      return NextResponse.json(err.toJSON(), { status: err.statusCode });
    }
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}
