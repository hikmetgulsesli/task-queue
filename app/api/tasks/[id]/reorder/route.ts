import { NextRequest, NextResponse } from 'next/server';
import { getDb, Task } from '@/lib/db';

interface RouteParams {
  params: { id: string };
}

// POST /api/tasks/[id]/reorder - Update task queue_order position
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params;
    const body = await request.json();
    const { queue_order } = body;

    // Validate input
    if (typeof queue_order !== 'number' || !Number.isInteger(queue_order)) {
      return NextResponse.json(
        { 
          error: { 
            code: 'VALIDATION_ERROR', 
            message: 'queue_order must be an integer',
            details: [{ field: 'queue_order', message: 'Must be an integer' }]
          } 
        },
        { status: 400 }
      );
    }

    const db = getDb();

    // Use transaction for atomic operation
    const updateTask = db.transaction(() => {
      // Check if task exists
      const existingTask = db.prepare('SELECT id FROM tasks WHERE id = ?').get(id);
      if (!existingTask) {
        return { error: 'NOT_FOUND', message: `Task with id ${id} not found` };
      }

      // Update queue_order
      const result = db.prepare(
        'UPDATE tasks SET queue_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      ).run(queue_order, id);

      if (result.changes === 0) {
        return { error: 'UPDATE_FAILED', message: 'Failed to update task queue order' };
      }

      // Return updated task
      const updatedTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Task;
      return { success: true, task: updatedTask };
    });

    const result = updateTask();

    if ('error' in result) {
      if (result.error === 'NOT_FOUND') {
        return NextResponse.json(
          { error: { code: 'NOT_FOUND', message: result.message } },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: { code: result.error, message: result.message } },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: result.task });
  } catch (error) {
    console.error('Error reordering task:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to reorder task' } },
      { status: 500 }
    );
  }
}
