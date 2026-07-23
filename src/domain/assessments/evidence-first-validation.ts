import type { ConfirmedSource, SourceLanguage } from "../source/confirmed-source";
import { normalizeSourceText } from "../source/confirmed-source";
import type {
  ArtifactFailureCode,
  CanonicalAnswerV2,
  RevisionQuestionV2,
  ScopedEvidenceReference,
  ShortWrittenQuestionV2,
  SingleMcqQuestionV2,
  WrittenRubricV2,
} from "../../shared/schemas/evidence-first-question-schemas";
import {
  canonicalAnswerV2Schema,
  revisionQuestionV2Schema,
  shortWrittenQuestionV2Schema,
  singleMcqQuestionV2Schema,
  writtenRubricV2Schema,
} from "../../shared/schemas/evidence-first-question-schemas";

export interface ArtifactValidationFailure {
  readonly code: ArtifactFailureCode;
  readonly path: string;
  readonly expected?: string;
}

export type DuplicateComparisonScope =
  | "within_pipeline"
  | "cross_pipeline"
  | "same_material"
  | "same_operation"
  | "revision_source"
  | "retry_source";

export interface DuplicateCandidate {
  readonly recordId: string;
  readonly prompt: string;
  readonly materialId: string;
  readonly pipeline: "ankur_structured" | "one_prompt_baseline";
  readonly operationId: string;
  readonly kind: "assessment" | "revision" | "retry";
}

export interface DuplicateDecision {
  readonly duplicateDecision: "accepted" | "rejected";
  readonly comparedRecordId: string | null;
  readonly comparisonScope: DuplicateComparisonScope | null;
  readonly similarityScore: number;
  readonly lexicalFingerprint: string;
  readonly semanticFingerprint: string;
  readonly failureCode: "QUESTION_DUPLICATE" | null;
}

export interface ReliabilityOperation {
  readonly logicalOperationId: string;
  readonly artifactType: string;
  readonly providerAttempts: readonly {
    readonly available: boolean;
    readonly schemaValid: boolean;
    readonly latencyMs: number;
    readonly stage: "first_pass" | "repair";
  }[];
  readonly firstPassSemanticValid: boolean;
  readonly repairAttempted: boolean;
  readonly repairSuccess: boolean;
  readonly finalValid: boolean;
  readonly alignmentValid: boolean;
  readonly controlledFailure: boolean;
  readonly logicalLatencyMs: number;
  readonly failureCodes: readonly ArtifactFailureCode[];
}

export interface ReliabilitySummary {
  readonly denominators: {
    readonly providerAttempts: number;
    readonly logicalOperations: number;
  };
  readonly providerAvailability: { readonly numerator: number; readonly denominator: number };
  readonly firstPassSchemaValidity: { readonly numerator: number; readonly denominator: number };
  readonly firstPassSemanticValidity: { readonly numerator: number; readonly denominator: number };
  readonly repairAttempted: { readonly numerator: number; readonly denominator: number };
  readonly repairSuccess: { readonly numerator: number; readonly denominator: number };
  readonly finalLogicalArtifactValidity: { readonly numerator: number; readonly denominator: number };
  readonly questionRubricAlignmentValidity: { readonly numerator: number; readonly denominator: number };
  readonly controlledFailures: number;
  readonly providerLatencyMs: number;
  readonly logicalOperationLatencyMs: number;
  readonly failureCodesByArtifactType: Readonly<Record<string, Readonly<Record<string, number>>>>;
}

