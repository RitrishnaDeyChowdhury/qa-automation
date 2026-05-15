"use client";

import { AlertCircle, CheckCircle2, Code2, Download, Eye, Loader2, MapPin, Play, Radar, ShieldCheck, Terminal, WandSparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ScreenshotModal } from "@/components/screenshot-modal";
import type { QaJob, QaIssue, SeverityBreakdown } from "@/types/qa";

const emptyBreakdown: SeverityBreakdown = { Critical: 0, High: 0, Medium: 0, Low: 0 };

export function QaDashboard() {
  const [url, setUrl] = useState("https://example.com");
  const [jobId, setJobId] = useState<string>();
  const [job, setJob] = useState<QaJob>();
  const [error, setError] = useState<string>();
  const [preview, setPreview] = useState<{
    src: string;
    title: string;
    pageUrl?: string;
    evidence?: string;
    recommendation?: string;
    selector?: string;
  }>();
  const isRunning = job?.status === "queued" || job?.status === "running";
  const isFailed = job?.status === "failed";

  useEffect(() => {
    if (!jobId || job?.status === "completed" || job?.status === "failed") return;
    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/qa/status?jobId=${jobId}`, { cache: "no-store" });
        const data = (await response.json()) as QaJob | { error: string };
        if ("error" in data) {
          setError(data.error);
          window.clearInterval(timer);
          return;
        }
        setJob(data);
        if (data.status === "failed") {
          setError(data.error ?? "The scan failed. Check the logs for details.");
          window.clearInterval(timer);
        }
      } catch {
        setError("Lost connection while polling scan status.");
        window.clearInterval(timer);
      }
    }, 1400);
    return () => window.clearInterval(timer);
  }, [jobId, job?.status]);

  async function startScan() {
    setError(undefined);
    setJob(undefined);
    const response = await fetch("/api/qa/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url })
    });
    const data = (await response.json()) as { jobId?: string; error?: string };
    if (!response.ok || !data.jobId) {
      setError(data.error ?? "Unable to start QA scan.");
      return;
    }
    setJobId(data.jobId);
    setJob({
      id: data.jobId,
      targetUrl: url,
      status: "queued",
      progress: 2,
      logs: ["Scan created."],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }

  const issues = useMemo<QaIssue[]>(() => job?.report?.pageResults.flatMap((page) => page.issues) ?? [], [job]);
  const breakdown = job?.report?.severityBreakdown ?? emptyBreakdown;

  return (
    <main className="mesh-bg min-h-screen">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-ink text-mint dark:bg-mint dark:text-ink">
            <Radar className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.24em] text-steel dark:text-mint">Inspectra</p>
            <p className="text-xs text-black/55 dark:text-white/55">AI website QA automation</p>
          </div>
        </div>
      </nav>

      <section className="mx-auto grid max-w-7xl gap-8 px-5 pb-10 pt-8 lg:grid-cols-[1.02fr_0.98fr] lg:items-center">
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-md border border-black/10 bg-white/65 px-3 py-2 text-sm text-ink shadow-sm dark:border-white/10 dark:bg-white/10 dark:text-white">
            <WandSparkles className="h-4 w-4 text-coral" />
            Playwright scans, Gemini analysis, PDF reports
          </div>
          <h1 className="max-w-3xl text-4xl font-black leading-tight text-ink sm:text-5xl lg:text-6xl dark:text-white">
            QA a live website like a senior product engineer.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-black/65 dark:text-white/65">
            Enter a public URL and Inspectra crawls internal pages, checks technical quality, accessibility, UX, performance, captures evidence, and assembles a polished PDF report.
          </p>

          <div className="mt-8 rounded-lg border border-black/10 bg-white/78 p-3 shadow-glow backdrop-blur dark:border-white/10 dark:bg-white/10">
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://your-site.com"
                className="min-h-12 flex-1 rounded-md border border-black/10 bg-white px-4 text-sm text-ink outline-none transition focus:border-steel focus:ring-4 focus:ring-steel/15 dark:border-white/10 dark:bg-[#111820] dark:text-white"
              />
              <button
                type="button"
                onClick={startScan}
                disabled={isRunning}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-ink px-5 text-sm font-bold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60 dark:bg-mint dark:text-ink dark:hover:bg-[#B6EFE1]"
              >
                {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Start QA
              </button>
            </div>
            {error ? <p className="mt-3 text-sm font-medium text-red-600 dark:text-red-300">{error}</p> : null}
          </div>
        </div>

        <div className="rounded-lg border border-black/10 bg-[#101720] p-4 shadow-glow dark:border-white/10">
          <div className="grid gap-3 sm:grid-cols-2">
            <Metric label="Pages tested" value={String(job?.report?.pagesTested.length ?? 0)} />
            <Metric label="Issues found" value={String(job?.report?.totalIssues ?? issues.length)} />
            <Metric label="Progress" value={`${job?.progress ?? 0}%`} />
            <Metric label="Status" value={job?.status ?? "idle"} />
          </div>
          <div className="mt-4 h-3 overflow-hidden rounded-md bg-white/10">
            <div className="h-full rounded-md bg-mint transition-all" style={{ width: `${job?.progress ?? 0}%` }} />
          </div>
          <div className="mt-5 grid grid-cols-4 gap-2">
            {Object.entries(breakdown).map(([label, value]) => (
              <div key={label} className="rounded-md bg-white/8 p-3">
                <p className="text-lg font-black text-white">{value}</p>
                <p className="mt-1 text-xs text-white/60">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-5 pb-16 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-lg border border-black/10 bg-white/78 p-5 shadow-sm dark:border-white/10 dark:bg-white/10">
          <div className="mb-4 flex items-center gap-2">
            <Terminal className="h-4 w-4 text-steel dark:text-mint" />
            <h2 className="text-lg font-bold text-ink dark:text-white">Live Progress</h2>
          </div>
          <div className="h-72 overflow-auto rounded-md bg-ink p-4 font-mono text-xs text-mint">
            {(job?.logs ?? ["Ready to scan a public website."]).map((line, index) => (
              <p key={`${line}-${index}`} className="mb-2 whitespace-pre-wrap">{line}</p>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-black/10 bg-white/78 p-5 shadow-sm dark:border-white/10 dark:bg-white/10">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-steel dark:text-mint" />
              <h2 className="text-lg font-bold text-ink dark:text-white">Report Results</h2>
            </div>
            {job?.status === "completed" ? (
              <a
                href={`/api/qa/report?jobId=${job.id}`}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-coral px-4 text-sm font-bold text-white transition hover:bg-[#E86449]"
              >
                <Download className="h-4 w-4" />
                Download PDF
              </a>
            ) : null}
          </div>
          {isFailed && error ? (
            <div className="mt-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          <div className="mt-5 grid gap-3">
            {issues.length === 0 ? (
              <EmptyState running={isRunning} failed={isFailed} />
            ) : (
              issues.slice(0, 8).map((issue) => (
                <IssueCard key={issue.id} issue={issue} onPreview={setPreview} />
              ))
            )}
          </div>
        </div>
      </section>
      <ScreenshotModal
        src={preview?.src}
        title={preview?.title}
        pageUrl={preview?.pageUrl}
        evidence={preview?.evidence}
        recommendation={preview?.recommendation}
        selector={preview?.selector}
        onClose={() => setPreview(undefined)}
      />
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-white/8 p-4">
      <p className="text-2xl font-black text-white">{value}</p>
      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-white/55">{label}</p>
    </div>
  );
}

function EmptyState({ running, failed }: { running: boolean; failed: boolean }) {
  if (failed) {
    return (
      <div className="flex min-h-60 items-center justify-center rounded-lg border border-dashed border-red-200 p-6 text-center dark:border-red-900/40">
        <div>
          <AlertCircle className="mx-auto h-8 w-8 text-red-500 dark:text-red-400" />
          <p className="mt-3 text-sm font-semibold text-ink dark:text-white">Scan failed</p>
          <p className="mt-1 text-sm text-black/55 dark:text-white/55">Check the error above and the live log for details.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex min-h-60 items-center justify-center rounded-lg border border-dashed border-black/15 p-6 text-center dark:border-white/15">
      <div>
        {running ? <Loader2 className="mx-auto h-8 w-8 animate-spin text-steel dark:text-mint" /> : <CheckCircle2 className="mx-auto h-8 w-8 text-steel dark:text-mint" />}
        <p className="mt-3 text-sm font-semibold text-ink dark:text-white">{running ? "Audit evidence is coming in." : "Results will appear after a scan."}</p>
        <p className="mt-1 text-sm text-black/55 dark:text-white/55">{running ? "The browser is crawling, testing, and preparing a report." : "Start QA to see issue cards, screenshots, and PDF output."}</p>
      </div>
    </div>
  );
}

const SEVERITY_COLORS: Record<string, string> = {
  Critical: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300",
  High: "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300",
  Medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/50 dark:text-yellow-300",
  Low: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
};

function IssueCard({
  issue,
  onPreview
}: {
  issue: QaIssue;
  onPreview: (p: { src: string; title: string; pageUrl?: string; evidence?: string; recommendation?: string; selector?: string }) => void;
}) {
  const [showCode, setShowCode] = useState(false);
  const pageLabel = (() => {
    try { return new URL(issue.pageUrl).pathname || "/"; } catch { return issue.pageUrl; }
  })();

  return (
    <article className="rounded-lg border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-[#111820]">
      {/* header row */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-md px-2 py-0.5 text-xs font-bold uppercase ${SEVERITY_COLORS[issue.severity] ?? "bg-black/5 text-steel dark:bg-white/10 dark:text-mint"}`}>
              {issue.severity}
            </span>
            <span className="rounded-md bg-black/5 px-2 py-0.5 text-xs font-semibold uppercase text-steel dark:bg-white/10 dark:text-mint">
              {issue.category}
            </span>
          </div>
          <h3 className="mt-2 text-base font-bold text-ink dark:text-white">{issue.title}</h3>
        </div>
        {issue.screenshotPath ? (
          <button
            type="button"
            onClick={() => onPreview({
              src: `/api/qa/screenshot?path=${encodeURIComponent(issue.screenshotPath ?? "")}`,
              title: issue.title,
              pageUrl: issue.pageUrl,
              evidence: issue.evidence ?? issue.description,
              recommendation: issue.recommendation,
              selector: issue.selector
            })}
            className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md border border-black/10 px-3 text-xs font-semibold text-ink transition hover:bg-black/5 dark:border-white/10 dark:text-white dark:hover:bg-white/10"
          >
            <Eye className="h-3.5 w-3.5" />
            Preview
          </button>
        ) : null}
      </div>

      <p className="mt-2 text-sm leading-6 text-black/65 dark:text-white/65">{issue.description}</p>

      {/* page + location */}
      <div className="mt-3 flex flex-col gap-1.5 rounded-md bg-black/3 px-3 py-2.5 dark:bg-white/5">
        <div className="flex items-start gap-1.5 text-xs text-black/60 dark:text-white/55">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-steel dark:text-mint" />
          <div className="min-w-0">
            <span className="font-semibold text-ink dark:text-white">Page: </span>
            <span className="break-all">{pageLabel}</span>
            <span className="ml-1 text-black/40 dark:text-white/30 break-all">({issue.pageUrl})</span>
          </div>
        </div>
        {issue.selector ? (
          <div className="flex items-start gap-1.5 text-xs text-black/60 dark:text-white/55">
            <Code2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-steel dark:text-mint" />
            <div className="min-w-0">
              <span className="font-semibold text-ink dark:text-white">Location: </span>
              <code className="break-all rounded bg-black/5 px-1 font-mono text-[11px] dark:bg-white/10">{issue.selector}</code>
            </div>
          </div>
        ) : null}
        {issue.evidence ? (
          <p className="text-xs text-black/55 dark:text-white/50 pl-5">Evidence: {issue.evidence}</p>
        ) : null}
      </div>

      {/* recommendation */}
      <p className="mt-3 text-sm font-medium text-ink dark:text-white">
        <span className="text-steel dark:text-mint">Fix: </span>{issue.recommendation}
      </p>

      {/* fix code */}
      {issue.fixCode ? (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowCode((v) => !v)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-steel transition hover:text-ink dark:text-mint dark:hover:text-white"
          >
            <Code2 className="h-3.5 w-3.5" />
            {showCode ? "Hide fix code" : "Show fix code"}
          </button>
          {showCode ? (
            <pre className="mt-2 overflow-auto rounded-md bg-ink p-3 text-[11px] leading-5 text-mint scrollbar-thin">
              <code>{issue.fixCode}</code>
            </pre>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
