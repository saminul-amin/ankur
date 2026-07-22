import { z } from "zod";

export interface WrittenEvaluationProviderOutput {
  readonly criterionJudgments: readonly ("met" | "partial" | "not_met")[];
  readonly criterionReasons: readonly string[];
  readonly incorrectClaims: readonly string[];
  readonly unsupportedClaims: readonly string[];
  readonly feedback: string;
}

function fieldName(index: number, suffix: "Judgment" | "Reason"): string {
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
  for (const [index] of input.criterionMaximumMarks.entries()) {
    const judgmentField = fieldName(index, "Judgment");
    const reasonField = fieldName(index, "Reason");
    shape[judgmentField] = z.enum(["met", "partial", "not_met"]);
    shape[reasonField] = z.string().min(1).max(400);
    properties[judgmentField] = { type: "string", enum: ["met", "partial", "not_met"] };
    properties[reasonField] = { type: "string", minLength: 1, maxLength: 400 };
    required.push(judgmentField, reasonField);
  }
  // The provider owns only semantic judgments and bounded reasons. Application
  // code derives every other result field from this fixed rubric transport.
  const rawSchema = z.object(shape).strict();
  const schema = rawSchema.transform((value): WrittenEvaluationProviderOutput => ({
    criterionJudgments: input.criterionMaximumMarks.map((_, index) => value[fieldName(index, "Judgment")] as "met" | "partial" | "not_met"),
    criterionReasons: input.criterionMaximumMarks.map((_, index) => String(value[fieldName(index, "Reason")])),
    incorrectClaims: [],
    unsupportedClaims: [],
    feedback: input.criterionMaximumMarks.map((_, index) => String(value[fieldName(index, "Reason")])).join(" "),
  }));

  return {
    schema,
    jsonSchema: { type: "object", additionalProperties: false, properties, required },
  };
}