function uniqueFailures(failures: readonly ArtifactValidationFailure[]): ArtifactValidationFailure[] {
  const seen = new Set<string>();
  return failures.filter((failure) => {
    const key = `${failure.code}:${failure.path}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizedComparable(value: string): string {
  return normalizeSourceText(value)
    .toLocaleLowerCase()
    .replace(/^[\s]*[a-d][.)।:]\s*/iu, "")
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function tokens(value: string): Set<string> {
  return new Set(normalizedComparable(value).split(/\s+/u).filter((token) => token.length > 1));
}

function characterNgrams(value: string): Set<string> {
  const compact = normalizedComparable(value).replace(/\s+/gu, "");
  const characters = Array.from(
    new Intl.Segmenter("und", { granularity: "grapheme" }).segment(compact),
    (item) => item.segment,
  );
  if (characters.length < 3) return new Set(compact.length === 0 ? [] : [compact]);
  return new Set(characters.slice(0, -2).map((_, index) =>
    characters.slice(index, index + 3).join(""),
  ));
}

function similarity(left: string, right: string): number {
  const leftNormalized = normalizedComparable(left);
  const rightNormalized = normalizedComparable(right);
  if (leftNormalized === rightNormalized && leftNormalized.length > 0) return 1;
  const leftTokens = tokens(left);
  const rightTokens = tokens(right);
  const tokenScore = leftTokens.size === 0 || rightTokens.size === 0
    ? 0
    : [...leftTokens].filter((token) => rightTokens.has(token)).length /
      new Set([...leftTokens, ...rightTokens]).size;
  const leftNgrams = characterNgrams(left);
  const rightNgrams = characterNgrams(right);
  const ngramScore = leftNgrams.size === 0 || rightNgrams.size === 0
    ? 0
    : [...leftNgrams].filter((ngram) => rightNgrams.has(ngram)).length /
      new Set([...leftNgrams, ...rightNgrams]).size;
  return Math.max(tokenScore, ngramScore);
}

function scopeFor(candidate: DuplicateCandidate, prior: DuplicateCandidate): DuplicateComparisonScope | null {
  if (candidate.operationId === prior.operationId) return "same_operation";
  if (candidate.kind === "retry" && prior.kind === "assessment") return "retry_source";
  if (candidate.kind === "revision" && prior.kind === "assessment") return "revision_source";
  if (candidate.materialId !== prior.materialId) return null;
  if (candidate.pipeline !== prior.pipeline) return "cross_pipeline";
  return "within_pipeline";
}

export function detectQuestionDuplicate(
  candidate: DuplicateCandidate,
  acceptedBank: readonly DuplicateCandidate[],
): DuplicateDecision {
  const lexicalFingerprint = normalizedComparable(candidate.prompt);
  const semanticFingerprint = [...tokens(candidate.prompt)].toSorted().join("|");
  let best: { readonly record: DuplicateCandidate; readonly score: number; readonly scope: DuplicateComparisonScope } | undefined;
  for (const prior of acceptedBank) {
    const scope = scopeFor(candidate, prior);
    if (scope === null) continue;
    const score = similarity(candidate.prompt, prior.prompt);
    if (best === undefined || score > best.score) best = { record: prior, score, scope };
  }
  const rejected = best !== undefined && (
    best.score >= 0.82 ||
    lexicalFingerprint === normalizedComparable(best.record.prompt)
  );
  return {
    duplicateDecision: rejected ? "rejected" : "accepted",
    comparedRecordId: best?.record.recordId ?? null,
    comparisonScope: best?.scope ?? null,
    similarityScore: Number((best?.score ?? 0).toFixed(4)),
    lexicalFingerprint,
    semanticFingerprint,
    failureCode: rejected ? "QUESTION_DUPLICATE" : null,
  };
}

function sourceReferenceFailures(
  source: ConfirmedSource,
  materialId: string,
  sourceVersionId: string,
  references: readonly ScopedEvidenceReference[],
  path: string,
): ArtifactValidationFailure[] {
  const segmentByCompositeId = new Map(
    source.segments.map((segment) => [
      `${segment.materialId}/${source.sourceVersionId}/${segment.id}`,
      segment,
    ]),
  );
  const failures: ArtifactValidationFailure[] = [];
  for (const [index, reference] of references.entries()) {
    const referencePath = `${path}[${String(index)}]`;
    if (reference.materialId !== materialId) {
      failures.push({ code: "EVIDENCE_CROSS_MATERIAL", path: `${referencePath}.materialId` });
    }
    if (reference.sourceVersionId !== sourceVersionId || sourceVersionId !== source.sourceVersionId) {
      failures.push({ code: "EVIDENCE_CROSS_SOURCE_VERSION", path: `${referencePath}.sourceVersionId` });
    }
    const segment = segmentByCompositeId.get(
      `${reference.materialId}/${reference.sourceVersionId}/${reference.segmentId}`,
    );
    if (segment === undefined) {
      failures.push({ code: "EVIDENCE_REFERENCE_INVALID", path: referencePath });
      continue;
    }
    if (
      reference.quote !== undefined &&
      !segment.normalizedText.includes(normalizeSourceText(reference.quote))
    ) {
      failures.push({ code: "EVIDENCE_REFERENCE_INVALID", path: `${referencePath}.quote` });
    }
  }
  return failures;
}

function sentenceCandidates(value: string): string[] {
  const normalized = normalizeSourceText(value);
  const sentences = normalized
    .split(/(?<=[.!?।])\s+|\n+/u)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 12);
  return sentences.length > 0 ? sentences : [normalized];
}

export function buildCanonicalAnswer(input: {
  readonly source: ConfirmedSource;
  readonly evidenceSegmentIds: readonly string[];
  readonly conceptIds: readonly string[];
  readonly language?: SourceLanguage;
  readonly idSuffix?: string;
  readonly maximumAnswerCharacters?: number;
  readonly maximumClaims?: number;
}): CanonicalAnswerV2 {
  if (
    input.evidenceSegmentIds.length === 0 ||
    input.conceptIds.length === 0 ||
    new Set(input.evidenceSegmentIds).size !== input.evidenceSegmentIds.length
  ) {
    throw new Error("Canonical answer requires unique evidence segments and concepts.");
  }
  const segments = input.evidenceSegmentIds.map((segmentId) =>
    input.source.segments.find((segment) => segment.id === segmentId),
  );
  if (segments.some((segment) => segment === undefined)) {
    throw new Error("Canonical answer evidence is outside the confirmed source.");
  }
  const resolvedSegments = segments.flatMap((segment) => segment === undefined ? [] : [segment]);
  const materialIds = new Set(resolvedSegments.map((segment) => segment.materialId));
  if (materialIds.size !== 1) throw new Error("Canonical answer evidence crosses materials.");
  const evidenceReferences = resolvedSegments.map((segment): ScopedEvidenceReference => ({
    materialId: segment.materialId,
    sourceVersionId: input.source.sourceVersionId,
    segmentId: segment.id,
  }));
  const maximumAnswerCharacters = Math.max(80, Math.min(input.maximumAnswerCharacters ?? 2_400, 2_400));
  const maximumClaims = Math.max(1, Math.min(input.maximumClaims ?? 3, 6));
  const perClaimCharacters = Math.max(80, Math.floor(maximumAnswerCharacters / maximumClaims));
  const boundedClaim = (text: string): string => {
    if (text.length <= perClaimCharacters) return text;
    const clipped = text.slice(0, perClaimCharacters);
    const lastBoundary = Math.max(clipped.lastIndexOf(" "), clipped.lastIndexOf(","), clipped.lastIndexOf("।"));
    return clipped.slice(0, lastBoundary >= 40 ? lastBoundary : maximumAnswerCharacters).trim();
  };
  const claimTexts = resolvedSegments
    .flatMap((segment) => sentenceCandidates(segment.text))
    .filter((sentence, index, values) =>
      values.findIndex((candidate) => normalizedComparable(candidate) === normalizedComparable(sentence)) === index,
    )
    .map(boundedClaim)
    .slice(0, Math.max(1, Math.min(maximumClaims, input.conceptIds.length + 1)));
  const requiredClaims = claimTexts.map((text, index) => ({
    id: `claim-${String(index + 1).padStart(3, "0")}`,
    text,
    conceptIds: [input.conceptIds[index % input.conceptIds.length] ?? input.conceptIds[0] ?? "concept-missing"],
    evidenceReferences: evidenceReferences.filter((reference) => {
      const segment = resolvedSegments.find((candidate) => candidate.id === reference.segmentId);
      return segment?.normalizedText.includes(normalizeSourceText(text)) === true;
    }).slice(0, 1),
  }));
  const materialId = resolvedSegments[0]?.materialId ?? "material-01";
  const suffix = input.idSuffix ?? input.source.sourceVersionId.replace(/[^a-z0-9-]/giu, "-").toLocaleLowerCase();
  const pending: CanonicalAnswerV2 = {
    schemaVersion: "canonical-answer.v2",
    id: `canonical-answer-${suffix}`,
    materialId,
    sourceVersionId: input.source.sourceVersionId,
    conceptIds: [...new Set(input.conceptIds)],
    canonicalAnswer: requiredClaims.map((claim) => claim.text).join(" ").slice(0, 2_400),
    evidenceReferences,
    requiredClaims,
    language: input.language ?? input.source.language,
    validationStatus: "pending",
    failureCodes: [],
  };
  const failures = validateCanonicalAnswer(input.source, pending);
  return {
    ...pending,
    validationStatus: failures.length === 0 ? "valid" : "invalid",
    failureCodes: failures.map((failure) => failure.code),
  };
}

export function validateCanonicalAnswer(
  source: ConfirmedSource,
  answer: CanonicalAnswerV2,
): ArtifactValidationFailure[] {
  const parsed = canonicalAnswerV2Schema.safeParse(answer);
  if (!parsed.success) {
    return parsed.error.issues.map((issue) => ({
      code: "CANONICAL_ANSWER_INCOMPLETE" as const,
      path: issue.path.join("."),
      expected: issue.message,
    }));
  }
  const failures = sourceReferenceFailures(
    source,
    answer.materialId,
    answer.sourceVersionId,
    answer.evidenceReferences,
    "evidenceReferences",
  );
  if (answer.canonicalAnswer.trim().length === 0) {
    failures.push({ code: "CANONICAL_ANSWER_EMPTY", path: "canonicalAnswer" });
  }
  const segmentById = new Map(source.segments.map((segment) => [segment.id, segment]));
  const answerNormalized = normalizeSourceText(answer.canonicalAnswer);
  for (const [index, claim] of answer.requiredClaims.entries()) {
    failures.push(...sourceReferenceFailures(
      source,
      answer.materialId,
      answer.sourceVersionId,
      claim.evidenceReferences,
      `requiredClaims[${String(index)}].evidenceReferences`,
    ));
    const entailed = claim.evidenceReferences.some((reference) =>
      segmentById.get(reference.segmentId)?.normalizedText.includes(normalizeSourceText(claim.text)) === true,
    );
    if (!entailed) {
      failures.push({ code: "CANONICAL_ANSWER_NOT_ENTAILED", path: `requiredClaims[${String(index)}].text` });
      failures.push({ code: "CANONICAL_ANSWER_UNSUPPORTED_CLAIM", path: `requiredClaims[${String(index)}].text` });
    }
    if (!answerNormalized.includes(normalizeSourceText(claim.text))) {
      failures.push({ code: "CANONICAL_ANSWER_INCOMPLETE", path: `requiredClaims[${String(index)}]` });
    }
  }
  const claimsJoined = normalizeSourceText(answer.requiredClaims.map((claim) => claim.text).join(" "));
  if (normalizedComparable(claimsJoined) !== normalizedComparable(answer.canonicalAnswer)) {
    failures.push({ code: "CANONICAL_ANSWER_UNSUPPORTED_CLAIM", path: "canonicalAnswer" });
  }
  return uniqueFailures(failures);
}

function duplicatedClauses(value: string): boolean {
  const clauses = value
    .split(/[.!?।;:,]+/u)
    .map(normalizedComparable)
    .filter((clause) => clause.length >= 8);
  return new Set(clauses).size !== clauses.length;
}

export function validateLanguageQuality(
  value: string,
  input: {
    readonly path?: string;
    readonly kind?: "question" | "option" | "rubric" | "answer";
    readonly sourceLanguage?: SourceLanguage;
  } = {},
): ArtifactValidationFailure[] {
  const path = input.path ?? "text";
  const normalized = normalizeSourceText(value);
  const failures: ArtifactValidationFailure[] = [];
  if (normalized.length === 0) {
    return [{ code: "LANG_INCOMPLETE_SENTENCE", path }];
  }
  if (/(?:\boption\s*[a-d]\b|\boption[a-d]\b|^[\s]*[a-d][.)।:]\s+)/iu.test(normalized)) {
    failures.push({ code: "LANG_PLACEHOLDER_TEXT", path });
  }
  const tokenList = normalizedComparable(normalized).split(/\s+/u);
  if (tokenList.some((token, index) => token.length > 1 && token === tokenList[index - 1])) {
    failures.push({ code: "LANG_REPEATED_TOKEN", path });
  }
  if (duplicatedClauses(normalized)) failures.push({ code: "LANG_DUPLICATED_CLAUSE", path });
  if (/([!?।.,])\1+/u.test(normalized) || /[,.]\s*[?।]/u.test(normalized)) {
    failures.push({ code: "LANG_INCOMPLETE_SENTENCE", path });
  }
  if (/\b(?:is|are|was|were|do|does|did|the|a|an)\s*[?!.]?$/iu.test(normalized)) {
    failures.push({ code: "LANG_MALFORMED_VERB", path });
  }
  if (
    /\p{Script=Bengali}[a-z]+(?=\p{Script=Bengali})/iu.test(normalized) ||
    /[a-z]\p{Script=Bengali}[a-z]/iu.test(normalized)
  ) failures.push({ code: "LANG_MIXED_LANGUAGE_CORRUPTION", path });
  if (/(.)\1{4,}/u.test(normalized) || /\b[\p{L}]*([bcdfghjklmnpqrstvwxyz])\1{3,}[\p{L}]*\b/iu.test(normalized)) {
    failures.push({ code: "LANG_NONSENSICAL_TOKEN", path });
  }
  if (input.kind === "question") {
    if (!/[?？।.]\s*$/u.test(normalized) || normalized.length < 8) {
      failures.push({ code: "LANG_TRUNCATED_SENTENCE", path });
    }
    const stableInterrogative = /(?:\b(?:what|why|how|which|who|when|where|explain|describe|compare|identify|state)\b|(?:কী|কি|কেন|কিভাবে|কীভাবে|কোন|কে|কখন|কোথায়|ব্যাখ্যা|বর্ণনা|তুলনা|চিহ্নিত))/iu;
    if (!stableInterrogative.test(normalized)) {
      failures.push({ code: "LANG_UNSTABLE_INTERPRETATION", path });
    }
  } else if (/[,:;—-]\s*$/u.test(normalized)) {
    failures.push({ code: "LANG_TRUNCATED_SENTENCE", path });
  }
  if (
    input.sourceLanguage === "bn" &&
    /^[\p{ASCII}\s]+$/u.test(normalized) &&
    normalized.length > 12
  ) failures.push({ code: "LANG_MIXED_LANGUAGE_CORRUPTION", path });
  if (
    input.sourceLanguage === "en" &&
    /\p{Script=Bengali}/u.test(normalized)
  ) failures.push({ code: "LANG_MIXED_LANGUAGE_CORRUPTION", path });
  return uniqueFailures(failures);
}

function optionSupported(option: string, canonical: CanonicalAnswerV2): boolean {
  if (similarity(option, canonical.canonicalAnswer) >= 0.72) return true;
  return canonical.requiredClaims.some((claim) => similarity(option, claim.text) >= 0.78);
}

export function validateSingleMcqQuestion(
  source: ConfirmedSource,
  canonical: CanonicalAnswerV2,
  question: SingleMcqQuestionV2,
): ArtifactValidationFailure[] {
  const parsed = singleMcqQuestionV2Schema.safeParse(question);
  const failures: ArtifactValidationFailure[] = parsed.success ? [] : parsed.error.issues.map((issue) => ({
    code: "MCQ_OPTION_COUNT_INVALID" as const,
    path: issue.path.join("."),
    expected: issue.message,
  }));
  if (
    question.materialId !== canonical.materialId ||
    question.sourceVersionId !== canonical.sourceVersionId
  ) failures.push({ code: "MCQ_CROSS_SOURCE_EVIDENCE", path: "sourceScope" });
  failures.push(...sourceReferenceFailures(
    source,
    question.materialId,
    question.sourceVersionId,
    question.evidenceReferences,
    "evidenceReferences",
  ).map((failure) => ({
    ...failure,
    code: failure.code === "EVIDENCE_CROSS_MATERIAL" || failure.code === "EVIDENCE_CROSS_SOURCE_VERSION"
      ? "MCQ_CROSS_SOURCE_EVIDENCE" as const
      : failure.code,
  })));
  failures.push(...validateLanguageQuality(question.prompt, {
    path: "prompt",
    kind: "question",
    sourceLanguage: canonical.language,
  }));
  if (question.options.length !== 4) failures.push({ code: "MCQ_OPTION_COUNT_INVALID", path: "options" });
  const normalizedOptions = question.options.map((option) => normalizedComparable(option.text));
  if (
    normalizedOptions.some((option) => option.length === 0) ||
    new Set(normalizedOptions).size !== normalizedOptions.length
  ) failures.push({ code: "MCQ_DUPLICATE_OPTIONS", path: "options" });
  question.options.forEach((option, index) => {
    const languageFailures = validateLanguageQuality(option.text, {
      path: `options[${String(index)}].text`,
      kind: "option",
      sourceLanguage: canonical.language,
    });
    failures.push(...languageFailures);
    if (languageFailures.some((failure) => failure.code === "LANG_PLACEHOLDER_TEXT")) {
      failures.push({ code: "MCQ_PLACEHOLDER_OPTION", path: `options[${String(index)}].text` });
    }
  });
  for (let left = 0; left < question.options.length; left += 1) {
    for (let right = left + 1; right < question.options.length; right += 1) {
      if (similarity(question.options[left]?.text ?? "", question.options[right]?.text ?? "") >= 0.9) {
        failures.push({ code: "MCQ_DUPLICATE_OPTIONS", path: `options[${String(right)}]` });
      }
    }
  }
  const supported = question.options.filter((option) => optionSupported(option.text, canonical));
  if (supported.length === 0) failures.push({ code: "MCQ_NO_SUPPORTED_CORRECT_OPTION", path: "options" });
  if (supported.length > 1) failures.push({ code: "MCQ_MULTIPLE_CORRECT_OPTIONS", path: "options" });
  const correct = question.options.find((option) => option.id === question.correctOptionId);
  if (
    correct === undefined ||
    correct.role !== "correct" ||
    correct.validationClassification !== "supported_by_evidence" ||
    !optionSupported(correct.text, canonical)
  ) failures.push({ code: "MCQ_KEY_CANONICAL_MISMATCH", path: "correctOptionId" });
  for (const option of question.options.filter((candidate) => candidate.id !== question.correctOptionId)) {
    if (option.role !== "distractor" || option.validationClassification === "supported_by_evidence" || optionSupported(option.text, canonical)) {
      failures.push({ code: "MCQ_DISTRACTOR_INVALID", path: `options.${option.id}` });
    }
  }
  const canonicalClaimIds = new Set(canonical.requiredClaims.map((claim) => claim.id));
  if (question.requiredClaimIds.some((claimId) => !canonicalClaimIds.has(claimId))) {
    failures.push({ code: "QUESTION_REQUIRED_CLAIM_MISSING", path: "requiredClaimIds" });
  }
  if (similarity(question.prompt, canonical.canonicalAnswer) < 0.08) {
    failures.push({ code: "QUESTION_CANONICAL_ANSWER_MISMATCH", path: "prompt" });
  }
  if (similarity(question.explanation, canonical.canonicalAnswer) < 0.72) {
    failures.push({ code: "QUESTION_EXPLANATION_UNGROUNDED", path: "explanation" });
  }
  if (failures.some((failure) =>
    failure.code === "LANG_UNSTABLE_INTERPRETATION" ||
    failure.code === "LANG_TRUNCATED_SENTENCE"
  )) failures.push({ code: "MCQ_AMBIGUOUS_STEM", path: "prompt" });
  return uniqueFailures(failures);
}

export function validateShortWrittenQuestion(
  source: ConfirmedSource,
  canonical: CanonicalAnswerV2,
  question: ShortWrittenQuestionV2,
): ArtifactValidationFailure[] {
  const parsed = shortWrittenQuestionV2Schema.safeParse(question);
  const failures: ArtifactValidationFailure[] = parsed.success ? [] : parsed.error.issues.map((issue) => ({
    code: "QUESTION_REQUIRED_CLAIM_MISSING" as const,
    path: issue.path.join("."),
    expected: issue.message,
  }));
  failures.push(...sourceReferenceFailures(
    source,
    question.materialId,
    question.sourceVersionId,
    question.evidenceReferences,
    "evidenceReferences",
  ));
  failures.push(...validateLanguageQuality(question.prompt, {
    path: "prompt",
    kind: "question",
    sourceLanguage: canonical.language,
  }));
  const claimIds = new Set(canonical.requiredClaims.map((claim) => claim.id));
  if (
    question.canonicalAnswerId !== canonical.id ||
    question.requiredClaimIds.some((claimId) => !claimIds.has(claimId)) ||
    !canonical.requiredClaims.every((claim) => question.requiredClaimIds.includes(claim.id))
  ) failures.push({ code: "QUESTION_REQUIRED_CLAIM_MISSING", path: "requiredClaimIds" });
  if (similarity(question.prompt, canonical.canonicalAnswer) < 0.08) {
    failures.push({ code: "QUESTION_CANONICAL_ANSWER_MISMATCH", path: "prompt" });
  }
  if (similarity(question.explanation, canonical.canonicalAnswer) < 0.72) {
    failures.push({ code: "QUESTION_EXPLANATION_UNGROUNDED", path: "explanation" });
  }
  return uniqueFailures(failures);
}

export function validateQuestionRubricAlignment(
  source: ConfirmedSource,
  canonical: CanonicalAnswerV2,
  question: ShortWrittenQuestionV2,
  rubric: WrittenRubricV2,
): ArtifactValidationFailure[] {
  const parsed = writtenRubricV2Schema.safeParse(rubric);
  const failures: ArtifactValidationFailure[] = parsed.success ? [] : parsed.error.issues.map((issue) => ({
    code: "RUBRIC_QUESTION_MISMATCH" as const,
    path: issue.path.join("."),
    expected: issue.message,
  }));
  if (
    rubric.questionId !== question.id ||
    rubric.canonicalAnswerId !== canonical.id ||
    rubric.materialId !== question.materialId ||
    rubric.sourceVersionId !== question.sourceVersionId
  ) failures.push({ code: "RUBRIC_QUESTION_MISMATCH", path: "identity" });
  const marks = rubric.criteria.reduce((sum, criterion) => sum + criterion.maximumMarks, 0);
  if (
    marks !== 5 ||
    rubric.criteria.some((criterion) => criterion.maximumMarks < 0 || !Number.isInteger(criterion.maximumMarks))
  ) failures.push({ code: "RUBRIC_MARK_TOTAL_INVALID", path: "criteria.maximumMarks" });
  const normalizedCriteria = rubric.criteria.map((criterion) => normalizedComparable(criterion.description));
  if (new Set(normalizedCriteria).size !== normalizedCriteria.length) {
    failures.push({ code: "RUBRIC_DUPLICATE_CRITERIA", path: "criteria" });
  }
  const canonicalClaimIds = new Set(canonical.requiredClaims.map((claim) => claim.id));
  const questionClaimIds = new Set(question.requiredClaimIds);
  const coveredClaimIds = new Set<string>();
  for (const [index, criterion] of rubric.criteria.entries()) {
    failures.push(...validateLanguageQuality(criterion.description, {
      path: `criteria[${String(index)}].description`,
      kind: "rubric",
      sourceLanguage: canonical.language,
    }));
    failures.push(...sourceReferenceFailures(
      source,
      rubric.materialId,
      rubric.sourceVersionId,
      criterion.evidenceReferences,
      `criteria[${String(index)}].evidenceReferences`,
    ).map((failure) => ({
      ...failure,
      code: "RUBRIC_EVIDENCE_SCOPE_INVALID" as const,
    })));
    for (const claimId of criterion.requiredClaimIds) {
      if (!canonicalClaimIds.has(claimId) || !questionClaimIds.has(claimId)) {
        failures.push({ code: "RUBRIC_UNRELATED_CRITERION", path: `criteria[${String(index)}].requiredClaimIds` });
      } else {
        coveredClaimIds.add(claimId);
      }
    }
    const relatedClaims = canonical.requiredClaims.filter((claim) => criterion.requiredClaimIds.includes(claim.id));
    if (
      relatedClaims.length === 0 ||
      !relatedClaims.some((claim) =>
        criterion.requiredConceptIds.some((conceptId) => claim.conceptIds.includes(conceptId)) &&
        similarity(criterion.description, claim.text) >= 0.12
      )
    ) failures.push({ code: "RUBRIC_CANONICAL_ANSWER_MISMATCH", path: `criteria[${String(index)}]` });
  }
  for (const claimId of question.requiredClaimIds) {
    if (!coveredClaimIds.has(claimId)) {
      failures.push({ code: "RUBRIC_MISSING_CENTRAL_CONCEPT", path: "criteria" });
    }
  }
  return uniqueFailures(failures);
}

export function validateRevisionQuestion(
  source: ConfirmedSource,
  canonical: CanonicalAnswerV2,
  question: RevisionQuestionV2,
  originalAndAcceptedQuestions: readonly DuplicateCandidate[],
): ArtifactValidationFailure[] {
  const parsed = revisionQuestionV2Schema.safeParse(question);
  const failures: ArtifactValidationFailure[] = parsed.success ? [] : parsed.error.issues.map((issue) => ({
    code: "QUESTION_REQUIRED_CLAIM_MISSING" as const,
    path: issue.path.join("."),
    expected: issue.message,
  }));
  failures.push(...sourceReferenceFailures(
    source,
    question.materialId,
    question.sourceVersionId,
    question.evidenceReferences,
    "evidenceReferences",
  ));
  failures.push(...validateLanguageQuality(question.prompt, {
    path: "prompt",
    kind: "question",
    sourceLanguage: canonical.language,
  }));
  const duplicate = detectQuestionDuplicate({
    recordId: question.id,
    prompt: question.prompt,
    materialId: question.materialId,
    pipeline: "ankur_structured",
    operationId: question.id,
    kind: "retry",
  }, originalAndAcceptedQuestions);
  if (duplicate.duplicateDecision === "rejected") {
    failures.push({ code: "QUESTION_DUPLICATE", path: "prompt" });
  }
  const claimIds = new Set(canonical.requiredClaims.map((claim) => claim.id));
  if (question.requiredClaimIds.some((claimId) => !claimIds.has(claimId))) {
    failures.push({ code: "QUESTION_REQUIRED_CLAIM_MISSING", path: "requiredClaimIds" });
  }
  return uniqueFailures(failures);
}

export function validateRepairLockedFields<T extends Readonly<Record<string, unknown>>>(
  before: T,
  after: T,
  lockedFields: readonly (keyof T)[],
): ArtifactValidationFailure[] {
  return lockedFields.flatMap((field) =>
    JSON.stringify(before[field]) === JSON.stringify(after[field])
      ? []
      : [{ code: "REPAIR_LOCKED_FIELD_CHANGED" as const, path: String(field) }],
  );
}

export function aggregateEvaluationReliability(
  operations: readonly ReliabilityOperation[],
): ReliabilitySummary {
  const attempts = operations.flatMap((operation) => operation.providerAttempts);
  const firstAttempts = operations.map((operation) => operation.providerAttempts[0]).filter((attempt) => attempt !== undefined);
  const repaired = operations.filter((operation) => operation.repairAttempted);
  const byArtifact: Record<string, Record<string, number>> = {};
  for (const operation of operations) {
    const artifactCounts = byArtifact[operation.artifactType] ?? {};
    for (const code of operation.failureCodes) {
      artifactCounts[code] = (artifactCounts[code] ?? 0) + 1;
    }
    byArtifact[operation.artifactType] = artifactCounts;
  }
  return {
    denominators: {
      providerAttempts: attempts.length,
      logicalOperations: operations.length,
    },
    providerAvailability: {
      numerator: attempts.filter((attempt) => attempt.available).length,
      denominator: attempts.length,
    },
    firstPassSchemaValidity: {
      numerator: firstAttempts.filter((attempt) => attempt.schemaValid).length,
      denominator: operations.length,
    },
    firstPassSemanticValidity: {
      numerator: operations.filter((operation) => operation.firstPassSemanticValid).length,
      denominator: operations.length,
    },
    repairAttempted: {
      numerator: repaired.length,
      denominator: operations.length,
    },
    repairSuccess: {
      numerator: repaired.filter((operation) => operation.repairSuccess).length,
      denominator: repaired.length,
    },
    finalLogicalArtifactValidity: {
      numerator: operations.filter((operation) => operation.finalValid).length,
      denominator: operations.length,
    },
    questionRubricAlignmentValidity: {
      numerator: operations.filter((operation) => operation.alignmentValid).length,
      denominator: operations.length,
    },
    controlledFailures: operations.filter((operation) => operation.controlledFailure).length,
    providerLatencyMs: attempts.reduce((sum, attempt) => sum + attempt.latencyMs, 0),
    logicalOperationLatencyMs: operations.reduce((sum, operation) => sum + operation.logicalLatencyMs, 0),
    failureCodesByArtifactType: byArtifact,
  };
}

export function stableQuestionFingerprint(value: string): string {
  let hash = 0x811c9dc5;
  for (const character of normalizedComparable(value)) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
