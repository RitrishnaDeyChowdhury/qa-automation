import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import PDFDocument from "pdfkit";
import { appConfig } from "@/lib/config";
import type { QaReport } from "@/types/qa";
import { sortIssuesBySeverity } from "@/utils/severity";

export class ReportGenerationService {
  async generate(report: Omit<QaReport, "pdfPath">): Promise<string> {
    await fsp.mkdir(appConfig.storage.reportsDir, { recursive: true });
    const pdfPath = path.join(appConfig.storage.reportsDir, `${report.jobId}-qa-report.pdf`);

    await new Promise<void>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 48, size: "A4", autoFirstPage: true });
      const stream = fs.createWriteStream(pdfPath);
      doc.pipe(stream);

      this.header(doc, "AI QA Automation Report", report.targetUrl);
      doc.moveDown();
      this.meta(doc, report);
      this.severity(doc, report);
      this.section(doc, "Executive Summary");
      doc.fontSize(11).fillColor("#2F3747").text(report.aiSummary, { lineGap: 4 });

      this.section(doc, "Recommendations");
      for (const recommendation of report.aiRecommendations) {
        doc.fontSize(10).fillColor("#2F3747").text(`• ${recommendation}`, { lineGap: 3 });
      }

      this.section(doc, "Detailed Issues");
      const issues = sortIssuesBySeverity(report.pageResults.flatMap((page) => page.issues));
      if (issues.length === 0) {
        doc.fontSize(11).fillColor("#2F3747").text("No issues were detected by the automated scan.");
      }

      for (const issue of issues.slice(0, 80)) {
        this.issueBlock(doc, issue);
      }

      this.section(doc, "Screenshots");
      for (const page of report.pageResults.slice(0, 6)) {
        doc.fontSize(11).fillColor("#111827").text(page.title || page.url);
        doc.fontSize(8).fillColor("#5D6678").text(page.url);
        if (fs.existsSync(page.screenshotPath)) {
          try {
            doc.moveDown(0.3).image(page.screenshotPath, { fit: [480, 260], align: "center" });
          } catch {
            doc.text(`Screenshot saved at ${page.screenshotPath}`);
          }
        }
        doc.moveDown();
      }

      doc.end();
      stream.on("finish", resolve);
      stream.on("error", reject);
    });

    await fsp.writeFile(
      path.join(appConfig.storage.reportsDir, `${report.jobId}-qa-report.json`),
      JSON.stringify({ ...report, pdfPath }, null, 2)
    );

    return pdfPath;
  }

  private header(doc: PDFKit.PDFDocument, title: string, subtitle: string): void {
    doc.rect(0, 0, doc.page.width, 118).fill("#0E121B");
    doc.fillColor("#99D8C9").fontSize(11).text("Automated Website Quality Audit", 48, 36);
    doc.fillColor("#FFFFFF").fontSize(25).text(title, 48, 54);
    doc.fillColor("#CBD5E1").fontSize(10).text(subtitle, 48, 88, { width: 500 });
    doc.moveDown(4);
  }

  private meta(doc: PDFKit.PDFDocument, report: Omit<QaReport, "pdfPath">): void {
    doc.fillColor("#111827").fontSize(13).text("Scan Overview");
    doc.moveDown(0.4);
    const rows = [
      ["Scan timestamp", new Date(report.completedAt).toLocaleString()],
      ["Pages tested", String(report.pagesTested.length)],
      ["Total issues", String(report.totalIssues)]
    ];
    for (const [label, value] of rows) {
      doc.fillColor("#5D6678").fontSize(9).text(label, { continued: true, width: 130 });
      doc.fillColor("#111827").text(value);
    }
  }

  private severity(doc: PDFKit.PDFDocument, report: Omit<QaReport, "pdfPath">): void {
    doc.moveDown();
    doc.fillColor("#111827").fontSize(13).text("Severity Breakdown");
    const items = Object.entries(report.severityBreakdown);
    const colors: Record<string, string> = { Critical: "#B91C1C", High: "#EA580C", Medium: "#D97706", Low: "#2563EB" };
    const startY = doc.y + 8;
    items.forEach(([label, count], index) => {
      const x = 48 + index * 124;
      doc.roundedRect(x, startY, 106, 48, 6).fill("#F3F4F6");
      doc.fillColor(colors[label] ?? "#111827").fontSize(17).text(String(count), x + 12, startY + 8);
      doc.fillColor("#374151").fontSize(8).text(label, x + 12, startY + 30);
    });
    doc.y = startY + 62;
  }

  private section(doc: PDFKit.PDFDocument, title: string): void {
    if (doc.y > 680) doc.addPage();
    doc.moveDown();
    doc.fillColor("#0E121B").fontSize(15).text(title);
    doc.moveTo(48, doc.y + 4).lineTo(548, doc.y + 4).strokeColor("#E5E7EB").stroke();
    doc.moveDown();
  }

  private issueBlock(doc: PDFKit.PDFDocument, issue: QaReport["pageResults"][number]["issues"][number]): void {
    if (doc.y > 690) doc.addPage();
    const color = issue.severity === "Critical" ? "#B91C1C" : issue.severity === "High" ? "#EA580C" : issue.severity === "Medium" ? "#D97706" : "#2563EB";
    doc.fillColor(color).fontSize(9).text(`${issue.severity} · ${issue.category.toUpperCase()}`);
    doc.fillColor("#111827").fontSize(12).text(issue.title);
    doc.fillColor("#4B5563").fontSize(9).text(issue.pageUrl, { width: 500 });
    doc.fillColor("#374151").fontSize(10).text(issue.description, { lineGap: 2 });
    doc.fillColor("#111827").fontSize(10).text(`Suggested fix: ${issue.recommendation}`, { lineGap: 2 });
    doc.moveDown();
  }
}
