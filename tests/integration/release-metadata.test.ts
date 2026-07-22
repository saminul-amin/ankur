import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("server-only", () => ({}));

import { GET as getHealth } from "../../app/api/health/route";
import { GET as getRuntimeStatus } from "../../app/api/runtime-status/route";
import { readReleaseMetadata } from "../../src/shared/config/release-metadata";

describe("safe release metadata", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("prefers an explicit safe build ID and truncates it", () => {
    vi.stubEnv("ANKUR_BUILD_ID", "abcdef1234567890");
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "9999999999999999");
    expect(readReleaseMetadata()).toEqual({ version: "0.1.0", buildId: "abcdef123456" });
  });

  it("rejects unsafe environment content without exposing it", () => {
    vi.stubEnv("ANKUR_BUILD_ID", "unsafe value with spaces and a secret");
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "3c2e226055de7a0be841852bfadae512d631ae10");
    expect(readReleaseMetadata().buildId).toBe("3c2e226055de");
  });

  it("exposes the same safe build identifier from health and runtime status", async () => {
    vi.stubEnv("ANKUR_BUILD_ID", "release-04b");
    vi.stubEnv("ANKUR_LIVE_AI_ENABLED", "false");
    vi.stubEnv("ANKUR_SAMPLE_MODE_ENABLED", "true");
    const responseSchema = z.object({ data: z.object({
      status: z.string().optional(), version: z.string().optional(), buildId: z.string(),
      liveAiEnabled: z.boolean().optional(), sampleModeEnabled: z.boolean().optional(),
    }).loose() }).loose();
    const health = responseSchema.parse(await getHealth().json());
    const runtime = responseSchema.parse(await getRuntimeStatus().json());
    expect(health.data).toMatchObject({ status: "healthy", version: "0.1.0", buildId: "release-04b" });
    expect(runtime.data).toMatchObject({ liveAiEnabled: false, sampleModeEnabled: true, buildId: "release-04b" });
  });
});
