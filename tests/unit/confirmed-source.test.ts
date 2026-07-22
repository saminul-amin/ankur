import { describe, expect, it } from "vitest";

import {
  createConfirmedSource,
  rehydrateConfirmedSource,
  SourceDomainError,
} from "../../src/domain/source/confirmed-source.js";

describe("confirmed source", () => {
  it("creates stable immutable segment IDs and a content-derived source version", () => {
    const input = {
      pages: [{ pageNumber: 1, text: "First concept.\n\nSecond concept." }],
      language: "en" as const,
      method: "pasted_text" as const,
      confirmedAt: "2026-07-22T00:00:00.000Z",
    };
    const first = createConfirmedSource(input);
    const second = createConfirmedSource(input);

    expect(first.segments.map(({ id }) => id)).toEqual(["M01-P001-S001", "M01-P001-S002"]);
    expect(first.sourceVersionId).toBe(second.sourceVersionId);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.segments)).toBe(true);
    expect(Object.isFrozen(first.segments[0])).toBe(true);
  });

  it("rejects a rehydrated source when an immutable segment ID was changed", () => {
    const source = createConfirmedSource({
      pages: [{ pageNumber: 1, text: "A source paragraph long enough to remain useful." }],
      language: "en",
      method: "pasted_text",
    });

    const segment = source.segments[0];
    expect(segment).toBeDefined();
    if (segment === undefined) return;
    expect(() =>
      rehydrateConfirmedSource({
        sourceVersionId: source.sourceVersionId,
        language: source.language,
        segments: [{ id: "M01-P001-S099", pageNumber: 1, text: segment.text }],
      }),
    ).toThrow(SourceDomainError);
  });
});
