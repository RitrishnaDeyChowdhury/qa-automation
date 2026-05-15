import axeSource from "axe-core";
import type { Page } from "playwright";
import type { PageAuditResult, QaIssue, Severity } from "@/types/qa";
import { createId } from "@/utils/id";
import { ScreenshotService } from "@/services/screenshot-service";

interface CapturedNetworkFailure {
  url: string;
  status?: number;
  error?: string;
}

interface ConsoleMessage {
  type: string;
  text: string;
}

export class QaCheckService {
  private readonly screenshots = new ScreenshotService();

  async auditPage(page: Page, url: string, jobId: string): Promise<PageAuditResult> {
    const consoleMessages: ConsoleMessage[] = [];
    const failedRequests: CapturedNetworkFailure[] = [];
    const started = Date.now();

    page.on("console", (message) => {
      if (["error", "warning"].includes(message.type())) {
        consoleMessages.push({ type: message.type(), text: message.text() });
      }
    });

    page.on("pageerror", (error) => {
      consoleMessages.push({ type: "pageerror", text: error.message });
    });

    page.on("requestfailed", (request) => {
      failedRequests.push({
        url: request.url(),
        error: request.failure()?.errorText
      });
    });

    page.on("response", (response) => {
      if (response.status() >= 400) {
        failedRequests.push({ url: response.url(), status: response.status() });
      }
    });

    let statusCode: number | undefined;
    try {
      const response = await page.goto(url, { waitUntil: "networkidle" });
      statusCode = response?.status();
    } catch (error) {
      failedRequests.push({ url, error: error instanceof Error ? error.message : "Navigation failed" });
      await page.goto(url, { waitUntil: "domcontentloaded" }).catch(() => undefined);
    }

    const loadTimeMs = Date.now() - started;
    const screenshotPath = await this.screenshots.capturePage(page, jobId, new URL(url).pathname || "home");
    const title = await page.title().catch(() => "Untitled page");

    const [
      technicalIssues,
      seoIssues,
      uiIssues,
      accessibilityIssues,
      performanceIssues,
      metrics
    ] = await Promise.all([
      this.collectTechnicalIssues(page, url, consoleMessages, failedRequests),
      this.collectSeoIssues(page, url),
      this.collectUiIssues(page, url),
      this.collectAccessibilityIssues(page, url),
      this.collectPerformanceIssues(page, url, loadTimeMs),
      this.collectMetrics(page)
    ]);

    const issues = [
      ...technicalIssues,
      ...seoIssues,
      ...uiIssues,
      ...accessibilityIssues,
      ...performanceIssues
    ];

    for (const issue of issues) {
      issue.screenshotPath =
        await this.screenshots.captureElementContext(page, jobId, issue.title, issue.selector)
          .catch(() => undefined) ?? screenshotPath;
    }

    return {
      url,
      title,
      statusCode,
      loadTimeMs,
      screenshotPath,
      issues,
      metrics
    };
  }

