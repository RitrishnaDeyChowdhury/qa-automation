import path from "node:path";

export const appConfig = {
  storage: {
    reportsDir: path.join(process.cwd(), "reports"),
    screenshotsDir: path.join(process.cwd(), "screenshots"),
    tempDir: path.join(process.cwd(), "temp")
  },
  qa: {
    maxPages: Number(process.env.QA_MAX_PAGES ?? 8),
    maxDepth: Number(process.env.QA_MAX_DEPTH ?? 2),
    navigationTimeoutMs: Number(process.env.QA_NAVIGATION_TIMEOUT_MS ?? 20000),
    jobTtlMinutes: Number(process.env.QA_JOB_TTL_MINUTES ?? 120)
  },
  ai: {
    provider: process.env.AI_PROVIDER ?? "gemini",
    geminiApiKey: process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY
  }
};
