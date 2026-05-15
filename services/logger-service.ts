import type { QaJob } from "@/types/qa";

export class JobLogger {
  constructor(private readonly job: QaJob) {}

  info(message: string): void {
    const time = new Date().toLocaleTimeString("en-US", { hour12: false });
    this.job.logs.push(`[${time}] ${message}`);
    this.job.updatedAt = new Date().toISOString();
  }

  progress(value: number, message?: string): void {
    this.job.progress = Math.max(0, Math.min(100, value));
    if (message) {
      this.info(message);
    }
  }
}