  private async collectTechnicalIssues(
    page: Page,
    pageUrl: string,
    consoleMessages: ConsoleMessage[],
    failedRequests: CapturedNetworkFailure[]
  ): Promise<QaIssue[]> {
    const issues: QaIssue[] = [];

    for (const message of consoleMessages.slice(0, 10)) {
      issues.push(issue(pageUrl, "technical", message.type === "error" || message.type === "pageerror" ? "High" : "Medium", "Browser console issue", message.text, "Investigate the console trace and fix the failing client-side code.", {
        fixCode: `// Open DevTools → Console to locate the exact stack trace.\n// Common fix: wrap risky calls in try/catch\ntry {\n  // your problematic code here\n} catch (err) {\n  console.warn('Handled error:', err);\n}`
      }));
    }

    for (const failure of failedRequests.slice(0, 20)) {
      const fixedUrl = failure.url.replace(/^https?:\/\/[^/]+/, "");
      issues.push(issue(pageUrl, "technical", failure.status && failure.status >= 500 ? "High" : "Medium", "Failed network request", `${failure.status ?? failure.error ?? "Request failed"}: ${failure.url}`, "Fix missing assets, failed API calls, redirects, or server errors.", {
        fixCode: `<!-- Verify the resource exists and the URL is correct -->\n<!-- Failed URL: ${failure.url} -->\n<link rel="preload" href="${fixedUrl}" as="fetch" crossorigin>\n<!-- Or update the fetch call in your JavaScript: -->\n<!-- fetch('${fixedUrl}').then(r => r.json()) -->`
      }));
    }

    const brokenLinks = await page.$$eval("a[href]", async (anchors) => {
      const getCssPath = (element: Element): string => {
        const parts: string[] = [];
        let current: Element | null = element;

        while (current && current.nodeType === Node.ELEMENT_NODE && parts.length < 5) {
          const tag = current.tagName.toLowerCase();
          const id = current.id ? `#${CSS.escape(current.id)}` : "";
          if (id) {
            parts.unshift(`${tag}${id}`);
            break;
          }

          const parent: HTMLElement | null = current.parentElement;
          const currentTag = current.tagName;
          const siblings: Element[] = parent ? [...parent.children].filter((sibling) => sibling.tagName === currentTag) : [];
          const index = siblings.indexOf(current) + 1;
          parts.unshift(`${tag}${siblings.length > 1 ? `:nth-of-type(${index})` : ""}`);
          current = parent;
        }

        return parts.join(" > ");
      };

      const unique = [...new Map(
        anchors
          .map((anchor) => {
            const element = anchor as HTMLAnchorElement;
            return [element.href, { href: element.href, selector: getCssPath(element) }] as const;
          })
          .filter(([href]) => Boolean(href))
      ).values()].slice(0, 30);
      const checks = await Promise.all(
        unique.map(async ({ href, selector }) => {
          try {
            const response = await fetch(href, { method: "HEAD" });
            return response.status >= 400 ? { evidence: `${response.status} ${href}`, selector } : undefined;
          } catch {
            return { evidence: `unreachable ${href}`, selector };
          }
        })
      );
      return checks.filter(Boolean) as Array<{ evidence: string; selector: string }>;
    }).catch(() => []);

    for (const broken of brokenLinks.slice(0, 10)) {
      issues.push(issue(pageUrl, "technical", "Medium", "Broken link detected", broken.evidence, "Update or remove links returning errors.", {
        selector: broken.selector,
        evidence: broken.evidence,
        fixCode: `<!-- Fix: update the href to a valid URL or remove the link -->\n<a href="/correct-path">Link text</a>\n\n<!-- Or remove the broken link entirely: -->\n<!-- <a href="${broken.evidence?.split(" ").pop() ?? "broken-url"}">...</a> -->`
      }));
    }

    const brokenImages = await page.$$eval("img", (images) => {
      const getCssPath = (element: Element): string => {
        const parts: string[] = [];
        let current: Element | null = element;

        while (current && current.nodeType === Node.ELEMENT_NODE && parts.length < 5) {
          const tag = current.tagName.toLowerCase();
          const id = current.id ? `#${CSS.escape(current.id)}` : "";
          if (id) {
            parts.unshift(`${tag}${id}`);
            break;
          }

          const parent: HTMLElement | null = current.parentElement;
          const currentTag = current.tagName;
          const siblings: Element[] = parent ? [...parent.children].filter((sibling) => sibling.tagName === currentTag) : [];
          const index = siblings.indexOf(current) + 1;
          parts.unshift(`${tag}${siblings.length > 1 ? `:nth-of-type(${index})` : ""}`);
          current = parent;
        }

        return parts.join(" > ");
      };

      return images
        .filter((image) => !(image as HTMLImageElement).complete || (image as HTMLImageElement).naturalWidth === 0)
        .map((image) => ({
          evidence: (image as HTMLImageElement).src || "Image without src",
          selector: getCssPath(image)
        }));
    }).catch(() => []);

    for (const imageSrc of brokenImages.slice(0, 10)) {
      issues.push(issue(pageUrl, "technical", "Medium", "Broken image detected", imageSrc.evidence, "Fix missing image sources or CDN delivery issues.", {
        selector: imageSrc.selector,
        evidence: imageSrc.evidence,
        fixCode: `<!-- Fix: correct the image src path and always include alt text -->\n<img src="/correct/path/to/image.jpg" alt="Descriptive alt text" width="800" height="600" />\n\n<!-- If using Next.js: -->\n<!-- <Image src="/correct/path.jpg" alt="Description" width={800} height={600} /> -->`
      }));
    }

    return issues;
  }

