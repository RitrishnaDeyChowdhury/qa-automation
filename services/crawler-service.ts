import type { Page } from "playwright";
import type { CrawlOptions } from "@/types/qa";

interface QueueItem {
  url: string;
  depth: number;
}

export class CrawlerService {
  async crawl(startUrl: URL, page: Page, options: CrawlOptions): Promise<string[]> {
    const seen = new Set<string>();
    const queue: QueueItem[] = [{ url: normalizeUrl(startUrl), depth: 0 }];
    const origin = startUrl.origin;

    while (queue.length > 0 && seen.size < options.maxPages) {
      const next = queue.shift();
      if (!next || seen.has(next.url) || next.depth > options.maxDepth) continue;

      seen.add(next.url);

      try {
        await page.goto(next.url, { waitUntil: "domcontentloaded" });
        const links = await page.$$eval("a[href]", (anchors) =>
          anchors
            .map((anchor) => (anchor as HTMLAnchorElement).href)
            .filter(Boolean)
        );

        for (const href of links) {
          const candidate = normalizeCandidate(href, origin);
          if (!candidate || seen.has(candidate)) continue;
          if (queue.length + seen.size >= options.maxPages) break;
          queue.push({ url: candidate, depth: next.depth + 1 });
        }
      } catch {
        // Navigation failures are captured later during page auditing.
      }
    }

    return [...seen];
  }
}

function normalizeCandidate(href: string, origin: string): string | undefined {
  try {
    const url = new URL(href);
    if (url.origin !== origin) return undefined;
    return normalizeUrl(url);
  } catch {
    return undefined;
  }
}

function normalizeUrl(url: URL): string {
  url.hash = "";
  if (url.pathname !== "/" && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.slice(0, -1);
  }
  return url.toString();
}
