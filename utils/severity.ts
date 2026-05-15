import type { QaIssue, Severity, SeverityBreakdown } from "@/types/qa";

export const severityRank: Record<Severity, number> = {
  Low: 1,
  Medium: 2,
  High: 3,
  Critical: 4
};

export function getSeverityBreakdown(issues: QaIssue[]): SeverityBreakdown {
  return issues.reduce<SeverityBreakdown>(
    (breakdown, issue) => {
      breakdown[issue.severity] += 1;
      return breakdown;
    },
    { Low: 0, Medium: 0, High: 0, Critical: 0 }
  );
}

export function sortIssuesBySeverity(issues: QaIssue[]): QaIssue[] {
  return [...issues].sort(
    (a, b) => severityRank[b.severity] - severityRank[a.severity]
  );
}
