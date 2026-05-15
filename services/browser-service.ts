import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { appConfig } from "@/lib/config";

export class BrowserService {
  private browser?: Browser;

  async getBrowser(): Promise<Browser> {
    if (!this.browser?.isConnected()) {
      this.browser = await chromium.launch({
        headless: true,
        args: ["--disable-dev-shm-usage", "--no-sandbox"]
      });
    }
    return this.browser;
  }

  async createContext(): Promise<BrowserContext> {
    const browser = await this.getBrowser();
    return browser.newContext({
      viewport: { width: 1440, height: 1100 },
      userAgent:
        "QA-Automation-SaaS/0.1 (+https://example.com) Playwright Website Auditor",
      ignoreHTTPSErrors: true
    });
  }

  async withPage<T>(handler: (page: Page, context: BrowserContext) => Promise<T>): Promise<T> {
    const context = await this.createContext();
    const page = await context.newPage();
    page.setDefaultNavigationTimeout(appConfig.qa.navigationTimeoutMs);
    page.setDefaultTimeout(10_000);

    try {
      return await handler(page, context);
    } finally {
      await context.close();
    }
  }

  async close(): Promise<void> {
    await this.browser?.close();
    this.browser = undefined;
  }
}

export const browserService = new BrowserService();
