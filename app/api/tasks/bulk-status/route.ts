import { NextRequest, NextResponse } from 'next/server';
import { getDb, Task } from '@/lib/db';

// Valid task statuses
const VALID_STATUSES = ['backlog', 'queued', 'running', 'done', 'failed', 'cancelled'] as const;
type TaskStatus = typeof VALID_STATUSES[number];

interface BulkStatusUpdateRequest {
  ids: string[];
  status: TaskStatus;
}

interface BulkUpdateResult {
  updated: string[];
  notFound: string[];
  failed: string[];
}

// PATCH /api/tasks/bulk-status - Update status of multiple tasks
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json() as BulkStatusUpdateRequest;
    const { ids, status } = body;

    // Validate input
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { 
          error: { 
            code: 'VALIDATION_ERROR', 
            message: 'ids must be a non-empty array',
            details: [{ field: 'ids', message: 'Must be a non-empty array of task IDs' }]
          } 
        },
        { status: 400 }
      );
    }

    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { 
          error: { 
            code: 'VALIDATION_ERROR', 
            message: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`,
            details: [{ field: 'status', message: `Must be one of: ${VALID_STATUSES.join(', ')}` }]
          } 
        },
        { status: 400 }
      );
    }

    // Validate all IDs are strings
    const invalidIds = ids.filter(id => typeof id !== 'string' || id.trim() === '');
    if (invalidIds.length > 0) {
      return NextResponse.json(
        { 
          error: { 
            code: 'VALIDATION_ERROR', 
            message: 'All IDs must be non-empty strings',
            details: [{ field: 'ids', message: `Invalid IDs found: ${invalidIds.join(', ')}` }]
          } 
        },
        { status: 400 }
      );
    }

    const db = getDb();
    const result: BulkUpdateResult = {
      updated: [],
      notFound: [],
      failed: []
    };

    // Use transaction for atomic bulk update
    const bulkUpdate = db.transaction(() => {
      for (const id of ids) {
        try {
          // Check if task exists
          const existingTask = db.prepare('SELECT id FROM tasks WHERE id = ?').get(id);
          if (!existingTask) {
            result.notFound.push(id);
            continue;
          }

          // Update task status
          const updateResult = db.prepare(
            `UPDATE tasks 
             SET status = ?, 
                 updated_at = CURRENT_TIMESTAMP,
                 ${status === 'done' || status === 'failed' || status === 'cancelled' 
                   ? "completed_at = CURRENT_TIMESTAMP" 
                   : status === 'running' 
                     ? "started_at = COALESCE(started_at, CURRENT_TIMESTAMP)" 
                     : ""}
             WHERE id = ?`
          ).run(status, id);

          if (updateResult.changes > 0) {
            result.updated.push(id);
          } else {
            result.failed.push(id);
          }
        } catch (err) {
          console.error(`Error updating task ${id}:`, err);
          result.failed.push(id);
        }
      }
    });

    bulkUpdate();

    // Return appropriate response based on results
    const allSucceeded = result.updated.length === ids.length;
    const allFailed = result.updated.length === 0;

    if (allSucceeded) {
      return NextResponse.json({
        data: {
          updated: result.updated,
          status
        }
      });
    }

    if (allFailed) {
      return NextResponse.json(
        { 
          error: { 
            code: 'BULK_UPDATE_FAILED', 
            message: 'No tasks were updated',
            details: {
              notFound: result.notFound,
              failed: result.failed
            }
          } 
        },
        { status: 404 }
      );
    }

    // Partial success
    return NextResponse.json(
      { 
        data: {
          updated: result.updated,
          notFound: result.notFound,
          failed: result.failed,
          status
        },
        meta: {
          partial: true,
          totalRequested: ids.length,
          totalUpdated: result.updated.length
        }
      },
      { status: 207 } // Multi-Status
    );
  } catch (error) {
    console.error('Error in bulk status update:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to update task statuses' } },
      { status: 500 }
    );
  }
}
