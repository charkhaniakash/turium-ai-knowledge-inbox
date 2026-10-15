import pinoHttp from 'pino-http';
import { randomUUID } from 'crypto';
import { logger } from '../lib/logger';

/**
 * Attaches a request-scoped child logger to req.log with a unique requestId.
 * The same requestId is returned in the x-request-id response header so
 * callers can correlate client errors with server logs.
 */
export const requestLogger = pinoHttp({
  logger,
  genReqId: (req, res) => {
    const existing = req.headers['x-request-id'];
    const id = typeof existing === 'string' && existing.length > 0
      ? existing
      : randomUUID();
    res.setHeader('x-request-id', id);
    return id;
  },
  // Log request body fields selectively — never log raw content or keys
  serializers: {
    req: (req) => ({
      id: req.id,
      method: req.method,
      url: req.url,
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
  },
});
