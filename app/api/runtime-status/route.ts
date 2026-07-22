import { NextResponse } from "next/server";

import { readRuntimeConfig } from "../../../src/shared/config/runtime-config";

export const runtime = "nodejs";

export function GET() {
  const requestId = crypto.randomUUID();
  const config = readRuntimeConfig();
  const providerConfigured = config.apiKey !== undefined;
  const liveAiEnabled = config.liveAiEnabled && providerConfigured;
  return NextResponse.json(
    {
      ok: true,
      requestId,
      data: {
        liveAiEnabled,
        sampleModeEnabled: config.sampleModeEnabled,
        providerConfigured,
        primaryModel: config.primaryModel,
        status: liveAiEnabled ? "ready" : config.sampleModeEnabled ? "degraded" : "disabled",
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
