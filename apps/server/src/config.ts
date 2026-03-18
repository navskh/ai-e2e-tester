import { resolve } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';

// Load .env file if present
const envPath = resolve(import.meta.dirname ?? '.', '../.env');
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key] && value) {
      process.env[key] = value;
    }
  }
}

export const config = {
  port: Number(process.env.PORT ?? 4820),
  host: process.env.HOST ?? '0.0.0.0',
  dbPath: resolve(process.env.DB_PATH ?? './data/test-runs.db'),
  screenshotsDir: resolve(process.env.SCREENSHOTS_DIR ?? './data/screenshots'),
  logLevel: process.env.LOG_LEVEL ?? 'info',
  authToken: process.env.AUTH_TOKEN ?? '',
  maxConcurrentTests: Number(process.env.MAX_CONCURRENT_TESTS ?? 3),
  authStateDir: resolve(process.env.AUTH_STATE_DIR ?? './data/auth-states'),
  authStateTtlMs: Number(process.env.AUTH_STATE_TTL_MS ?? 14400000), // 4 hours
  setupMaxTurns: Number(process.env.SETUP_MAX_TURNS ?? 30),
};
