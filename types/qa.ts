export type Severity = "Low" | "Medium" | "High" | "Critical";

export type IssueCategory =
  | "technical"
  | "uiux"
  | "accessibility"
  | "performance"
  | "seo";

export type JobStatus = "queued" | "running" | "completed" | "failed";

export interface QaIssue {
  id: string;
  pageUrl: string;
  title: string;
  description: string;
  severity: Severity;
  category: IssueCategory;
  selector?: string;
  evidence?: string;
  screenshotPath?: string;
  recommendation: string;
  fixCode?: string;
  userImpact?: string;
}

export interface PageAuditResult {
  url: string;
  title: string;
  statusCode?: number;
  loadTimeMs: number;
  screenshotPath: string;
  issues: QaIssue[];
  metrics: {
    domContentLoadedMs?: number;
    loadEventMs?: number;
    resourceCount: number;
    totalTransferSizeKb: number;
  };
}

export interface SeverityBreakdown {
  Low: number;
  Medium: number;
  High: number;
  Critical: number;
}

export interface QaReport {
  jobId: string;
  targetUrl: string;
  startedAt: string;
  completedAt: string;
  pagesTested: string[];
  totalIssues: number;
  severityBreakdown: SeverityBreakdown;
  pageResults: PageAuditResult[];
  aiSummary: string;
  aiRecommendations: string[];
  pdfPath: string;
}

export interface QaJob {
  id: string;
  targetUrl: string;
  status: JobStatus;
  progress: number;
  logs: string[];
  createdAt: string;
  updatedAt: string;
  error?: string;
  report?: QaReport;
}

export interface CrawlOptions {
  maxPages: number;
  maxDepth: number;
}

export interface AiAnalysisInput {
  targetUrl: string;
  pageResults: PageAuditResult[];
}

export interface AiProvider {
  analyze(input: AiAnalysisInput): Promise<{
    summary: string;
    recommendations: string[];
    issues: QaIssue[];
  }>;
}
