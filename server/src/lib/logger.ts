import pino, { LoggerOptions } from 'pino';
import { config } from '../config';

/**
 * Application-wide base logger.
 * Route handlers receive a request-scoped child logger (via requestLogger middleware)
 * that carries the requestId automatically.
 * In test mode, logs are silenced to keep test output clean.
 */

const options: LoggerOptions = {
  level: config.LOG_LEVEL,
  // Silence logs during tests — test output should come from the test runner
  ...(process.env['NODE_ENV'] === 'test' ? { level: 'silent' } : {}),
};

export const logger = pino(options);
