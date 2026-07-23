import { z } from "zod";

const nullableBoolean = z.boolean().nullable();

export const task06cQuestionPassASchema = z.object({
  neutralQuestionId: z.string().min(1),
  questionType: z.enum(["single_mcq", "short_written"]),
  prompt: z.string().min(1),
  options: z.array(z.string().min(1)).length(4).nullable(),
  clear: nullableBoolean,
  ambiguous: nullableBoolean,
  fairDifficulty: nullableBoolean,
  materiallyDuplicate: nullableBoolean,
  languageQuality: z.enum(["poor", "adequate", "good"]).nullable(),
  acceptQuestionText: nullableBoolean,
  reviewerNotes: z.string(),
  completedAt: z.iso.datetime().nullable(),
}).strict();

export const task06cQuestionPassBSchema = z.object({
  neutralQuestionId: z.string().min(1),
  sourceReference: z.string().min(1),
  permittedEvidenceCompositeIds: z.array(z.string().min(1)).min(1),
  groundedInPermittedSource: nullableBoolean,
  correctObjectiveKey: nullableBoolean,
  answerableFromSource: nullableBoolean,
  explanationUseful: nullableBoolean,
  acceptAnswerAndEvidence: nullableBoolean,
  reviewerNotes: z.string(),
  completedAt: z.iso.datetime().nullable(),
}).strict();

export const task06cWrittenReviewSchema = z.object({
  neutralWrittenId: z.string().min(1),
  neutralQuestionId: z.string().min(1),
  sourceReference: z.string().min(1),
  question: z.string().min(1),
  learnerAnswer: z.string(),
  modelAwardedMarks: z.number().min(0).max(5),
  modelStatus: z.enum(["correct", "partially_correct", "incorrect", "not_answered", "needs_review"]),
  humanMarkOutOf5: z.number().min(0).max(5).nullable(),
  humanStatus: z.enum(["correct", "partially_correct", "incorrect", "not_answered"]).nullable(),
  coveredConceptIds: z.array(z.string()),
  missingConceptIds: z.array(z.string()),
  incorrectClaims: z.array(z.string()),
  unsupportedClaims: z.array(z.string()),
  feedbackUsefulness: z.union([z.number().int().min(1).max(5), z.literal("not_applicable")]).nullable(),
  reviewerNotes: z.string(),
  completedAt: z.iso.datetime().nullable(),
}).strict();

export const task06cSourceVerificationSchema = z.object({
  neutralSourceId: z.string().min(1),
  materialId: z.string().min(1),
  pageNumber: z.number().int().positive(),
  sourceReference: z.string().min(1),
  renderedOrSourceReferenceChecked: nullableBoolean,
  expectedConfirmedTextChecked: nullableBoolean,
  materialOmissionPresent: nullableBoolean,
  materialErrorPresent: nullableBoolean,
  reviewerNotes: z.string(),
  completedAt: z.iso.datetime().nullable(),
}).strict();

export const task06cReviewerPacketSchema = z.object({
  schemaVersion: z.literal("task06c-reviewer-packet.v1"),
  reviewerId: z.enum(["R1", "R2"]),
  packetId: z.string().min(1),
  authorshipConflictDeclaration: z.string(),
  independentReviewAttestation: z.string(),
  questionPassA: z.array(task06cQuestionPassASchema),
  questionPassB: z.array(task06cQuestionPassBSchema),
  writtenReviews: z.array(task06cWrittenReviewSchema),
  sourceVerification: z.array(task06cSourceVerificationSchema),
}).strict();

export interface ReviewPacketValidationFailure {
  readonly code:
    | "REVIEW_MISSING_ROW"
    | "REVIEW_DUPLICATE_ID"
    | "REVIEW_ID_MISMATCH"
    | "REVIEW_INVALID_MARK"
    | "REVIEW_INCOMPLETE_FIELD"
    | "REVIEW_OTHER_REVIEWER_DATA";
  readonly path: string;
}

function duplicates(values: readonly string[]): boolean {
  return new Set(values).size !== values.length;
}