  private async collectSeoIssues(page: Page, pageUrl: string): Promise<QaIssue[]> {
    const data = await page.evaluate(() => ({
      hasDescription: Boolean(document.querySelector('meta[name="description"]')),
      hasViewport: Boolean(document.querySelector('meta[name="viewport"]')),
      hasFavicon: Boolean(document.querySelector('link[rel~="icon"], link[rel="shortcut icon"]')),
      missingAltCount: [...document.images].filter((image) => !image.alt?.trim()).length
    }));

    const issues: QaIssue[] = [];
    if (!data.hasDescription) issues.push(issue(pageUrl, "seo", "Medium", "Missing meta description", "No meta description tag was found.", "Add a concise, page-specific meta description.", {
      fixCode: `<!-- Add inside <head> -->\n<meta name="description" content="A concise summary of this page (120–160 characters)." />`
    }));
    if (!data.hasViewport) issues.push(issue(pageUrl, "seo", "High", "Missing viewport meta tag", "Responsive viewport metadata is missing.", "Add a viewport meta tag for mobile rendering.", {
      fixCode: `<!-- Add inside <head> -->\n<meta name="viewport" content="width=device-width, initial-scale=1" />`
    }));
    if (!data.hasFavicon) issues.push(issue(pageUrl, "seo", "Low", "Missing favicon", "No favicon link was found.", "Add a brand favicon for trust and tab recognition.", {
      fixCode: `<!-- Add inside <head> -->\n<link rel="icon" href="/favicon.ico" sizes="any" />\n<link rel="icon" href="/favicon.svg" type="image/svg+xml" />\n<link rel="apple-touch-icon" href="/apple-touch-icon.png" />`
    }));
    if (data.missingAltCount > 0) issues.push(issue(pageUrl, "accessibility", "Medium", "Images missing alt text", `${data.missingAltCount} images do not have alt text.`, "Add meaningful alt text or mark decorative images appropriately.", {
      fixCode: `<!-- Informative image: describe the content -->\n<img src="hero.jpg" alt="Team collaborating on a product roadmap" />\n\n<!-- Decorative image: use empty alt so screen readers skip it -->\n<img src="divider.svg" alt="" role="presentation" />`
    }));
    return issues;
  }

