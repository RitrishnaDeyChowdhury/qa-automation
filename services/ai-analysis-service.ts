import fs from "node:fs/promises";
import { GoogleGenAI } from "@google/genai";
import { appConfig } from "@/lib/config";
import type { AiAnalysisInput, AiProvider, QaIssue } from "@/types/qa";
import { createId } from "@/utils/id";

const fallback = {
  summary:
    "Automated QA completed. AI recommendations are rule-based because no AI API key is configured.",
  recommendations: [
    "Prioritize Critical and High issues first because they usually affect task completion.",
    "Retest mobile breakpoints after layout and accessibility fixes.",
    "Add this QA scan to release checks before major deploys."
  ]
};

export class AiAnalysisService implements AiProvider {
  async analyze(input: AiAnalysisInput): Promise<{
    summary: string;
    recommendations: string[];
    issues: QaIssue[];
  }> {
    if (appConfig.ai.geminiApiKey) {
      return this.analyzeWithGemini(input);
    }

    return { ...fallback, issues: [] };
  }

  private async analyzeWithGemini(input: AiAnalysisInput) {
    const ai = new GoogleGenAI({ apiKey: appConfig.ai.geminiApiKey });
    const firstScreenshot = input.pageResults[0]?.screenshotPath;
    const imagePart = firstScreenshot
      ? {
          inlineData: {
            mimeType: "image/png",
            data: await fs.readFile(firstScreenshot, "base64")
          }
        }
      : undefined;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: buildPrompt(input) },
            ...(imagePart ? [imagePart] : [])
          ]
        }
      ]
    });

    return parseAiResponse(response.text ?? "", input);
  }

}

function buildPrompt(input: AiAnalysisInput): string {
  const compact = input.pageResults.map((page) => ({
    url: page.url,
    title: page.title,
    loadTimeMs: page.loadTimeMs,
    metrics: page.metrics,
    issues: page.issues.map((issue) => ({
      title: issue.title,
      category: issue.category,
      severity: issue.severity,
      description: issue.description
    }))
  }));

  return `You are a senior QA analyst for a SaaS website audit.
Return strict JSON with keys summary, recommendations, issues.
issues must be an array of extra design/UX observations. Each issue must have:
  pageUrl (exact URL from scan data), title, description, severity, category, recommendation, userImpact, evidence, and fixCode.
fixCode must be a short, concrete HTML/CSS/JS code snippet (≤15 lines) that directly fixes the issue on the affected element or section.
Use the exact pageUrl from the scan data that best matches each observation.
Severity must be Low, Medium, High, or Critical. Category must be technical, uiux, accessibility, performance, or seo.

Target URL: ${input.targetUrl}
Scan data:
${JSON.stringify(compact, null, 2)}`;
}

function parseAiResponse(text: string, input: AiAnalysisInput): {
  summary: string;
  recommendations: string[];
  issues: QaIssue[];
} {
  try {
    const jsonText = text.replace(/^```json/i, "").replace(/^```/, "").replace(/```$/, "").trim();
    const parsed = JSON.parse(jsonText) as {
      summary?: string;
      recommendations?: string[];
      issues?: Array<Partial<QaIssue>>;
    };

    return {
      summary: parsed.summary ?? fallback.summary,
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations.slice(0, 8) : fallback.recommendations,
      issues: (parsed.issues ?? []).slice(0, 12).map((item) => ({
        id: createId("ai_issue"),
        pageUrl: item.pageUrl ?? input.targetUrl,
        title: item.title ?? "AI design observation",
        description: item.description ?? "AI detected a potential quality issue.",
        severity: item.severity ?? "Medium",
        category: item.category ?? "uiux",
        evidence: item.evidence,
        fixCode: item.fixCode,
        recommendation: item.recommendation ?? "Review and refine the affected experience.",
        userImpact: item.userImpact ?? "May affect visitor confidence or conversion."
      }))
    };
  } catch {
    return {
      summary: text.trim().slice(0, 1200) || fallback.summary,
      recommendations: fallback.recommendations,
      issues: []
    };
  }
}
