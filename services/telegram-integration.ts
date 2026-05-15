import type { QaReport } from "@/types/qa";

export interface TelegramNotifier {
  sendReportReady(report: QaReport): Promise<void>;
}

export class NoopTelegramNotifier implements TelegramNotifier {
  async sendReportReady(report: QaReport): Promise<void> {
    void report;
    // Future integration point for Telegram bot notifications.
  }
}
