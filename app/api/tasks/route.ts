import { NextRequest, NextResponse } from 'next/server';
import { getDb, Task } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface TasksFilter {
  status?: string;
  priority?: string;
  workflow?: string;
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
