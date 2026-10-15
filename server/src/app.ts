import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { config } from './config';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler } from './middleware/errorHandler';
import { healthRouter } from './routes/health.route';
import { NotFoundError } from './lib/errors';
import { Container } from './container';

/**
 * Builds and returns the Express application.
 * All routes and middleware are registered here; the container (composition root)
 * is passed in so routes can receive services via closure without importing
 * concrete implementations directly.
 */
export function buildApp(container: Container): Application {
  const app = express();

  // ── Global middleware ──────────────────────────────────────────────────────
  app.use(cors({ origin: config.CORS_ORIGIN }));
  app.use(express.json({ limit: '1mb' }));
  app.use(requestLogger);

  // ── Routes ─────────────────────────────────────────────────────────────────
  app.use(healthRouter);

  // Phases 3–7 will mount ingest, items, and query routers here using `container`
  void container; // acknowledge the parameter — will be used in later phases

  // ── 404 catch-all ──────────────────────────────────────────────────────────
  app.use((_req: Request, _res: Response, next: NextFunction) => {
    next(new NotFoundError('Route not found'));
  });

  // ── Error handler (must be last) ───────────────────────────────────────────
  app.use(errorHandler);

  return app;
}
