interface RateRecord {
  count: number;
  resetAt: number;
}

const WINDOW_MS = 60 * 60 * 1_000;
const SESSION_LIMIT = 8;
const IP_LIMIT = 12;
const records = new Map<string, RateRecord>();
const activeSessions = new Set<string>();

function consume(key: string, limit: number, now: number): boolean {
  const current = records.get(key);
  if (current === undefined || current.resetAt <= now) {
    records.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (current.count >= limit) {
    return false;
  }
  current.count += 1;
  return true;
}

export function acquireAiRequest(input: {
  readonly sessionId: string;
  readonly ip: string;
  readonly now?: number;
}): { readonly ok: true; readonly release: () => void } | { readonly ok: false; readonly reason: "RATE_LIMIT" | "ACTIVE_REQUEST" } {
  const now = input.now ?? Date.now();
  if (activeSessions.has(input.sessionId)) {
    return { ok: false, reason: "ACTIVE_REQUEST" };
  }
  if (!consume(`session:${input.sessionId}`, SESSION_LIMIT, now) || !consume(`ip:${input.ip}`, IP_LIMIT, now)) {
    return { ok: false, reason: "RATE_LIMIT" };
  }
  activeSessions.add(input.sessionId);
  return {
    ok: true,
    release: () => {
      activeSessions.delete(input.sessionId);
    },
  };
}

export function resetInMemoryRateLimitForTests(): void {
  records.clear();
  activeSessions.clear();
}
