export interface BoundedRepairContext {
  readonly artifactType: "single_mcq" | "short_written_question" | "written_rubric" | "revision_item";
  readonly outputSchemaVersion: string;
  readonly invalidArtifact: Readonly<Record<string, unknown>>;
  readonly failureCodes: readonly string[];
  readonly mutableFields: readonly string[];
  readonly lockedOutputFields: Readonly<Record<string, unknown>>;
  readonly referenceContext: {
    readonly canonicalAnswer?: string;
    readonly requiredClaims?: readonly string[];
    readonly permittedEvidence?: readonly {
      readonly materialId: string;
      readonly sourceVersionId: string;
      readonly segmentId: string;
    }[];
    readonly language?: "bn" | "en" | "mixed";
  };
}

export function validateBoundedRepairContext(
  context: BoundedRepairContext,
  outputFields: readonly string[],
): readonly string[] {
  const allowed = new Set(outputFields);
  const failures: string[] = [];
  for (const key of Object.keys(context.lockedOutputFields)) {
    if (!allowed.has(key)) failures.push(`REPAIR_LOCKED_FIELD_OUTSIDE_SCHEMA:${key}`);
  }
  for (const key of ["canonicalAnswer", "requiredClaims", "permittedEvidence", "language"]) {
    if (Object.hasOwn(context.lockedOutputFields, key)) {
      failures.push(`REPAIR_REFERENCE_CONTEXT_AS_OUTPUT:${key}`);
    }
  }
  return failures;
}
