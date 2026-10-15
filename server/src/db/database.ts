import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { logger } from '../lib/logger';

/**
 * Opens the SQLite database and runs schema migrations on startup.
 * Using better-sqlite3's synchronous API keeps the startup path simple
 * and avoids async pitfalls during initialisation.
 */
export function openDatabase(dbPath: string): Database.Database {
  const absolutePath = resolve(dbPath);
  // Ensure the data directory exists before SQLite tries to open the file
  mkdirSync(dirname(absolutePath), { recursive: true });

  const db = new Database(absolutePath);

  // WAL mode improves read concurrency and crash resilience
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  runMigrations(db);

  logger.info({ dbPath: absolutePath }, 'Database opened');
  return db;
}

function runMigrations(db: Database.Database): void {
  const schemaPath = resolve(__dirname, 'schema.sql');
  const sql = readFileSync(schemaPath, 'utf-8');
  // Execute the full schema — all statements use CREATE IF NOT EXISTS so
  // re-running on startup is safe (idempotent migration approach)
  db.exec(sql);
  logger.info('Schema migration applied');
}
