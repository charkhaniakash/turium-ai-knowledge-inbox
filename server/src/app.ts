import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { config } from './config';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler } from './middleware/errorHandler';
import { healthRouter } from './routes/health.route';
import { buildIngestRouter } from './routes/ingest.route';
import { buildItemsRouter } from './routes/items.route';
import { buildQueryRouter } from './routes/query.route';
import { NotFoundError } from './lib/errors';
import { Container } from './container';

/**
 * Builds and returns the Express application.
 * Route builders receive only the services they need from the container —
 * routes depend on interfaces, never on the concrete container shape.
 */
export function buildApp(container: Container): Application {
  const app = express();

  // ── Global middleware ──────────────────────────────────────────────────────
  app.use(cors({ origin: config.CORS_ORIGIN }));
  app.use(express.json({ limit: '1mb' }));
  app.use(requestLogger);

  // ── Routes ─────────────────────────────────────────────────────────────────
  app.use(healthRouter);
  app.use(buildIngestRouter(container.ingestService));
  app.use(buildItemsRouter(container.itemRepository));
  app.use(buildQueryRouter(container.answerService));

  // ── 404 catch-all ──────────────────────────────────────────────────────────
  app.use((_req: Request, _res: Response, next: NextFunction) => {
    next(new NotFoundError('Route not found'));
  });

  // ── Error handler (must be last) ───────────────────────────────────────────
  app.use(errorHandler);

  return app;
}
