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
 * AppError subclasses carry their own status code and code string.
 * Unexpected errors are logged with a stack trace and returned as 500s
 * with a generic message (never leak internals to the client).
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // next is required by Express error-handler signature even if unused
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    const body: ErrorResponse = {
      error: {
        code: err.code,
        message: err.message,
      },
    };

    if (err instanceof ValidationError && err.details.length > 0) {
      body.error.details = err.details;
    }

    res.status(err.statusCode).json(body);
    return;
  }

  // Unexpected error — log full details, return generic response
  logger.error({ err, requestId: req.headers['x-request-id'] }, 'Unhandled error');

  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
    },
  });
}
