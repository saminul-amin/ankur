import type { ModelArtifactMetadata } from "../ai/model-artifact";
import type { EvidenceReference, EvidenceValidationFailure } from "../grounding/evidence";
import { validateEvidence } from "../grounding/evidence";
import type { PreparationMap } from "../preparation/preparation-map";
import type { ConfirmedSource } from "../source/confirmed-source";
import { normalizeSourceText } from "../source/confirmed-source";

export type AssessmentDifficulty = "easy" | "medium" | "hard";

export interface McqOption {
  readonly id: "A" | "B" | "C" | "D";
  readonly text: string;
}

interface QuestionBase {
  readonly id: string;
  readonly prompt: string;
  readonly conceptIds: readonly string[];
  readonly sourceVersionId: string;
  readonly difficulty: AssessmentDifficulty;
  readonly explanation: string;
  readonly evidence: readonly EvidenceReference[];
  readonly artifact: ModelArtifactMetadata;
}

export interface SingleMcqQuestion extends QuestionBase {
  readonly type: "single_mcq";
  readonly marks: 1;
  readonly options: readonly [McqOption, McqOption, McqOption, McqOption];
  readonly correctOptionId: McqOption["id"];
}

export interface RubricCriterion {
  readonly id: string;
  readonly description: string;
  readonly maximumMarks: number;
  readonly requiredConceptIds: readonly string[];
  readonly evidence: readonly EvidenceReference[];
}

export interface ShortWrittenQuestion extends QuestionBase {
  readonly type: "short_written";
  readonly marks: 5;
  readonly expectedLength: "one_sentence" | "short_paragraph";
  readonly referenceAnswer: string;
  readonly requiredConceptIds: readonly string[];
  readonly rubric: readonly RubricCriterion[];
}

export type Question = SingleMcqQuestion | ShortWrittenQuestion;

export interface ActivitySet {
  readonly schemaVersion: "activity-set.v2";
  readonly id: string;
  readonly sourceVersionId: string;
  readonly title: string;
  readonly questions: readonly [SingleMcqQuestion, ShortWrittenQuestion];
  readonly warnings: readonly string[];
  readonly artifact: ModelArtifactMetadata;
}

export interface McqGrade {
  readonly status: "correct" | "incorrect" | "unanswered";
  readonly correct: boolean;
  readonly earnedMarks: 0 | 1;
  readonly availableMarks: 1;
  readonly selectedOptionId?: McqOption["id"];
  readonly correctOptionId: McqOption["id"];
}

function failure(path: string): EvidenceValidationFailure {
  return { path, reason: "INVARIANT_VIOLATION" };
}

function normalizedPromptTokens(value: string): Set<string> {
  return new Set(
    normalizeSourceText(value)
      .toLocaleLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/u)
      .filter((token) => token.length > 1),
  );
}

export function promptsMateriallyEquivalent(left: string, right: string): boolean {
  const normalizedLeft = normalizeSourceText(left).toLocaleLowerCase();
  const normalizedRight = normalizeSourceText(right).toLocaleLowerCase();
  if (normalizedLeft === normalizedRight) return true;
  const leftTokens = normalizedPromptTokens(left);
  const rightTokens = normalizedPromptTokens(right);
  if (leftTokens.size === 0 || rightTokens.size === 0) return false;
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  return intersection / union >= 0.82;
}

