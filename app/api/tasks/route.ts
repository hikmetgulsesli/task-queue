import { NextRequest, NextResponse } from 'next/server';
import { getDb, Task } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

// GET /api/tasks - List all tasks with optional filtering
export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    
    // Get filter parameters
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const workflow = searchParams.get('workflow');
    
    // Build query dynamically
    let query = 'SELECT * FROM tasks WHERE 1=1';
    const params: (string | number)[] = [];
    
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    
    if (priority) {
      query += ' AND priority = ?';
      params.push(priority);
    }
    
    if (workflow) {
      query += ' AND workflow = ?';
      params.push(workflow);
    }
    
    // Order by queue_order for queued items, then by created_at
    query += " ORDER BY CASE WHEN status = 'queued' THEN queue_order ELSE 999999 END, created_at DESC";
    
    const tasks = db.prepare(query).all(...params) as Task[];
    
    return NextResponse.json({ data: tasks });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json(
      { 
        error: { 
          code: 'INTERNAL_ERROR', 
          message: 'Failed to fetch tasks' 
        } 
      },
      { status: 500 }
    );
  }
}

// POST /api/tasks - Create a new task
export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();
    
    // Validation
    const errors: { field: string; message: string }[] = [];
    
    if (!body.title || typeof body.title !== 'string' || body.title.trim() === '') {
      errors.push({ field: 'title', message: 'Title is required' });
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
    
    const id = uuidv4();
    const now = new Date().toISOString();
    
    // Get max queue_order for queued items to append at end
    let queueOrder = 0;
    if (body.status === 'queued') {
      const maxOrder = db.prepare("SELECT MAX(queue_order) as max FROM tasks WHERE status = 'queued'").get() as { max: number | null };
      queueOrder = (maxOrder?.max ?? 0) + 1;
    }
    
    const task = {
      id,
      title: body.title.trim(),
      description: body.description ?? null,
      priority: body.priority ?? 'medium',
      status: body.status ?? 'backlog',
      workflow: body.workflow ?? 'feature-dev',
      target_repo: body.target_repo ?? null,
      scheduled_at: body.scheduled_at ?? null,
      started_at: null,
      completed_at: null,
      antfarm_run_id: null,
      queue_order: queueOrder,
      created_at: now,
      updated_at: now
    };
    
    db.prepare(`
      INSERT INTO tasks (
        id, title, description, priority, status, workflow, target_repo,
        scheduled_at, started_at, completed_at, antfarm_run_id, queue_order,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      task.id,
      task.title,
      task.description,
      task.priority,
      task.status,
      task.workflow,
      task.target_repo,
      task.scheduled_at,
      task.started_at,
      task.completed_at,
      task.antfarm_run_id,
      task.queue_order,
      task.created_at,
      task.updated_at
    );
    
    return NextResponse.json({ data: task }, { status: 201 });
  } catch (error) {
    console.error('Error creating task:', error);
    return NextResponse.json(
      { 
        error: { 
          code: 'INTERNAL_ERROR', 
          message: 'Failed to create task' 
        } 
      },
      { status: 500 }
    );
  }
}
