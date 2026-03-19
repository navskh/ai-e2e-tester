import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const testRuns = sqliteTable('test_runs', {
  id: text('id').primaryKey(),
  prompt: text('prompt').notNull(),
  setup: text('setup'),
  scenario: text('scenario'),
  requestPayload: text('request_payload'),
  status: text('status', { enum: ['pending', 'running', 'paused', 'passed', 'warning', 'failed', 'cancelled'] }).notNull().default('pending'),
  summary: text('summary'),
  startedAt: text('started_at').notNull(),
  completedAt: text('completed_at'),
  durationMs: integer('duration_ms'),
});

export const testSteps = sqliteTable('test_steps', {
  id: text('id').primaryKey(),
  testRunId: text('test_run_id').notNull().references(() => testRuns.id, { onDelete: 'cascade' }),
  stepIndex: integer('step_index').notNull(),
  tool: text('tool').notNull(),
  input: text('input', { mode: 'json' }).notNull(),
  result: text('result'),
  status: text('status', { enum: ['running', 'passed', 'failed', 'skipped'] }).notNull().default('running'),
  screenshotPath: text('screenshot_path'),
  createdAt: text('created_at').notNull(),
});

export const conversations = sqliteTable('conversations', {
  id: text('id').primaryKey(),
  testRunId: text('test_run_id').notNull().references(() => testRuns.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['assistant', 'user', 'system'] }).notNull(),
  content: text('content').notNull(),
  createdAt: text('created_at').notNull(),
});
