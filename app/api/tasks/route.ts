import { NextRequest, NextResponse } from 'next/server';
import { getDb, Task } from '@/lib/db';
import { AppError, NotFoundError, ValidationError } from '@/lib/errors';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const workflow = searchParams.get('workflow');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    const db = getDb();

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

    // Get total count
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as count');
    const countResult = db.prepare(countQuery).get(...params) as { count: number };
    const total = countResult.count;

    // Add ordering and pagination
    query += ' ORDER BY queue_order ASC, created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const tasks = db.prepare(query).all(...params) as Task[];

    return NextResponse.json({
      data: tasks,
      meta: {
        limit,
        offset,
        total,
      },
    });
  } catch (err) {
    console.error('GET /api/tasks error:', err);
    if (err instanceof AppError) {
      return NextResponse.json(err.toJSON(), { status: err.statusCode });
    }
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    const errors: Array<{ field: string; message: string }> = [];
    
    if (!body.title || typeof body.title !== 'string' || body.title.trim().length === 0) {
      errors.push({ field: 'title', message: 'Title is required' });
    }

    if (body.priority && !['low', 'medium', 'high', 'critical'].includes(body.priority)) {
      errors.push({ field: 'priority', message: 'Priority must be one of: low, medium, high, critical' });
    }

    if (body.status && !['backlog', 'queued', 'running', 'done', 'failed', 'cancelled'].includes(body.status)) {
      errors.push({ field: 'status', message: 'Status must be one of: backlog, queued, running, done, failed, cancelled' });
    }

    if (errors.length > 0) {
      throw new ValidationError('Invalid input', errors);
    }

    const { v4: uuidv4 } = require('uuid');
    
    const db = getDb();
    const now = new Date().toISOString();
    
    const task = {
      id: uuidv4(),
      title: body.title.trim(),
      description: body.description || null,
      priority: body.priority || 'medium',
      status: body.status || 'backlog',
      workflow: body.workflow || 'feature-dev',
      target_repo: body.target_repo || null,
      scheduled_at: body.scheduled_at || null,
      queue_order: body.queue_order || 0,
      created_at: now,
      updated_at: now,
    };

    const stmt = db.prepare(`
      INSERT INTO tasks (id, title, description, priority, status, workflow, target_repo, scheduled_at, queue_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      task.id,
      task.title,
      task.description,
      task.priority,
      task.status,
      task.workflow,
      task.target_repo,
      task.scheduled_at,
      task.queue_order,
      task.created_at,
      task.updated_at
    );

    return NextResponse.json({ data: task }, { status: 201 });
  } catch (err) {
    console.error('POST /api/tasks error:', err);
    if (err instanceof AppError) {
      return NextResponse.json(err.toJSON(), { status: err.statusCode });
    }
    if (err instanceof SyntaxError) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'Invalid JSON in request body' } },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}
