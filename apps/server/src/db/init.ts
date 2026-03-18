import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

export function initDb() {
  mkdirSync(dirname(config.dbPath), { recursive: true });

  const sqlite = new Database(config.dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  // Create tables if they don't exist
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS test_runs (
      id TEXT PRIMARY KEY,
      prompt TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      summary TEXT,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      duration_ms INTEGER
    );

    CREATE TABLE IF NOT EXISTS test_steps (
      id TEXT PRIMARY KEY,
      test_run_id TEXT NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
      step_index INTEGER NOT NULL,
      tool TEXT NOT NULL,
      input TEXT NOT NULL,
      result TEXT,
      status TEXT NOT NULL DEFAULT 'running',
      screenshot_path TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      test_run_id TEXT NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_test_steps_run_id ON test_steps(test_run_id);
    CREATE INDEX IF NOT EXISTS idx_conversations_run_id ON conversations(test_run_id);
  `);

  sqlite.close();
  logger.info('Database initialized');
}
