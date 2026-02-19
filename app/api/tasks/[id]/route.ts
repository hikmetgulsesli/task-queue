import { NextRequest, NextResponse } from 'next/server';
import { getDb, Task } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/tasks/:id - Get a single task by ID
export async function GET(
  _request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const db = getDb();

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Task | undefined;

    if (!task) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Task not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({ task });
  } catch (error) {
    console.error('Error fetching task:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch task' } },
      { status: 500 }
    );
  }
}

// PATCH /api/tasks/:id - Update a task
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const body = await request.json();

    const db = getDb();

    // Check if task exists
    const existingTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Task | undefined;
    if (!existingTask) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Task not found' } },
        { status: 404 }
      );
    }

    // Build update query dynamically based on provided fields
    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    if (body.title !== undefined) {
      if (!body.title.trim()) {
        return NextResponse.json(
          { error: { code: 'VALIDATION_ERROR', message: 'Title cannot be empty' } },
          { status: 400 }
        );
      }
      updates.push('title = ?');
      values.push(body.title.trim());
    }

    if (body.description !== undefined) {
      updates.push('description = ?');
      values.push(body.description.trim() || null);
    }

    if (body.priority !== undefined) {
      const validPriorities = ['low', 'medium', 'high', 'critical'];
      if (!validPriorities.includes(body.priority)) {
        return NextResponse.json(
          { error: { code: 'VALIDATION_ERROR', message: 'Invalid priority' } },
          { status: 400 }
        );
      }
      updates.push('priority = ?');
      values.push(body.priority);
    }

    if (body.status !== undefined) {
      const validStatuses = ['backlog', 'queued', 'running', 'done', 'failed', 'cancelled'];
      if (!validStatuses.includes(body.status)) {
        return NextResponse.json(
          { error: { code: 'VALIDATION_ERROR', message: 'Invalid status' } },
          { status: 400 }
        );
      }
      updates.push('status = ?');
      values.push(body.status);

      // Update started_at if transitioning to running
      if (body.status === 'running' && !existingTask.started_at) {
        updates.push('started_at = ?');
        values.push(new Date().toISOString());
      }

      // Update completed_at if transitioning to done or failed
      if ((body.status === 'done' || body.status === 'failed') && !existingTask.completed_at) {
        updates.push('completed_at = ?');
        values.push(new Date().toISOString());
      }
    }

    if (body.workflow !== undefined) {
      updates.push('workflow = ?');
      values.push(body.workflow);
    }

    if (body.target_repo !== undefined) {
      updates.push('target_repo = ?');
      values.push(body.target_repo.trim() || null);
    }

    if (body.scheduled_at !== undefined) {
      updates.push('scheduled_at = ?');
      values.push(body.scheduled_at || null);
    }

    if (body.queue_order !== undefined) {
      updates.push('queue_order = ?');
      values.push(body.queue_order);
    }

    if (body.antfarm_run_id !== undefined) {
      updates.push('antfarm_run_id = ?');
      values.push(body.antfarm_run_id || null);
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'No fields to update' } },
        { status: 400 }
      );
    }

    // Always update the updated_at timestamp
    updates.push('updated_at = ?');
    values.push(new Date().toISOString());

    // Add the task ID to values
    values.push(id);

    const sql = `UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`;
    db.prepare(sql).run(...values);

    // Fetch and return the updated task
    const updatedTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Task;

    return NextResponse.json({ task: updatedTask });
  } catch (error) {
    console.error('Error updating task:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to update task' } },
      { status: 500 }
    );
  }
}

// DELETE /api/tasks/:id - Delete a task
export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const db = getDb();

    // Check if task exists
    const existingTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Task | undefined;
    if (!existingTask) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Task not found' } },
        { status: 404 }
      );
    }

    // Delete the task
    db.prepare('DELETE FROM tasks WHERE id = ?').run(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting task:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to delete task' } },
      { status: 500 }
    );
  }
}
