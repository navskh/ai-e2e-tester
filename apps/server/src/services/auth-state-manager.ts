import { mkdirSync, readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import type { BrowserContext } from 'playwright';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

interface StoredAuthState {
  savedAt: string;
  storageState: any; // Playwright StorageState
}

function domainKey(domain: string): string {
  return createHash('sha256').update(domain).digest('hex').slice(0, 16);
}

/** Extract domain from a URL string */
export function extractDomain(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    // Try to find a URL-like pattern in the text
    const match = url.match(/https?:\/\/([^\/\s]+)/);
    return match?.[1] ?? null;
  }
}

class AuthStateManager {
  /** Get cached auth state for a domain, if valid (not expired) */
  getState(domain: string): any | null {
    const filepath = this.filepath(domain);
    if (!existsSync(filepath)) return null;

    try {
      const raw = readFileSync(filepath, 'utf-8');
      const stored: StoredAuthState = JSON.parse(raw);

      const age = Date.now() - new Date(stored.savedAt).getTime();
      if (age > config.authStateTtlMs) {
        logger.info({ domain, ageMs: age }, 'Auth state expired, removing');
        unlinkSync(filepath);
        return null;
      }

      logger.info({ domain, ageMs: age }, 'Reusing cached auth state');
      return stored.storageState;
    } catch (err) {
      logger.warn({ err, domain }, 'Failed to read auth state');
      return null;
    }
  }

  /** Save auth state after successful login */
  async saveState(domain: string, context: BrowserContext): Promise<void> {
    mkdirSync(config.authStateDir, { recursive: true });
    const storageState = await context.storageState();
    const stored: StoredAuthState = {
      savedAt: new Date().toISOString(),
      storageState,
    };
    writeFileSync(this.filepath(domain), JSON.stringify(stored, null, 2));
    logger.info({ domain }, 'Auth state saved');
  }

  /** Invalidate cached state for a domain */
  invalidateState(domain: string): void {
    const filepath = this.filepath(domain);
    if (existsSync(filepath)) {
      unlinkSync(filepath);
      logger.info({ domain }, 'Auth state invalidated');
    }
  }

  private filepath(domain: string): string {
    return join(config.authStateDir, `${domainKey(domain)}.json`);
  }
}

export const authStateManager = new AuthStateManager();
