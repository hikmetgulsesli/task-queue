import { NextRequest, NextResponse } from 'next/server';
import { getDb, Task } from '@/lib/db';
import { AppError, NotFoundError, ValidationError } from '@/lib/errors';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    
    const db = getDb();
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Task | undefined;

    if (!task) {
      throw new NotFoundError('Task', id);
    }

    return NextResponse.json({ data: task });
  } catch (err) {
    console.error('GET /api/tasks/[id] error:', err);
    if (err instanceof AppError) {
      return NextResponse.json(err.toJSON(), { status: err.statusCode });
    }
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();

    const db = getDb();
    
    // Check if task exists
    const existingTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Task | undefined;

    if (!existingTask) {
      throw new NotFoundError('Task', id);
    }

    // Validate input
    const errors: Array<{ field: string; message: string }> = [];

    if (body.priority && !['low', 'medium', 'high', 'critical'].includes(body.priority)) {
      errors.push({ field: 'priority', message: 'Priority must be one of: low, medium, high, critical' });
    }

    if (body.status && !['backlog', 'queued', 'running', 'done', 'failed', 'cancelled'].includes(body.status)) {
      errors.push({ field: 'status', message: 'Status must be one of: backlog, queued, running, done, failed, cancelled' });
    }

    if (errors.length > 0) {
      throw new ValidationError('Invalid input', errors);
    }

    // Build update query dynamically
    const updates: string[] = [];
    const queryParams: (string | number | null)[] = [];

    if (body.title !== undefined) {
      if (typeof body.title !== 'string' || body.title.trim().length === 0) {
        errors.push({ field: 'title', message: 'Title cannot be empty' });
      } else {
        updates.push('title = ?');
        queryParams.push(body.title.trim());
      }
    }

    if (body.description !== undefined) {
      updates.push('description = ?');
      queryParams.push(body.description || null);
    }

    if (body.priority !== undefined) {
      updates.push('priority = ?');
      queryParams.push(body.priority);
    }

    if (body.status !== undefined) {
      updates.push('status = ?');
      queryParams.push(body.status);
    }

    if (body.workflow !== undefined) {
      updates.push('workflow = ?');
      queryParams.push(body.workflow);
    }

    if (body.target_repo !== undefined) {
      updates.push('target_repo = ?');
      queryParams.push(body.target_repo || null);
    }

    if (body.scheduled_at !== undefined) {
      updates.push('scheduled_at = ?');
      queryParams.push(body.scheduled_at || null);
    }

    if (body.queue_order !== undefined) {
      updates.push('queue_order = ?');
      queryParams.push(body.queue_order);
    }

    if (body.status === 'running' && existingTask.status !== 'running') {
      updates.push('started_at = ?');
      queryParams.push(new Date().toISOString());
    }

    if (body.status === 'done' || body.status === 'failed' || body.status === 'cancelled') {
      if (existingTask.status !== 'done' && existingTask.status !== 'failed' && existingTask.status !== 'cancelled') {
        updates.push('completed_at = ?');
        queryParams.push(new Date().toISOString());
      }
    }

    if (errors.length > 0) {
      throw new ValidationError('Invalid input', errors);
    }

    if (updates.length === 0) {
      return NextResponse.json({ data: existingTask });
    }

    updates.push('updated_at = ?');
    queryParams.push(new Date().toISOString());
    queryParams.push(id);

    const query = `UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`;
    db.prepare(query).run(...queryParams);

    const updatedTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Task;

    return NextResponse.json({ data: updatedTask });
  } catch (err) {
    console.error('PATCH /api/tasks/[id] error:', err);
    if (err instanceof AppError) {
      return NextResponse.json(err.toJSON(), { status: err.statusCode });
    }
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    
    const db = getDb();
    
    // Check if task exists
    const existingTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Task | undefined;

    if (!existingTask) {
      throw new NotFoundError('Task', id);
    }

    // Hard delete
    db.prepare('DELETE FROM tasks WHERE id = ?').run(id);

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error('DELETE /api/tasks/[id] error:', err);
    if (err instanceof AppError) {
      return NextResponse.json(err.toJSON(), { status: err.statusCode });
    }
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}