  private async collectUiIssues(page: Page, pageUrl: string): Promise<QaIssue[]> {
    const checks = await page.evaluate(() => {
      const getCssPath = (element: Element): string => {
        const parts: string[] = [];
        let current: Element | null = element;

        while (current && current.nodeType === Node.ELEMENT_NODE && parts.length < 5) {
          const tag = current.tagName.toLowerCase();
          const id = current.id ? `#${CSS.escape(current.id)}` : "";
          if (id) {
            parts.unshift(`${tag}${id}`);
            break;
          }

          const parent: HTMLElement | null = current.parentElement;
          const currentTag = current.tagName;
          const siblings: Element[] = parent ? [...parent.children].filter((sibling) => sibling.tagName === currentTag) : [];
          const index = siblings.indexOf(current) + 1;
          parts.unshift(`${tag}${siblings.length > 1 ? `:nth-of-type(${index})` : ""}`);
          current = parent;
        }

        return parts.join(" > ");
      };

      const viewportWidth = document.documentElement.clientWidth;
      const overflowing = [...document.querySelectorAll("body *")]
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          return rect.width > 0 && (rect.left < -2 || rect.right > viewportWidth + 2);
        })
        .slice(0, 8)
        .map((element) => ({ tag: element.tagName.toLowerCase(), selector: getCssPath(element) }));

      const ctas = [...document.querySelectorAll("button, a")]
        .filter((element) => /start|buy|contact|sign|book|get|try|download/i.test(element.textContent ?? ""))
        .map((element) => element.getBoundingClientRect())
        .filter((rect) => rect.width > 0 && rect.height > 0);

      const tinyTextElements = [...document.querySelectorAll("p, span, a, button, li")]
        .filter((element) => {
          const size = Number.parseFloat(getComputedStyle(element).fontSize);
          return element.textContent?.trim() && size < 12;
        });
      const firstTinyText = tinyTextElements[0] ? getCssPath(tinyTextElements[0]) : undefined;

      return { overflowing, hasVisibleCta: ctas.some((rect) => rect.top < window.innerHeight), tinyText: tinyTextElements.length, firstTinyText };
    });

    const issues: QaIssue[] = [];
    if (checks.overflowing.length > 0) issues.push(issue(pageUrl, "uiux", "High", "Horizontal layout overflow", `Elements overflow the viewport: ${checks.overflowing.map((item) => item.tag).join(", ")}.`, "Constrain wide elements and test responsive breakpoints.", {
      selector: checks.overflowing[0]?.selector,
      evidence: `First overflowing element: ${checks.overflowing[0]?.selector ?? "unknown"}`,
      fixCode: `/* CSS fix — prevent horizontal overflow */\n.your-element {\n  max-width: 100%;\n  overflow-x: hidden;\n  word-break: break-word;\n}\n\n/* Or globally on the body to debug the culprit: */\nbody { overflow-x: hidden; }`
    }));
    if (!checks.hasVisibleCta) issues.push(issue(pageUrl, "uiux", "Medium", "Primary CTA may be hard to find", "No common CTA was visible in the first viewport.", "Place a clear primary action above the fold.", {
      fixCode: `<!-- Add a prominent CTA in the hero section, visible without scrolling -->\n<section class="hero">\n  <h1>Your compelling headline</h1>\n  <p>Supporting description that builds intent.</p>\n  <a href="/get-started" class="btn-primary">Get started free</a>\n</section>`
    }));
    if (checks.tinyText > 0) issues.push(issue(pageUrl, "uiux", "Low", "Small text readability concern", `${checks.tinyText} text elements are below 12px.`, "Increase small body text and secondary actions to readable sizes.", {
      selector: checks.firstTinyText,
      evidence: `First small text element: ${checks.firstTinyText ?? "unknown"}`,
      fixCode: `/* CSS fix — enforce minimum readable font sizes */\nbody {\n  font-size: 16px; /* base */\n}\n\n.caption, .helper-text, small {\n  font-size: 14px; /* never below 12px */\n  line-height: 1.5;\n}`
    }));
    return issues;
  }

  private async collectAccessibilityIssues(page: Page, pageUrl: string): Promise<QaIssue[]> {
    await page.addScriptTag({ content: axeSource.source }).catch(() => undefined);
    const results = await page.evaluate(async () => {
      const axe = (window as typeof window & { axe?: { run: () => Promise<{ violations: Array<{ id: string; impact?: string; description: string; help: string; nodes: Array<{ target: string[] }> }> }> } }).axe;
      return axe ? axe.run() : { violations: [] };
    }).catch(() => ({ violations: [] }));

    return results.violations.slice(0, 20).map((violation) =>
      issue(
        pageUrl,
        "accessibility",
        axeImpactToSeverity(violation.impact),
        violation.help,
        violation.description,
        `Resolve WCAG issue ${violation.id}. First affected target: ${violation.nodes[0]?.target.join(" ") ?? "unknown"}.`,
        {
          selector: violation.nodes[0]?.target[0],
          evidence: `WCAG rule ${violation.id}; first affected target: ${violation.nodes[0]?.target.join(" ") ?? "unknown"}.`,
          fixCode: buildA11yFixCode(violation.id, violation.nodes[0]?.target[0])
        }
      )
    );
  }

  private async collectPerformanceIssues(page: Page, pageUrl: string, loadTimeMs: number): Promise<QaIssue[]> {
    const issues: QaIssue[] = [];
    const metrics = await this.collectMetrics(page);
    if (loadTimeMs > 5000) issues.push(issue(pageUrl, "performance", "High", "Slow page load", `Page load took ${loadTimeMs}ms.`, "Reduce render blocking work, optimize server response time, and defer non-critical assets.", {
      fixCode: `<!-- Defer non-critical scripts -->\n<script src="analytics.js" defer></script>\n\n<!-- Preload critical assets -->\n<link rel="preload" href="/fonts/main.woff2" as="font" type="font/woff2" crossorigin />\n<link rel="preload" href="/styles/critical.css" as="style" />\n\n<!-- Enable compression in your server config (nginx example) -->\n# gzip on;\n# gzip_types text/plain text/css application/javascript;`
    }));
    if (metrics.totalTransferSizeKb > 3000) issues.push(issue(pageUrl, "performance", "Medium", "Heavy page assets", `Approximate transfer size is ${metrics.totalTransferSizeKb} KB.`, "Compress images, remove unused scripts, and split bundles.", {
      fixCode: `/* Next.js — use next/image for automatic optimisation */\nimport Image from 'next/image';\n// <Image src="/hero.jpg" alt="Hero" width={1200} height={600} priority />\n\n/* Lazy-load below-the-fold images */\n<img src="below-fold.jpg" alt="..." loading="lazy" />\n\n/* Audit and remove unused JS with: */\n// npx next build && npx @next/bundle-analyzer`
    }));
    if (metrics.resourceCount > 120) issues.push(issue(pageUrl, "performance", "Medium", "High resource count", `${metrics.resourceCount} resources were loaded.`, "Consolidate assets and remove unused third-party scripts.", {
      fixCode: `<!-- Audit third-party scripts and remove unused ones -->\n<!-- Before: -->\n<!-- <script src="https://cdn.example.com/unused-widget.js"></script> -->\n\n<!-- Delay non-essential third-party scripts -->\n<script>\n  window.addEventListener('load', () => {\n    const s = document.createElement('script');\n    s.src = 'https://cdn.example.com/analytics.js';\n    document.head.appendChild(s);\n  });\n</script>`
    }));
    return issues;
  }

  private async collectMetrics(page: Page): Promise<PageAuditResult["metrics"]> {
    return page.evaluate(() => {
      const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
      const totalTransferSizeKb = Math.round(resources.reduce((sum, item) => sum + (item.transferSize || 0), 0) / 1024);
      return {
        domContentLoadedMs: nav ? Math.round(nav.domContentLoadedEventEnd) : undefined,
        loadEventMs: nav ? Math.round(nav.loadEventEnd) : undefined,
        resourceCount: resources.length,
        totalTransferSizeKb
      };
    }).catch(() => ({
      resourceCount: 0,
      totalTransferSizeKb: 0
    }));
  }
}

