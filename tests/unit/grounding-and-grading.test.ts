import { describe, expect, it } from "vitest";

import { createSampleActivitySet, createSamplePreparationMap, createSampleSource } from "../../src/application/sample/sample-vertical-slice.js";
import { gradeMcq, validateActivitySet } from "../../src/domain/assessments/mcq.js";
import { validateEvidence } from "../../src/domain/grounding/evidence.js";
import { validatePreparationMap } from "../../src/domain/preparation/preparation-map.js";

describe("grounding and deterministic MCQ grading", () => {
  const source = createSampleSource();
  const map = createSamplePreparationMap(source);
  const activity = createSampleActivitySet(source, map);

  it("accepts the fixed sample only when all segment IDs and quotes resolve", () => {
    expect(validatePreparationMap(source, map)).toEqual([]);
    expect(validateActivitySet(source, map, activity)).toEqual([]);
  });

  it("rejects unknown segments and quotes that do not occur in the segment", () => {
    const segment = source.segments[0];
    expect(segment).toBeDefined();
    if (segment === undefined) return;
    expect(validateEvidence(source, [{ segmentId: "M01-P001-S999", quote: "missing" }], "evidence"))
      .toEqual([{ path: "evidence[0]", reason: "UNKNOWN_SEGMENT" }]);
    expect(validateEvidence(source, [{ segmentId: segment.id, quote: "not in source" }], "evidence"))
      .toEqual([{ path: "evidence[0]", reason: "QUOTE_NOT_FOUND" }]);
  });

  it("grades the selected option without a provider call", () => {
    const question = activity.questions[0];
    expect(gradeMcq(question, "B")).toMatchObject({ correct: true, earnedMarks: 1 });
    expect(gradeMcq(question, "A")).toMatchObject({ correct: false, earnedMarks: 0 });
    expect(() => gradeMcq(question, "missing")).toThrow("Selected option does not exist");
  });
});
