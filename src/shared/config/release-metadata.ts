import "server-only";

export const APPLICATION_VERSION = "0.1.0";

const SAFE_BUILD_ID = /^[a-zA-Z0-9._-]{1,128}$/;

function safeBuildId(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (trimmed === undefined || !SAFE_BUILD_ID.test(trimmed)) return undefined;
  return trimmed.slice(0, 12);
}

export function readReleaseMetadata(): {
  readonly version: string;
  readonly buildId: string;
} {
  return {
    version: APPLICATION_VERSION,
    buildId: safeBuildId(process.env["ANKUR_BUILD_ID"])
      ?? safeBuildId(process.env["VERCEL_GIT_COMMIT_SHA"])
      ?? safeBuildId(process.env["VERCEL_DEPLOYMENT_ID"])
      ?? "local",
  };
}
