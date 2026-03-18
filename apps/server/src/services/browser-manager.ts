import { chromium, firefox, webkit, type Browser, type BrowserContext, type Page } from 'playwright';
import { logger } from '../utils/logger.js';

type BrowserType = 'chromium' | 'firefox' | 'webkit';

interface BrowserSession {
  browser: Browser;
  context: BrowserContext;
  page: Page;
}

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

    this.sessions.set(sessionId, { browser, context, page });
    return page;
  }

  getPage(sessionId: string): Page | undefined {
    return this.sessions.get(sessionId)?.page;
  }

  getContext(sessionId: string): BrowserContext | undefined {
    return this.sessions.get(sessionId)?.context;
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
