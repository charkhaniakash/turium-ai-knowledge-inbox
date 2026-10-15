import { Request, Response, NextFunction, RequestHandler } from 'express';

interface RateLimitOptions {
  /** Maximum requests allowed in the window */
  maxRequests: number;
  /** Window duration in milliseconds */
  windowMs: number;
}

interface WindowEntry {
  count: number;
  resetAt: number;
}

/**
 * Simple in-process sliding-window rate limiter.
 * Uses the client IP as the key. Single-user app — this guards against
 * accidental loops or runaway scripts rather than adversarial abuse.
 *
 * Trade-off: state lives in memory and is lost on restart. At scale,
 * move to Redis-backed rate limiting (e.g. rate-limiter-flexible).
 */
export function createRateLimiter(options: RateLimitOptions): RequestHandler {
  const { maxRequests, windowMs } = options;
  const windows = new Map<string, WindowEntry>();

  // Sweep stale entries every window period to avoid unbounded growth
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of windows.entries()) {
      if (entry.resetAt <= now) windows.delete(key);
    }
  }, windowMs);

  // Don't keep the process alive just for cleanup
  sweep.unref();

  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    const now = Date.now();

    let entry = windows.get(ip);
    if (entry === undefined || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      windows.set(ip, entry);
    }

    entry.count += 1;

    res.setHeader('X-RateLimit-Limit', String(maxRequests));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, maxRequests - entry.count)));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > maxRequests) {
      res.status(429).json({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: `Too many requests. Limit is ${maxRequests} per ${windowMs / 1000}s window.`,
        },
      });
      return;
    }

    next();
  };
}
