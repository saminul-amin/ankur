import { NextResponse } from "next/server";

import { readReleaseMetadata } from "../../../src/shared/config/release-metadata";

export const runtime = "nodejs";

export function GET() {
  const requestId = crypto.randomUUID();
  const release = readReleaseMetadata();
  return NextResponse.json(
    {
      ok: true,
      requestId,
      data: {
        status: "healthy",
        version: release.version,
        buildId: release.buildId,
        timestamp: new Date().toISOString(),
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
