import { z } from "zod";

const conceptIdSchema = z.string().regex(/^concept-[a-z0-9-]+$/);
const segmentIdSchema = z.string().regex(/^M\d{2}-P\d{3}-S\d{3}$/);

export const writtenEvaluationProviderSchema = z.object({
  awardedMarks: z.number().min(0).max(5),
  status: z.enum(["correct", "partially_correct", "incorrect", "needs_review"]),
  criterionAwardedMarks: z.array(z.number().min(0).max(4)).min(2).max(4),
  criterionStates: z.array(z.enum(["met", "partial", "not_met"])).min(2).max(4),
  criterionReasons: z.array(z.string().min(1).max(400)).min(2).max(4),
  coveredConceptIds: z.array(conceptIdSchema).max(8),
  missingConceptIds: z.array(conceptIdSchema).max(8),
  incorrectClaims: z.array(z.string().min(1).max(500)).max(8),
  unsupportedClaims: z.array(z.string().min(1).max(500)).max(8),
  feedback: z.string().min(1).max(800),
  evidenceSegmentIds: z.array(segmentIdSchema).min(1).max(6),
  recommendedRevisionConceptIds: z.array(conceptIdSchema).max(8),
}).strict();

const stringArray = { type: "array", maxItems: 8, items: { type: "string" } } as const;
const criterionArray = { type: "array", minItems: 2, maxItems: 4, items: { type: "number", minimum: 0, maximum: 4 } } as const;

export const writtenEvaluationProviderJsonSchema = {
  type: "object", additionalProperties: false,
  properties: {
    awardedMarks: { type: "number", minimum: 0, maximum: 5 },
    status: { type: "string", enum: ["correct", "partially_correct", "incorrect", "needs_review"] },
    criterionAwardedMarks: criterionArray,
    criterionStates: { type: "array", minItems: 2, maxItems: 4, items: { type: "string", enum: ["met", "partial", "not_met"] } },
    criterionReasons: { type: "array", minItems: 2, maxItems: 4, items: { type: "string" } },
    coveredConceptIds: stringArray,
    missingConceptIds: stringArray,
    incorrectClaims: stringArray,
    unsupportedClaims: stringArray,
    feedback: { type: "string" },
    evidenceSegmentIds: { type: "array", minItems: 1, maxItems: 6, items: { type: "string" } },
    recommendedRevisionConceptIds: stringArray,
  },
  required: ["awardedMarks", "status", "criterionAwardedMarks", "criterionStates", "criterionReasons", "coveredConceptIds", "missingConceptIds", "incorrectClaims", "unsupportedClaims", "feedback", "evidenceSegmentIds", "recommendedRevisionConceptIds"],
} as const;

export type WrittenEvaluationProviderOutput = z.infer<typeof writtenEvaluationProviderSchema>;
