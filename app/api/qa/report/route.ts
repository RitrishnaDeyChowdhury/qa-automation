import fs from "node:fs";
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
  if (!job?.report) {
    return NextResponse.json({ error: "Report is not ready." }, { status: 404 });
  }

  const stream = fs.createReadStream(job.report.pdfPath);
  return new NextResponse(stream as unknown as ReadableStream, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${job.id}-qa-report.pdf"`
    }
  });
}
