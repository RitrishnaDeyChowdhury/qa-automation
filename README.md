# Inspectra AI QA Automation SaaS

Production-minded MVP foundation for an AI-powered website QA platform built with Next.js App Router, TypeScript, Tailwind CSS, Playwright, Gemini analysis, local screenshot storage, and PDF report generation.

## Features

- Public URL validation with SSRF protection
- Async in-memory scan jobs with live progress polling
- Internal crawler for homepage, navbar, footer, and same-origin links
- Playwright QA checks for console errors, runtime errors, failed requests, broken links, broken images, SEO metadata, accessibility, UI responsiveness, and performance signals
- Screenshot capture for audited pages and issue evidence
- AI analysis layer powered by Gemini
- Professional PDF report with severity summary, detailed issues, recommendations, and screenshots
- Modern responsive SaaS UI with dark mode, live logs, report cards, and screenshot modal
- Placeholder Telegram notifier hook for future bot integration
- No database required

## Getting Started

```bash
npm install
npx playwright install chromium
cp .env.example .env
npm run dev
```

Open `http://localhost:3002`.

## Environment

```txt
GEMINI_API_KEY=your_gemini_key
AI_PROVIDER=gemini
QA_MAX_PAGES=8
QA_MAX_DEPTH=2
QA_NAVIGATION_TIMEOUT_MS=20000
QA_JOB_TTL_MINUTES=120
```

If no Gemini key is configured, the scan still runs and produces a report with rule-based recommendations.

## API

### `POST /api/qa/start`

```json
{ "url": "https://example.com" }
```

Returns:

```json
{ "jobId": "qa_...", "status": "queued" }
```

### `GET /api/qa/status?jobId=qa_...`

Returns the in-memory job, progress logs, and report metadata when complete.

### `GET /api/qa/report?jobId=qa_...`

Downloads the generated PDF report.

## Example QA Flow

1. Enter `https://example.com`.
2. Click **Start QA**.
3. The crawler discovers same-origin links up to `QA_MAX_DEPTH`.
4. Playwright audits each page and stores screenshots in `/screenshots`.
5. Gemini or OpenAI receives compact scan evidence and optional screenshot context.
6. The PDF report is written to `/reports`.
7. The UI exposes issue cards, screenshot previews, live logs, and the download button.

## Architecture

```txt
/app
/components
/lib
/services
/utils
/types
/reports
/screenshots
/temp
```

Core services:

- `browser-service`: Playwright lifecycle
- `crawler-service`: same-origin crawl queue
- `qa-check-service`: technical, accessibility, UI/UX, SEO, performance checks
- `screenshot-service`: organized local screenshots
- `ai-analysis-service`: Gemini provider behind an AI analysis service boundary
- `report-generation-service`: PDF and JSON report output
- `job-store`: temporary in-memory job state
- `telegram-integration`: future bot notification contract

## Notes For Production Hardening

- Replace the in-memory job store with Redis or a database-backed queue before multi-instance deploys.
- Move screenshots and reports to cloud object storage for durable history.
- Add authenticated users, team ownership, and per-user rate limits.
- Run scans in isolated workers or containers for stronger browser sandboxing.
- Add CI-triggered scans and scheduled recurring scans using the existing service boundary.
