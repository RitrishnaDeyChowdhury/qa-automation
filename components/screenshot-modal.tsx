"use client";

import { Code2, MapPin, X } from "lucide-react";

interface ScreenshotModalProps {
  src?: string;
  title?: string;
  pageUrl?: string;
  selector?: string;
  evidence?: string;
  recommendation?: string;
  onClose: () => void;
}

export function ScreenshotModal({ src, title, pageUrl, selector, evidence, recommendation, onClose }: ScreenshotModalProps) {
  if (!src) return null;

  const pageLabel = pageUrl
    ? (() => { try { return new URL(pageUrl).pathname || "/"; } catch { return pageUrl; } })()
    : undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-lg bg-white shadow-glow dark:bg-[#111820]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-black/10 px-4 py-3 dark:border-white/10">
          <p className="text-sm font-semibold text-ink dark:text-white">{title ?? "Screenshot preview"}</p>
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-ink transition hover:bg-black/5 dark:text-white dark:hover:bg-white/10"
            onClick={onClose}
            aria-label="Close screenshot preview"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {(pageUrl || selector || evidence || recommendation) ? (
          <div className="grid gap-2 border-b border-black/10 px-4 py-3 text-sm dark:border-white/10">
            {pageLabel ? (
              <div className="flex items-start gap-2 text-black/65 dark:text-white/65">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-steel dark:text-mint" />
                <span>
                  <span className="font-semibold text-ink dark:text-white">Page: </span>
                  <span className="break-all">{pageLabel}</span>
                  <span className="ml-1 text-black/40 dark:text-white/30 break-all">({pageUrl})</span>
                </span>
              </div>
            ) : null}
            {selector ? (
              <div className="flex items-start gap-2 text-black/65 dark:text-white/65">
                <Code2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-steel dark:text-mint" />
                <span>
                  <span className="font-semibold text-ink dark:text-white">Location: </span>
                  <code className="break-all rounded bg-black/5 px-1 font-mono text-[11px] dark:bg-white/10">{selector}</code>
                </span>
              </div>
            ) : null}
            {evidence ? <p className="pl-5 text-black/75 dark:text-white/75">Evidence: {evidence}</p> : null}
            {recommendation ? <p className="pl-5 font-medium text-ink dark:text-white">Fix: {recommendation}</p> : null}
          </div>
        ) : null}

        <div className="max-h-[70vh] overflow-auto bg-[#111820] p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={title ?? "Captured website screenshot"} className="mx-auto max-w-full rounded-md" />
        </div>
      </div>
    </div>
  );
}
