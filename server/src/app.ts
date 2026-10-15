import express, { Application } from 'express';
import { healthRouter } from './routes/health.route';

/**
 * Builds and returns the Express application.
 * Dependency injection for middleware and routes happens here;
 * the full composition root (container.ts) will be wired in Phase 2.
 */
function buildApp(): Application {
  const app = express();

  app.use(express.json());

  app.use(healthRouter);

  return app;
}

export { buildApp };
