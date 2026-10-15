/**
 * Typed error hierarchy for the application.
 * Each subclass maps to a specific HTTP status code in errorHandler middleware.
 * Callers throw typed errors; routes never set status codes directly.
 */

export class AppError extends Error {
  readonly code: string;
  readonly statusCode: number;

  constructor(message: string, code: string, statusCode: number) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    // Restore prototype chain (required when extending built-ins in TypeScript)
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends AppError {
  readonly details: unknown[];

  constructor(message: string, details: unknown[] = []) {
    super(message, 'VALIDATION_ERROR', 400);
    this.details = details;
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 'NOT_FOUND', 404);
  }
}

export class UnprocessableContentError extends AppError {
  constructor(message: string) {
    super(message, 'UNPROCESSABLE_CONTENT', 422);
  }
}

export class UpstreamServiceError extends AppError {
  constructor(message: string) {
    super(message, 'UPSTREAM_SERVICE_ERROR', 502);
  }
}
