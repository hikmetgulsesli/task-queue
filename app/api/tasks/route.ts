import { NextRequest, NextResponse } from 'next/server';
import { getDb, Task } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

interface TasksFilter {
  status?: string;
  priority?: string;
  workflow?: string;
}

interface CreateTaskInput {
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  workflow?: 'feature-dev' | 'bug-fix' | 'security-audit';
  target_repo?: string;
  scheduled_at?: string;
}

function buildQuery(filter: TasksFilter): { sql: string; params: (string | number)[] } {
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (filter.status && filter.status !== 'all') {
    conditions.push('status = ?');
    params.push(filter.status);
  }

  if (filter.priority && filter.priority !== 'all') {
    conditions.push('priority = ?');
    params.push(filter.priority);
  }

  if (filter.workflow && filter.workflow !== 'all') {
    conditions.push('workflow = ?');
    params.push(filter.workflow);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `SELECT * FROM tasks ${whereClause} ORDER BY created_at DESC`;

  return { sql, params };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    
    const filter: TasksFilter = {
      status: searchParams.get('status') ?? undefined,
      priority: searchParams.get('priority') ?? undefined,
      workflow: searchParams.get('workflow') ?? undefined,
    };

    const db = getDb();
    const { sql, params } = buildQuery(filter);
    
    const tasks = db.prepare(sql).all(...params) as Task[];

    return NextResponse.json({ tasks });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch tasks' } },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json() as CreateTaskInput;

    // Validation
    const errors: Array<{ field: string; message: string }> = [];

    if (!body.title || typeof body.title !== 'string' || body.title.trim().length === 0) {
      errors.push({ field: 'title', message: 'Title is required' });
    } else if (body.title.trim().length > 200) {
      errors.push({ field: 'title', message: 'Title must be 200 characters or less' });
    }

    if (body.description !== undefined && typeof body.description !== 'string') {
      errors.push({ field: 'description', message: 'Description must be a string' });
    }

    const validPriorities = ['low', 'medium', 'high', 'critical'];
    if (body.priority !== undefined && !validPriorities.includes(body.priority)) {
      errors.push({ field: 'priority', message: 'Priority must be one of: low, medium, high, critical' });
    }

    const validWorkflows = ['feature-dev', 'bug-fix', 'security-audit'];
    if (body.workflow !== undefined && !validWorkflows.includes(body.workflow)) {
      errors.push({ field: 'workflow', message: 'Workflow must be one of: feature-dev, bug-fix, security-audit' });
    }

    if (body.target_repo !== undefined && typeof body.target_repo !== 'string') {
      errors.push({ field: 'target_repo', message: 'Target repo must be a string' });
    }

    if (body.scheduled_at !== undefined && body.scheduled_at !== null) {
      const scheduledDate = new Date(body.scheduled_at);
      if (isNaN(scheduledDate.getTime())) {
        errors.push({ field: 'scheduled_at', message: 'Invalid scheduled date format' });
      }
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: errors } },
        { status: 400 }
      );
    }

    const db = getDb();
    const id = uuidv4();
    const now = new Date().toISOString();

    // Insert the task
    const insert = db.prepare(`
      INSERT INTO tasks (
        id, title, description, priority, status, workflow, 
        target_repo, scheduled_at, queue_order, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insert.run(
      id,
      body.title.trim(),
      body.description?.trim() || null,
      body.priority || 'medium',
      'backlog',
      body.workflow || 'feature-dev',
      body.target_repo?.trim() || null,
      body.scheduled_at || null,
      0, // queue_order
      now,
      now
    );

    // Fetch the created task
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Task;

    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    console.error('Error creating task:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to create task' } },
      { status: 500 }
    );
  }
}
