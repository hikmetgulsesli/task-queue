import { NextRequest, NextResponse } from 'next/server';
import { getDb, Task } from '@/lib/db';

// GET /api/tasks/:id - Get a single task
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const db = getDb();
    const { id } = params;
    
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Task | undefined;
    
    if (!task) {
      return NextResponse.json(
        { 
          error: { 
            code: 'NOT_FOUND', 
            message: `Task with id ${id} not found` 
          } 
        },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ data: task });
  } catch (error) {
    console.error('Error fetching task:', error);
    return NextResponse.json(
      { 
        error: { 
          code: 'INTERNAL_ERROR', 
          message: 'Failed to fetch task' 
        } 
      },
      { status: 500 }
    );
  }
}

// PATCH /api/tasks/:id - Update a task
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const db = getDb();
    const { id } = params;
    const body = await request.json();
    
    // Check if task exists
    const existingTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Task | undefined;
    
    if (!existingTask) {
      return NextResponse.json(
        { 
          error: { 
            code: 'NOT_FOUND', 
            message: `Task with id ${id} not found` 
          } 
        },
        { status: 404 }
      );
    }
    
    // Validation
    const errors: { field: string; message: string }[] = [];
    
    if (body.title !== undefined && (typeof body.title !== 'string' || body.title.trim() === '')) {
      errors.push({ field: 'title', message: 'Title cannot be empty' });
    }
    
    const validPriorities = ['low', 'medium', 'high', 'critical'];
    if (body.priority && !validPriorities.includes(body.priority)) {
      errors.push({ field: 'priority', message: `Priority must be one of: ${validPriorities.join(', ')}` });
    }
    
    const validStatuses = ['backlog', 'queued', 'running', 'done', 'failed', 'cancelled'];
    if (body.status && !validStatuses.includes(body.status)) {
      errors.push({ field: 'status', message: `Status must be one of: ${validStatuses.join(', ')}` });
    }
    
    if (errors.length > 0) {
      return NextResponse.json(
        { 
          error: { 
            code: 'VALIDATION_ERROR', 
            message: 'Validation failed',
            details: errors
          } 
        },
        { status: 400 }
      );
    }
    
    const now = new Date().toISOString();
    
    // Build update query dynamically
    const updates: string[] = [];
    const values: (string | number | null)[] = [];
    
    if (body.title !== undefined) {
      updates.push('title = ?');
      values.push(body.title.trim());
    }
    
    if (body.description !== undefined) {
      updates.push('description = ?');
      values.push(body.description);
    }
    
    if (body.priority !== undefined) {
      updates.push('priority = ?');
      values.push(body.priority);
    }
    
    if (body.status !== undefined) {
      updates.push('status = ?');
      values.push(body.status);
      
      // Auto-set timestamps based on status changes
      if (body.status === 'running' && existingTask.status !== 'running') {
        updates.push('started_at = ?');
        values.push(now);
      }
      
      if ((body.status === 'done' || body.status === 'failed' || body.status === 'cancelled') && !existingTask.completed_at) {
        updates.push('completed_at = ?');
        values.push(now);
      }
      
      // Handle queue_order when moving to/from queued status
      if (body.status === 'queued' && existingTask.status !== 'queued') {
        const maxOrder = db.prepare("SELECT MAX(queue_order) as max FROM tasks WHERE status = 'queued'").get() as { max: number | null };
        updates.push('queue_order = ?');
        values.push((maxOrder?.max ?? 0) + 1);
      } else if (body.status !== 'queued' && existingTask.status === 'queued') {
        updates.push('queue_order = ?');
        values.push(0);
      }
    }
    
    if (body.workflow !== undefined) {
      updates.push('workflow = ?');
      values.push(body.workflow);
    }
    
    if (body.target_repo !== undefined) {
      updates.push('target_repo = ?');
      values.push(body.target_repo);
    }
    
    if (body.scheduled_at !== undefined) {
      updates.push('scheduled_at = ?');
      values.push(body.scheduled_at);
    }
    
    if (body.antfarm_run_id !== undefined) {
      updates.push('antfarm_run_id = ?');
      values.push(body.antfarm_run_id);
    }
    
    if (body.queue_order !== undefined && existingTask.status === 'queued') {
      updates.push('queue_order = ?');
      values.push(body.queue_order);
    }
    
    updates.push('updated_at = ?');
    values.push(now);
    
    // Add id to values
    values.push(id);
    
    db.prepare(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    
    // Fetch and return updated task
    const updatedTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Task;
    
    return NextResponse.json({ data: updatedTask });
  } catch (error) {
    console.error('Error updating task:', error);
    return NextResponse.json(
      { 
        error: { 
          code: 'INTERNAL_ERROR', 
          message: 'Failed to update task' 
        } 
      },
      { status: 500 }
    );
  }
}

// DELETE /api/tasks/:id - Delete a task
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const db = getDb();
    const { id } = params;
    
    // Check if task exists
    const existingTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Task | undefined;
    
    if (!existingTask) {
      return NextResponse.json(
        { 
          error: { 
            code: 'NOT_FOUND', 
            message: `Task with id ${id} not found` 
          } 
        },
        { status: 404 }
      );
    }
    
    db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
    
    return NextResponse.json({ data: { deleted: true } });
  } catch (error) {
    console.error('Error deleting task:', error);
    return NextResponse.json(
      { 
        error: { 
          code: 'INTERNAL_ERROR', 
          message: 'Failed to delete task' 
        } 
      },
      { status: 500 }
    );
  }
}
