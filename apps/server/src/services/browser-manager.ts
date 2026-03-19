import { chromium, firefox, webkit, type Browser, type BrowserContext, type Page } from 'playwright';
import { logger } from '../utils/logger.js';

type BrowserType = 'chromium' | 'firefox' | 'webkit';

export interface ConsoleEntry {
  type: string;
  text: string;
  timestamp: number;
}

export interface NetworkEntry {
  method: string;
  url: string;
  resourceType: string;
  status?: number;
  failure?: string;
  responseTime?: number;
  startTime: number;
}

interface BrowserSession {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  consoleMessages: ConsoleEntry[];
  networkEntries: NetworkEntry[];
}

const MAX_CONSOLE_MESSAGES = 500;
const MAX_NETWORK_ENTRIES = 500;

const launchers = { chromium, firefox, webkit };

export class BrowserManager {
  private sessions = new Map<string, BrowserSession>();

  async createSession(
    sessionId: string,
    options: { browserType?: BrowserType; headless?: boolean; storageState?: any } = {}
  ): Promise<Page> {
    const { browserType = 'chromium', headless = true, storageState } = options;

    logger.info({ sessionId, browserType, headless, hasStorageState: !!storageState }, 'Launching browser session');

    const launcher = launchers[browserType];
    const browser = await launcher.launch({ headless });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      locale: 'ko-KR',
      ...(storageState ? { storageState } : {}),
    });
    const page = await context.newPage();

    const consoleMessages: ConsoleEntry[] = [];
    const networkEntries: NetworkEntry[] = [];

    // Console listener
    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
        timestamp: Date.now(),
      });
      if (consoleMessages.length > MAX_CONSOLE_MESSAGES) {
        consoleMessages.shift();
      }
    });

    // Network request listener
    const requestTimings = new Map<string, number>();

    page.on('request', request => {
      const url = request.url();
      requestTimings.set(url + request.method(), Date.now());
      networkEntries.push({
        method: request.method(),
        url,
        resourceType: request.resourceType(),
        startTime: Date.now(),
      });
      if (networkEntries.length > MAX_NETWORK_ENTRIES) {
        networkEntries.shift();
      }
    });

    page.on('response', response => {
      const key = response.url() + response.request().method();
      const startTime = requestTimings.get(key);
      const entry = networkEntries.find(
        e => e.url === response.url() && e.method === response.request().method() && !e.status
      );
      if (entry) {
        entry.status = response.status();
        if (startTime) entry.responseTime = Date.now() - startTime;
      }
      requestTimings.delete(key);
    });

    page.on('requestfailed', request => {
      const entry = networkEntries.find(
        e => e.url === request.url() && e.method === request.method() && !e.status && !e.failure
      );
      if (entry) {
        entry.failure = request.failure()?.errorText || 'Unknown error';
      }
    });

    this.sessions.set(sessionId, { browser, context, page, consoleMessages, networkEntries });
    return page;
  }

  getPage(sessionId: string): Page | undefined {
    return this.sessions.get(sessionId)?.page;
  }

  getContext(sessionId: string): BrowserContext | undefined {
    return this.sessions.get(sessionId)?.context;
  }

  getConsoleMessages(sessionId: string): ConsoleEntry[] {
    return this.sessions.get(sessionId)?.consoleMessages ?? [];
  }

  getNetworkEntries(sessionId: string): NetworkEntry[] {
    return this.sessions.get(sessionId)?.networkEntries ?? [];
  }

  async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      await session.browser.close().catch(() => {});
      this.sessions.delete(sessionId);
      logger.info({ sessionId }, 'Browser session closed');
    }
  }

  async closeAll(): Promise<void> {
    for (const [id] of this.sessions) {
      await this.closeSession(id);
    }
  }
}

export const browserManager = new BrowserManager();
