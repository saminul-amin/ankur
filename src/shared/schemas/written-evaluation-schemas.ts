import { z } from "zod";

export interface WrittenEvaluationProviderOutput {
  readonly criterionAwardedMarks: readonly number[];
  readonly criterionReasons: readonly string[];
  readonly incorrectClaims: readonly string[];
  readonly unsupportedClaims: readonly string[];
  readonly feedback: string;
}

function fieldName(index: number, suffix: "AwardedMarks" | "Reason"): string {
  return `criterion${String(index + 1)}${suffix}`;
}

export function createWrittenEvaluationProviderContract(input: {
  readonly criterionMaximumMarks: readonly number[];
}): {
  readonly schema: z.ZodType<WrittenEvaluationProviderOutput>;
  readonly jsonSchema: Readonly<Record<string, unknown>>;
} {
  if (input.criterionMaximumMarks.length < 2 || input.criterionMaximumMarks.length > 4) {
    throw new Error("Written-evaluation transport requires two to four criteria.");
  }
  const shape: Record<string, z.ZodType> = {};
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const [index, maximumMarks] of input.criterionMaximumMarks.entries()) {
    const marksField = fieldName(index, "AwardedMarks");
    const reasonField = fieldName(index, "Reason");
    shape[marksField] = z.number().min(0).max(maximumMarks);
    shape[reasonField] = z.string().min(1).max(400);
    properties[marksField] = { type: "number", minimum: 0, maximum: maximumMarks };
    properties[reasonField] = { type: "string" };
    required.push(marksField, reasonField);
  }
  shape["incorrectClaims"] = z.array(z.string().min(1).max(500)).max(8).default([]);
  shape["unsupportedClaims"] = z.array(z.string().min(1).max(500)).max(8).default([]);
  shape["feedback"] = z.string().min(1).max(800);
  properties["incorrectClaims"] = { type: "array", maxItems: 8, items: { type: "string" } };
  properties["unsupportedClaims"] = { type: "array", maxItems: 8, items: { type: "string" } };
  properties["feedback"] = { type: "string" };
  required.push("feedback");

  // Derived totals or status fields are never consumed; strip them while keeping
  // all authoritative criterion values validated against their fixed bounds.
  const rawSchema = z.object(shape);
  const schema = rawSchema.transform((value): WrittenEvaluationProviderOutput => ({
    criterionAwardedMarks: input.criterionMaximumMarks.map((_, index) => Number(value[fieldName(index, "AwardedMarks")])),
    criterionReasons: input.criterionMaximumMarks.map((_, index) => String(value[fieldName(index, "Reason")])),
    incorrectClaims: value["incorrectClaims"] as string[],
    unsupportedClaims: value["unsupportedClaims"] as string[],
    feedback: String(value["feedback"]),
  }));

  return {
    schema,
    jsonSchema: { type: "object", additionalProperties: false, properties, required },
  };
}