function issue(
  pageUrl: string,
  category: QaIssue["category"],
  severity: Severity,
  title: string,
  description: string,
  recommendation: string,
  options: Pick<QaIssue, "selector" | "evidence" | "fixCode"> = {}
): QaIssue {
  return {
    id: createId("issue"),
    pageUrl,
    title,
    description,
    severity,
    category,
    selector: options.selector,
    evidence: options.evidence,
    fixCode: options.fixCode,
    recommendation,
    userImpact: severity === "Critical" || severity === "High" ? "May block conversion, trust, or task completion." : "May reduce polish, clarity, or accessibility."
  };
}

function axeImpactToSeverity(impact?: string): Severity {
  if (impact === "critical") return "Critical";
  if (impact === "serious") return "High";
  if (impact === "moderate") return "Medium";
  return "Low";
}

const A11Y_FIX_SNIPPETS: Record<string, string> = {
  "color-contrast": `/* Ensure text meets WCAG AA contrast (4.5:1 for normal text) */\n.your-text {\n  color: #1a1a1a;       /* dark text on light bg */\n  background-color: #ffffff;\n}\n/* Check ratios at: https://webaim.org/resources/contrastchecker/ */`,
  "image-alt": `<!-- Add descriptive alt text to every informative image -->\n<img src="product.jpg" alt="Blue running shoe with white sole" />\n<!-- Decorative images use empty alt: -->\n<img src="divider.svg" alt="" role="presentation" />`,
  "button-name": `<!-- Give buttons an accessible name -->\n<button type="button" aria-label="Close dialog">\n  <svg aria-hidden="true">...</svg>\n</button>`,
  "link-name": `<!-- Give links meaningful text —avoid "click here" -->\n<a href="/pricing">View pricing plans</a>\n<!-- Or use aria-label for icon links: -->\n<a href="/pricing" aria-label="View pricing plans"><svg aria-hidden="true" /></a>`,
  "label": `<!-- Associate every form input with a visible label -->\n<label for="email">Email address</label>\n<input id="email" type="email" name="email" autocomplete="email" />`,
  "landmark-one-main": `<!-- Wrap main content in a <main> landmark -->\n<header>...</header>\n<main id="main-content"><!-- page content --></main>\n<footer>...</footer>`,
  "heading-order": `<!-- Use heading levels sequentially (h1 → h2 → h3) -->\n<h1>Page title</h1>\n  <h2>Section title</h2>\n    <h3>Subsection</h3>\n<!-- Never skip levels for visual styling — use CSS instead -->`,
  "focus-trap": `/* Ensure keyboard focus is always visible */\n:focus-visible {\n  outline: 2px solid #0066cc;\n  outline-offset: 2px;\n}`
};

function buildA11yFixCode(ruleId: string, selector?: string): string {
  const known = A11Y_FIX_SNIPPETS[ruleId];
  if (known) return known;
  const target = selector ? `\n/* Affected element: ${selector} */` : "";
  return `/* Fix WCAG rule: ${ruleId} */${target}\n/* See: https://dequeuniversity.com/rules/axe/latest/${ruleId} */`;
}
