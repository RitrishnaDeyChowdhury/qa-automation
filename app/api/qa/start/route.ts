import { NextRequest, NextResponse } from "next/server";
import { createId } from "@/utils/id";
import { validateTargetUrl } from "@/utils/url-security";
import { jobStore } from "@/services/job-store";
import { qaRunnerService } from "@/services/qa-runner-service";
import { assertRateLimit } from "@/services/rate-limit-service";
import type { QaJob } from "@/types/qa";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    assertRateLimit(request.headers.get("x-forwarded-for") ?? "local");
    const body = (await request.json()) as { url?: string };
    const target = await validateTargetUrl(body.url ?? "");
    const now = new Date().toISOString();
    const job: QaJob = {
      id: createId("qa"),
      targetUrl: target.toString(),
      status: "queued",
      progress: 0,
      logs: ["Scan created."],
      createdAt: now,
      updatedAt: now
    };

    jobStore.create(job);
    void qaRunnerService.run(job);

    return NextResponse.json({ jobId: job.id, status: job.status });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to start scan." },
      { status: 400 }
    );
  }
}
