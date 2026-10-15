import { Request, Response, NextFunction } from 'express';
import { AppError, ValidationError } from '../lib/errors';
import { logger } from '../lib/logger';

interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown[];
  };
}

/**
 * Central error handler — the single place that maps errors to HTTP responses.
 *
 * Handled cases:
 *   - Express body-parser SyntaxError → 400 (malformed JSON)
 *   - Express body-parser PayloadTooLargeError → 413
 *   - AppError subclasses → their own status code
 *   - Everything else → 500 with generic message (detail logged, never leaked)
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // next is required by Express error-handler signature even if unused
  _next: NextFunction
): void {
  // Malformed JSON body — Express body-parser throws a SyntaxError
  if (isSyntaxError(err)) {
    res.status(400).json({
      error: { code: 'INVALID_JSON', message: 'Request body contains invalid JSON' },
    });
    return;
  }

  // Body too large — Express body-parser throws with type 'entity.too.large'
  if (isPayloadTooLarge(err)) {
    res.status(413).json({
      error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body exceeds the size limit' },
    });
    return;
  }

  if (err instanceof AppError) {
    const body: ErrorResponse = {
      error: { code: err.code, message: err.message },
    };
    if (err instanceof ValidationError && err.details.length > 0) {
      body.error.details = err.details;
    }
    res.status(err.statusCode).json(body);
    return;
  }

  // Unexpected error — log with stack trace, never leak internals
  logger.error({ err, requestId: req.headers['x-request-id'] }, 'Unhandled error');
  res.status(500).json({
    error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' },
  });
}

function isSyntaxError(err: unknown): boolean {
  return (
    err instanceof SyntaxError &&
    'body' in (err as unknown as Record<string, unknown>)
  );
}

function isPayloadTooLarge(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as Record<string, unknown>)['type'] === 'entity.too.large'
  );
}