export function validateActivitySet(
  source: ConfirmedSource,
  preparationMap: PreparationMap,
  activitySet: ActivitySet,
): EvidenceValidationFailure[] {
  const failures: EvidenceValidationFailure[] = [];
  if (activitySet.sourceVersionId !== source.sourceVersionId) {
    failures.push({ path: "sourceVersionId", reason: "SOURCE_VERSION_MISMATCH" });
  }
  if (activitySet.title.trim().length === 0 || activitySet.title.length > 160) failures.push(failure("title"));
  const questions: readonly Question[] = Array.from(activitySet.questions);
  if (questions.length !== 2) failures.push(failure("questions"));
  const mcq = questions[0];
  const written = questions[1];
  if (mcq === undefined || written === undefined || mcq.type !== "single_mcq" || written.type !== "short_written") {
    failures.push(failure("questions.composition"));
    return failures;
  }

  const conceptIds = new Set(preparationMap.concepts.map((concept) => concept.id));
  for (const [index, question] of activitySet.questions.entries()) {
    if (question.sourceVersionId !== source.sourceVersionId) {
      failures.push({ path: `questions[${String(index)}].sourceVersionId`, reason: "SOURCE_VERSION_MISMATCH" });
    }
    if (
      question.conceptIds.length === 0 ||
      new Set(question.conceptIds).size !== question.conceptIds.length ||
      question.conceptIds.some((id) => !conceptIds.has(id))
    ) {
      failures.push({ path: `questions[${String(index)}].conceptIds`, reason: "UNKNOWN_CONCEPT" });
    }
    failures.push(...validateEvidence(source, question.evidence, `questions[${String(index)}].evidence`));
  }

  const optionTexts = mcq.options.map((option) => normalizeSourceText(option.text).toLocaleLowerCase());
  const optionIds = new Set(mcq.options.map((option) => option.id));
  const mcqMarks: unknown = Reflect.get(mcq, "marks");
  if (
    mcqMarks !== 1 ||
    Array.from(mcq.options).length !== 4 ||
    optionTexts.some((option) => option.length === 0) ||
    new Set(optionTexts).size !== 4 ||
    optionIds.size !== 4 ||
    !optionIds.has(mcq.correctOptionId)
  ) {
    failures.push(failure("questions[0].options"));
  }

  const writtenMarks: unknown = Reflect.get(written, "marks");
  if (
    writtenMarks !== 5 ||
    written.referenceAnswer.trim().length === 0 ||
    !["one_sentence", "short_paragraph"].includes(written.expectedLength) ||
    written.requiredConceptIds.length === 0 ||
    new Set(written.requiredConceptIds).size !== written.requiredConceptIds.length ||
    written.requiredConceptIds.some((id) => !written.conceptIds.includes(id)) ||
    written.requiredConceptIds.some((id) => !conceptIds.has(id))
  ) {
    failures.push(failure("questions[1]"));
  }
  if (written.rubric.length < 2 || written.rubric.length > 4) {
    failures.push(failure("questions[1].rubric"));
  }
  const criterionIds = new Set(written.rubric.map((criterion) => criterion.id));
  const rubricMarks = written.rubric.reduce((sum, criterion) => sum + criterion.maximumMarks, 0);
  if (criterionIds.size !== written.rubric.length || rubricMarks !== 5) {
    failures.push(failure("questions[1].rubric"));
  }
  for (const [index, criterion] of written.rubric.entries()) {
    if (
      criterion.maximumMarks <= 0 ||
      !Number.isInteger(criterion.maximumMarks) ||
      criterion.description.trim().length === 0 ||
      criterion.requiredConceptIds.length === 0 ||
      new Set(criterion.requiredConceptIds).size !== criterion.requiredConceptIds.length ||
      criterion.requiredConceptIds.some((id) => !written.requiredConceptIds.includes(id)) ||
      criterion.requiredConceptIds.some((id) => !conceptIds.has(id))
    ) {
      failures.push({ path: `questions[1].rubric[${String(index)}]`, reason: "UNKNOWN_CONCEPT" });
    }
    failures.push(...validateEvidence(source, criterion.evidence, `questions[1].rubric[${String(index)}].evidence`));
  }
  if (promptsMateriallyEquivalent(mcq.prompt, written.prompt)) {
    failures.push({ path: "questions", reason: "DUPLICATE_PROMPT" });
  }
  return failures;
}

export function gradeMcq(
  question: SingleMcqQuestion,
  selectedOptionId?: string,
): McqGrade {
  if (selectedOptionId === undefined || selectedOptionId.trim() === "") {
    return {
      status: "unanswered",
      correct: false,
      earnedMarks: 0,
      availableMarks: 1,
      correctOptionId: question.correctOptionId,
    };
  }
  const option = question.options.find((candidate) => candidate.id === selectedOptionId);
  if (option === undefined) throw new Error("Selected option does not exist.");
  const correct = option.id === question.correctOptionId;
  return {
    status: correct ? "correct" : "incorrect",
    correct,
    earnedMarks: correct ? 1 : 0,
    availableMarks: 1,
    selectedOptionId: option.id,
    correctOptionId: question.correctOptionId,
  };
}
