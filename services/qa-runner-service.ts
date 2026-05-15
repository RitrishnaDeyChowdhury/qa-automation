import { appConfig } from "@/lib/config";
import { browserService } from "@/services/browser-service";
import { CrawlerService } from "@/services/crawler-service";
import { QaCheckService } from "@/services/qa-check-service";
import { AiAnalysisService } from "@/services/ai-analysis-service";
import { ReportGenerationService } from "@/services/report-generation-service";
import { NoopTelegramNotifier } from "@/services/telegram-integration";
import { JobLogger } from "@/services/logger-service";
import { jobStore } from "@/services/job-store";
import type { QaJob, QaReport } from "@/types/qa";
import { getSeverityBreakdown } from "@/utils/severity";

export class QaRunnerService {
  private readonly crawler = new CrawlerService();
  private readonly checks = new QaCheckService();
  private readonly ai = new AiAnalysisService();
  private readonly reports = new ReportGenerationService();
  private readonly telegram = new NoopTelegramNotifier();

  async run(job: QaJob): Promise<void> {
    const logger = new JobLogger(job);

    try {
      job.status = "running";
      logger.progress(5, "Validated URL and queued browser automation.");

      await browserService.withPage(async (page) => {
        logger.progress(12, "Crawling internal navigation, header, and footer links.");
        const pages = await this.crawler.crawl(new URL(job.targetUrl), page, {
          maxPages: appConfig.qa.maxPages,
          maxDepth: appConfig.qa.maxDepth
        });

        logger.progress(25, `Discovered ${pages.length} internal page${pages.length === 1 ? "" : "s"}.`);
        const pageResults = [];

        for (let index = 0; index < pages.length; index += 1) {
          const pageUrl = pages[index];
          logger.info(`Auditing ${pageUrl}`);
          const result = await this.checks.auditPage(page, pageUrl, job.id);
          pageResults.push(result);
          logger.progress(25 + Math.round(((index + 1) / pages.length) * 45));
        }

        logger.progress(76, "Running AI analysis on scan evidence.");
        const aiResult = await this.ai.analyze({ targetUrl: job.targetUrl, pageResults });
        if (aiResult.issues.length > 0) {
          for (const aiIssue of aiResult.issues) {
            const matchingPage =
              pageResults.find((result) => result.url === aiIssue.pageUrl) ??
              pageResults.find((result) => result.url === job.targetUrl) ??
              pageResults[0];
            aiIssue.pageUrl = matchingPage?.url ?? aiIssue.pageUrl;
            aiIssue.screenshotPath = matchingPage?.screenshotPath;
          }
          for (const aiIssue of aiResult.issues) {
            const matchingPage = pageResults.find((result) => result.url === aiIssue.pageUrl) ?? pageResults[0];
            matchingPage?.issues.push(aiIssue);
          }
        }

        const allIssues = pageResults.flatMap((result) => result.issues);
        const reportBase: Omit<QaReport, "pdfPath"> = {
          jobId: job.id,
          targetUrl: job.targetUrl,
          startedAt: job.createdAt,
          completedAt: new Date().toISOString(),
          pagesTested: pages,
          totalIssues: allIssues.length,
          severityBreakdown: getSeverityBreakdown(allIssues),
          pageResults,
          aiSummary: aiResult.summary,
          aiRecommendations: aiResult.recommendations
        };

        logger.progress(88, "Generating polished PDF report.");
        const pdfPath = await this.reports.generate(reportBase);
        const report: QaReport = { ...reportBase, pdfPath };
        await this.telegram.sendReportReady(report);

        job.report = report;
        job.status = "completed";
        logger.progress(100, "QA report is ready to download.");
      });
    } catch (error) {
      job.status = "failed";
      job.error = error instanceof Error ? error.message : "Unknown scan failure.";
      logger.progress(job.progress, `Scan failed: ${job.error}`);
    } finally {
      job.updatedAt = new Date().toISOString();
      jobStore.cleanup();
    }
  }
}

export const qaRunnerService = new QaRunnerService();
