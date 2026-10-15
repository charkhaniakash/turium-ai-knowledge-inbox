import { buildApp } from './app';
import { buildContainer } from './container';
import { config } from './config';
import { logger } from './lib/logger';

const container = buildContainer();
const app = buildApp(container);

const server = app.listen(config.PORT, () => {
  logger.info({ port: config.PORT }, 'Server started');
});

// Graceful shutdown stub — full implementation in Phase 10
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down');
  server.close(() => {
    container.db.close();
    logger.info('Server closed');
    process.exit(0);
  });
});