export function validateCompletedTask06cReviewPacket(input: {
  readonly packet: z.infer<typeof task06cReviewerPacketSchema>;
  readonly expectedQuestionCount: number;
  readonly expectedWrittenCount: number;
  readonly expectedSourcePageCount: number;
}): ReviewPacketValidationFailure[] {
  const failures: ReviewPacketValidationFailure[] = [];
  const packet = input.packet;
  if (
    packet.questionPassA.length !== input.expectedQuestionCount ||
    packet.questionPassB.length !== input.expectedQuestionCount ||
    packet.writtenReviews.length !== input.expectedWrittenCount ||
    packet.sourceVerification.length !== input.expectedSourcePageCount
  ) failures.push({ code: "REVIEW_MISSING_ROW", path: "$" });
  const passAIds = packet.questionPassA.map((row) => row.neutralQuestionId);
  const passBIds = packet.questionPassB.map((row) => row.neutralQuestionId);
  if (
    duplicates(passAIds) ||
    duplicates(passBIds) ||
    duplicates(packet.writtenReviews.map((row) => row.neutralWrittenId)) ||
    duplicates(packet.sourceVerification.map((row) => row.neutralSourceId))
  ) failures.push({ code: "REVIEW_DUPLICATE_ID", path: "$" });
  if (
    passAIds.length !== passBIds.length ||
    passAIds.some((id) => !passBIds.includes(id))
  ) failures.push({ code: "REVIEW_ID_MISMATCH", path: "questionPassB" });
  for (const [index, row] of packet.questionPassA.entries()) {
    if (
      row.clear === null ||
      row.ambiguous === null ||
      row.fairDifficulty === null ||
      row.materiallyDuplicate === null ||
      row.languageQuality === null ||
      row.acceptQuestionText === null ||
      row.completedAt === null
    ) failures.push({ code: "REVIEW_INCOMPLETE_FIELD", path: `questionPassA[${String(index)}]` });
  }
  for (const [index, row] of packet.questionPassB.entries()) {
    if (
      row.groundedInPermittedSource === null ||
      row.correctObjectiveKey === null ||
      row.answerableFromSource === null ||
      row.explanationUseful === null ||
      row.acceptAnswerAndEvidence === null ||
      row.completedAt === null
    ) failures.push({ code: "REVIEW_INCOMPLETE_FIELD", path: `questionPassB[${String(index)}]` });
  }
  for (const [index, row] of packet.writtenReviews.entries()) {
    if (
      row.humanMarkOutOf5 === null ||
      row.humanMarkOutOf5 < 0 ||
      row.humanMarkOutOf5 > 5
    ) failures.push({ code: "REVIEW_INVALID_MARK", path: `writtenReviews[${String(index)}].humanMarkOutOf5` });
    if (
      row.humanStatus === null ||
      row.feedbackUsefulness === null ||
      row.completedAt === null
    ) failures.push({ code: "REVIEW_INCOMPLETE_FIELD", path: `writtenReviews[${String(index)}]` });
  }
  for (const [index, row] of packet.sourceVerification.entries()) {
    if (
      row.renderedOrSourceReferenceChecked === null ||
      row.expectedConfirmedTextChecked === null ||
      row.materialOmissionPresent === null ||
      row.materialErrorPresent === null ||
      row.completedAt === null
    ) failures.push({ code: "REVIEW_INCOMPLETE_FIELD", path: `sourceVerification[${String(index)}]` });
  }
  if (
    packet.authorshipConflictDeclaration.trim().length === 0 ||
    packet.independentReviewAttestation.trim().length === 0
  ) failures.push({ code: "REVIEW_INCOMPLETE_FIELD", path: "attestation" });
  const serialized = JSON.stringify(packet);
  const otherReviewer = packet.reviewerId === "R1" ? "R2" : "R1";
  if (new RegExp(`"reviewerId"\\s*:\\s*"${otherReviewer}"`, "u").test(serialized)) {
    failures.push({ code: "REVIEW_OTHER_REVIEWER_DATA", path: "$" });
  }
  return failures;
}

export type Task06cReviewerPacket = z.infer<typeof task06cReviewerPacketSchema>;
