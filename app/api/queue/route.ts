import { NextRequest, NextResponse } from 'next/server';
import { getQueueStatus, setQueuePaused, reorderTasks } from '@/lib/db';

// GET /api/queue/status - Get queue status
export async function GET() {
  try {
    const status = getQueueStatus();
    return NextResponse.json(status);
  } catch (error) {
    console.error('Error getting queue status:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to get queue status' } },
      { status: 500 }
    );
  }
}

// POST /api/queue/action - Handle pause, resume, and reorder actions
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'pause') {
      setQueuePaused(true);
      return NextResponse.json({ success: true, paused: true });
    }

    if (action === 'resume') {
      setQueuePaused(false);
      return NextResponse.json({ success: true, paused: false });
    }

    if (action === 'reorder') {
      const { orders } = body;

      if (!Array.isArray(orders)) {
        return NextResponse.json(
          { error: { code: 'VALIDATION_ERROR', message: 'orders must be an array' } },
          { status: 400 }
        );
      }

      // Validate each order item
      for (const item of orders) {
        if (!item.id || typeof item.id !== 'string') {
          return NextResponse.json(
            { error: { code: 'VALIDATION_ERROR', message: 'Each order item must have an id string' } },
            { status: 400 }
          );
        }
        if (typeof item.order !== 'number') {
          return NextResponse.json(
            { error: { code: 'VALIDATION_ERROR', message: 'Each order item must have an order number' } },
            { status: 400 }
          );
        }
      }

      reorderTasks(orders);
      return NextResponse.json({ success: true, updated: orders.length });
    }

    return NextResponse.json(
      { error: { code: 'INVALID_ACTION', message: 'Invalid action. Use pause, resume, or reorder' } },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error processing queue action:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to process queue action' } },
      { status: 500 }
    );
  }
}
