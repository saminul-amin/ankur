import { NextResponse } from "next/server";

export const runtime = "nodejs";

export function GET() {
  const requestId = crypto.randomUUID();
  return NextResponse.json(
    {
      ok: true,
      requestId,
      data: {
        status: "healthy",
        version: "0.1.0",
        timestamp: new Date().toISOString(),
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
