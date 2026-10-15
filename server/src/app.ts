import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { config } from './config';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler } from './middleware/errorHandler';
import { createRateLimiter } from './middleware/rateLimiter';
import { healthRouter } from './routes/health.route';
import { buildIngestRouter } from './routes/ingest.route';
import { buildItemsRouter } from './routes/items.route';
import { buildQueryRouter } from './routes/query.route';
import { NotFoundError } from './lib/errors';
import { Container } from './container';

// Rate limits — generous for a single-user app, guards against runaway loops
const ingestLimiter = createRateLimiter({ maxRequests: 30, windowMs: 60_000 });
const queryLimiter  = createRateLimiter({ maxRequests: 20, windowMs: 60_000 });

/**
 * Builds and returns the Express application.
 * Route builders receive only the services they need from the container —
 * routes depend on interfaces, never on the concrete container shape.
 */
export function buildApp(container: Container): Application {
  const app = express();

  // ── Global middleware ──────────────────────────────────────────────────────
  app.use(cors({ origin: config.CORS_ORIGIN, credentials: false }));

  // 100 kb is generous for notes/URLs; blocks accidental oversized payloads.
  // Express body-parser throws a PayloadTooLargeError caught in errorHandler.
  app.use(express.json({ limit: '100kb' }));

  app.use(requestLogger);

  // ── Routes ─────────────────────────────────────────────────────────────────
  app.use(healthRouter);
  app.use(buildIngestRouter(container.ingestService, ingestLimiter));
  app.use(buildItemsRouter(container.itemRepository));
  app.use(buildQueryRouter(container.answerService, queryLimiter));

  // ── 404 catch-all ──────────────────────────────────────────────────────────
  app.use((_req: Request, _res: Response, next: NextFunction) => {
    next(new NotFoundError('Route not found'));
  });

  // ── Error handler (must be last) ───────────────────────────────────────────
  app.use(errorHandler);

  return app;
}
