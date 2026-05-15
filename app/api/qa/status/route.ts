import { NextRequest, NextResponse } from "next/server";
import { jobStore } from "@/services/job-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const jobId = request.nextUrl.searchParams.get("jobId");
  if (!jobId) {
    return NextResponse.json({ error: "jobId is required." }, { status: 400 });
  }

  const job = jobStore.get(jobId);
  if (!job) {
    return NextResponse.json({ error: "Job not found or expired." }, { status: 404 });
  }

  return NextResponse.json(job);
}
