import { NextRequest, NextResponse } from 'next/server';
import { getDb, Task } from '@/lib/db';
import { AppError } from '@/lib/errors';

/**
 * POST /api/queue/cancel-all
 * Cancels all queued tasks (changes status from 'queued' to 'cancelled')
 * Requires confirmation: { confirm: true }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.confirm || body.confirm !== true) {
      return NextResponse.json(
        { 
          error: { 
            code: 'CONFIRMATION_REQUIRED', 
            message: 'This action requires confirmation. Set confirm: true to proceed.' 
          } 
        },
        { status: 400 }
      );
    }

    const db = getDb();
    const now = new Date().toISOString();

    // Get count of queued tasks before cancellation
    const countResult = db
      .prepare("SELECT COUNT(*) as count FROM tasks WHERE status = 'queued'")
      .get() as { count: number };

    const cancelledCount = countResult.count;

    if (cancelledCount === 0) {
      return NextResponse.json({
        data: { cancelled: 0 },
        message: 'No queued tasks to cancel',
      });
    }

    // Cancel all queued tasks
    db.prepare(`
      UPDATE tasks 
      SET status = 'cancelled', completed_at = ?, updated_at = ? 
      WHERE status = 'queued'
    `).run(now, now);

    return NextResponse.json({
      data: { cancelled: cancelledCount },
      message: `${cancelledCount} task(s) cancelled successfully`,
    });
  } catch (err) {
    console.error('POST /api/queue/cancel-all error:', err);
    if (err instanceof AppError) {
      return NextResponse.json(err.toJSON(), { status: err.statusCode });
    }
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}
