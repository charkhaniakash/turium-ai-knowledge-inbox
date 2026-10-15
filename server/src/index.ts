import { buildApp } from './app';
import { buildContainer } from './container';
import { config } from './config';
import { logger } from './lib/logger';

const container = buildContainer();
const app = buildApp(container);

const server = app.listen(config.PORT, () => {
  logger.info({ port: config.PORT }, 'Server started');
});

/**
 * Graceful shutdown: stop accepting new connections, wait for in-flight
 * requests to complete, then close the database and exit cleanly.
 * Handles both SIGTERM (container orchestration) and SIGINT (Ctrl+C).
 */
function shutdown(signal: string): void {
  logger.info({ signal }, 'Shutdown signal received');

  server.close((err) => {
    if (err !== undefined) {
      logger.error({ err }, 'Error closing HTTP server');
      process.exit(1);
    }

    try {
      container.db.close();
      logger.info('Database closed');
    } catch (dbErr) {
      logger.error({ err: dbErr }, 'Error closing database');
    }

    logger.info('Shutdown complete');
    process.exit(0);
  });

  // Force exit if graceful shutdown takes too long (e.g. stuck requests)
  setTimeout(() => {
    logger.error('Graceful shutdown timed out, forcing exit');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
