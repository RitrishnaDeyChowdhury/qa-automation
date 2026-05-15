import type { QaJob } from "@/types/qa";
import { appConfig } from "@/lib/config";

const g = globalThis as typeof globalThis & { __qaJobs?: Map<string, QaJob> };
if (!g.__qaJobs) g.__qaJobs = new Map<string, QaJob>();
const jobs = g.__qaJobs;

export const jobStore = {
  create(job: QaJob): QaJob {
    jobs.set(job.id, job);
    return job;
  },

  get(id: string): QaJob | undefined {
    return jobs.get(id);
  },

  update(id: string, updater: (job: QaJob) => void): QaJob | undefined {
    const job = jobs.get(id);
    if (!job) return undefined;
    updater(job);
    job.updatedAt = new Date().toISOString();
    return job;
  },

  cleanup(): void {
    const ttlMs = appConfig.qa.jobTtlMinutes * 60 * 1000;
    const now = Date.now();
    for (const [id, job] of jobs) {
      if (now - new Date(job.createdAt).getTime() > ttlMs) {
        jobs.delete(id);
      }
    }
  }
};
