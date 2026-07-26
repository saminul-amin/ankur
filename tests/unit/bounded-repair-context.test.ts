import { describe, expect, it } from "vitest";

import {
  validateBoundedRepairContext,
  type BoundedRepairContext,
} from "../../src/application/services/bounded-repair-context.js";

function context(overrides: Partial<BoundedRepairContext> = {}): BoundedRepairContext {
  return {
    artifactType: "single_mcq",
    outputSchemaVersion: "single-mcq-question.v2",
    invalidArtifact: { prompt: "Broken?" },
    failureCodes: ["MCQ_AMBIGUOUS_STEM"],
    mutableFields: ["prompt"],
    lockedOutputFields: {},
    referenceContext: {
      canonicalAnswer: "Locked semantic answer",
      permittedEvidence: [{
        materialId: "M01",
        sourceVersionId: "source-version-1",
        segmentId: "M01-P001-S001",
      }],
      language: "en",
    },
    ...overrides,
  };
}

describe("bounded repair context", () => {
  it("rejects canonical answers incorrectly supplied as output-locked fields", () => {
    expect(validateBoundedRepairContext(context({
      lockedOutputFields: { canonicalAnswer: "must not be emitted" },
    }), ["prompt", "explanation"])).toEqual([
      "REPAIR_LOCKED_FIELD_OUTSIDE_SCHEMA:canonicalAnswer",
      "REPAIR_REFERENCE_CONTEXT_AS_OUTPUT:canonicalAnswer",
    ]);
  });

  it("rejects application-owned IDs and reference evidence outside a strict output schema", () => {
    expect(validateBoundedRepairContext(context({
      lockedOutputFields: {
        questionId: "question-001",
        permittedEvidence: [],
      },
    }), ["prompt", "explanation"])).toEqual([
      "REPAIR_LOCKED_FIELD_OUTSIDE_SCHEMA:questionId",
      "REPAIR_LOCKED_FIELD_OUTSIDE_SCHEMA:permittedEvidence",
      "REPAIR_REFERENCE_CONTEXT_AS_OUTPUT:permittedEvidence",
    ]);
  });

  it("accepts schema-present locked output fields while keeping references contextual", () => {
    expect(validateBoundedRepairContext(context({
      lockedOutputFields: { expectedLength: "short_paragraph" },
    }), ["prompt", "explanation", "expectedLength"])).toEqual([]);
  });
});
