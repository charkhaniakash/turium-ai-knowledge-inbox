import Database from 'better-sqlite3';
import { config } from './config';
import { openDatabase } from './db/database';

/**
 * Composition root — the single place where all concrete implementations
 * are instantiated and wired together via constructor injection.
 * Nothing outside this file calls `new ConcreteService(...)`.
 * Phases 3–7 will populate this file progressively.
 */
export interface Container {
  db: Database.Database;
  config: typeof config;
}

export function buildContainer(): Container {
  const db = openDatabase(config.DATABASE_PATH);

  return { db, config };
}
