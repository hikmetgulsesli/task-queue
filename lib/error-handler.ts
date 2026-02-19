import { NextRequest, NextResponse } from 'next/server';
import { AppError } from '@/lib/errors';

export function errorHandler(err: Error) {
  console.error('API Error:', err);

  if (err instanceof AppError) {
    return NextResponse.json(err.toJSON(), { status: err.statusCode });
  }

  // Handle Next.js errors
  if (err instanceof SyntaxError && err.message.includes('JSON')) {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: 'Invalid JSON in request body' } },
      { status: 400 }
    );
  }

  // Default to 500 Internal Server Error
  return NextResponse.json(
    { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
    { status: 500 }
  );
}
