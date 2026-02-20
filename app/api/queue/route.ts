import { NextRequest, NextResponse } from 'next/server';
import { getDb, Task } from '@/lib/db';
import { AppError, NotFoundError, ConflictError } from '@/lib/errors';

/**
 * GET /api/queue
 * Returns queued tasks ordered by queue_order
 */
export async function GET(request: NextRequest) {
  try {
    const db = getDb();

    // Get only queued tasks, ordered by queue_order
    const tasks = db
      .prepare(`
        SELECT * FROM tasks 
        WHERE status = 'queued' 
        ORDER BY queue_order ASC, created_at ASC
      `)
      .all() as Task[];

    return NextResponse.json({
      data: tasks,
      meta: {
        total: tasks.length,
      },
    });
  } catch (err) {
    console.error('GET /api/queue error:', err);
    if (err instanceof AppError) {
      return NextResponse.json(err.toJSON(), { status: err.statusCode });
    }
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/queue/reorder
 * Reorders tasks in the queue
 * Body: { orders: [{ id: string, queue_order: number }] }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.orders || !Array.isArray(body.orders) || body.orders.length === 0) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'orders array is required' } },
        { status: 400 }
      );
    }

    const db = getDb();

    // Validate all tasks exist and are in queued status
    for (const item of body.orders) {
      if (!item.id || typeof item.queue_order !== 'number') {
        return NextResponse.json(
          { error: { code: 'VALIDATION_ERROR', message: 'Each order must have id and queue_order' } },
          { status: 400 }
        );
      }

      const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(item.id) as Task | undefined;
      if (!task) {
        throw new NotFoundError('Task', item.id);
      }
      if (task.status !== 'queued') {
        return NextResponse.json(
          { error: { code: 'CONFLICT', message: `Task ${item.id} is not in queued status` } },
          { status: 409 }
        );
      }
    }

    // Update queue_order for all tasks in a transaction
    const updateStmt = db.prepare(
      'UPDATE tasks SET queue_order = ?, updated_at = ? WHERE id = ?'
    );

    const now = new Date().toISOString();
    
    db.transaction(() => {
      for (const item of body.orders) {
        updateStmt.run(item.queue_order, now, item.id);
      }
    })();

    // Return updated queue
    const tasks = db
      .prepare(`
        SELECT * FROM tasks 
        WHERE status = 'queued' 
        ORDER BY queue_order ASC, created_at ASC
      `)
      .all() as Task[];

    return NextResponse.json({
      data: tasks,
      meta: {
        total: tasks.length,
      },
    });
  } catch (err) {
    console.error('POST /api/queue/reorder error:', err);
    if (err instanceof AppError) {
      return NextResponse.json(err.toJSON(), { status: err.statusCode });
    }
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}
