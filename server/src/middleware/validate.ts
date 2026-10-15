import { Request, Response, NextFunction, RequestHandler } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ValidationError } from '../lib/errors';

/**
 * Returns an Express middleware that validates req.body against the given zod schema.
 * On failure, throws a ValidationError with field-level details — caught by errorHandler.
 * Internal code downstream can trust that the body matches the schema exactly.
 */
export function validate<T>(schema: ZodSchema<T>): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const details = formatZodError(result.error);
      return next(new ValidationError('Request validation failed', details));
    }
    // Replace body with the parsed (and coerced/trimmed) value
    req.body = result.data;
    return next();
  };
}

function formatZodError(error: ZodError): { field: string; message: string }[] {
  return error.errors.map((e) => ({
    field: e.path.join('.'),
    message: e.message,
  }));
}
