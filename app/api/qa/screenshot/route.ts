import fs from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { appConfig } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const requestedPath = request.nextUrl.searchParams.get("path");
  if (!requestedPath) {
    return NextResponse.json({ error: "path is required." }, { status: 400 });
  }

  const resolved = path.resolve(requestedPath);
  const root = path.resolve(appConfig.storage.screenshotsDir);
  if (!resolved.startsWith(root) || !resolved.endsWith(".png")) {
    return NextResponse.json({ error: "Invalid screenshot path." }, { status: 400 });
  }

  if (!fs.existsSync(resolved)) {
    return NextResponse.json({ error: "Screenshot not found." }, { status: 404 });
  }

  const stream = fs.createReadStream(resolved);
  return new NextResponse(stream as unknown as ReadableStream, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, max-age=300"
    }
  });
}
