import fs from "node:fs/promises";
import path from "node:path";
import type { Page } from "playwright";
import { appConfig } from "@/lib/config";

export class ScreenshotService {
  async ensureStorage(): Promise<void> {
    await Promise.all([
      fs.mkdir(appConfig.storage.screenshotsDir, { recursive: true }),
      fs.mkdir(appConfig.storage.reportsDir, { recursive: true }),
      fs.mkdir(appConfig.storage.tempDir, { recursive: true })
    ]);
  }

  async capturePage(page: Page, jobId: string, label: string): Promise<string> {
    await this.ensureStorage();
    const fileName = `${jobId}-${safeName(label)}-${Date.now()}.png`;
    const filePath = path.join(appConfig.storage.screenshotsDir, fileName);
    await page.screenshot({ path: filePath, fullPage: true, animations: "disabled" });
    return filePath;
  }

  async captureElementContext(page: Page, jobId: string, label: string, selector?: string): Promise<string | undefined> {
    if (!selector) return undefined;

    const locator = page.locator(selector).first();
    const count = await locator.count().catch(() => 0);
    if (count === 0) return undefined;

    await locator.scrollIntoViewIfNeeded().catch(() => undefined);
    await page.evaluate((targetSelector) => {
      const element = document.querySelector(targetSelector);
      if (!(element instanceof HTMLElement)) return;

      const previousOutline = element.style.outline;
      const previousOffset = element.style.outlineOffset;
      element.dataset.qaPreviousOutline = previousOutline;
      element.dataset.qaPreviousOutlineOffset = previousOffset;
      element.style.outline = "4px solid #ef4444";
      element.style.outlineOffset = "4px";
    }, selector).catch(() => undefined);

    const box = await locator.boundingBox().catch(() => undefined);
    if (!box) return undefined;

    const viewport = page.viewportSize() ?? { width: 1440, height: 900 };
    const padding = 80;
    const clip = {
      x: Math.max(0, box.x - padding),
      y: Math.max(0, box.y - padding),
      width: Math.min(viewport.width, box.width + padding * 2),
      height: Math.min(viewport.height, box.height + padding * 2)
    };

    await this.ensureStorage();
    const fileName = `${jobId}-${safeName(label)}-evidence-${Date.now()}.png`;
    const filePath = path.join(appConfig.storage.screenshotsDir, fileName);
    await page.screenshot({ path: filePath, clip, animations: "disabled" });

    await page.evaluate((targetSelector) => {
      const element = document.querySelector(targetSelector);
      if (!(element instanceof HTMLElement)) return;
      element.style.outline = element.dataset.qaPreviousOutline ?? "";
      element.style.outlineOffset = element.dataset.qaPreviousOutlineOffset ?? "";
      delete element.dataset.qaPreviousOutline;
      delete element.dataset.qaPreviousOutlineOffset;
    }, selector).catch(() => undefined);

    return filePath;
  }
}

function safeName(value: string): string {
  return value.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 60) || "page";
}
