import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  assertClosureEvidence,
  closureQuestionEvidenceSchema,
  closureWrittenEvidenceSchema,
  computeAdjudicationSummary,
  computeQuestionPipelineMetrics,
  computeReliabilityReclassification,
  task06ClosureMetricsSchema,
} from "../../src/shared/evaluation/task06-closure";
import { providerOperationSchema } from "../../src/shared/evaluation/task06-schemas";

async function json(path: string): Promise<unknown> {
  return JSON.parse(await readFile(resolve(path), "utf8")) as unknown;
}

function stable(value: unknown): string {
  function normalize(item: unknown): unknown {
    if (Array.isArray(item)) return item.map((entry) => normalize(entry));
    if (typeof item !== "object" || item === null) return item;
    return Object.fromEntries(
      Object.entries(item)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, normalize(entry)]),
    );
  }
  return JSON.stringify(normalize(value));
}

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text.charAt(index);
    if (quoted) {
      if (character === '"' && text.charAt(index + 1) === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/u, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }
  if (quoted) throw new Error("CLOSURE_CSV_UNCLOSED_QUOTE");
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  const rawHeaders = rows.shift();
  if (!rawHeaders) throw new Error("CLOSURE_CSV_EMPTY");
  const headers = rawHeaders.map((header, index) =>
    index === 0 ? header.replace(/^\uFEFF/u, "") : header
  );
  return rows
    .filter((candidate) => candidate.some((value) => value.length > 0))
    .map((candidate) =>
      Object.fromEntries(
        headers.map((header, index) => [header, candidate[index] ?? ""]),
      ),
    );
}

async function csv(path: string): Promise<Record<string, string>[]> {
  return parseCsv(await readFile(resolve(path), "utf8"));
}

function value(record: Record<string, unknown>, field: string): string {
  const candidate = record[field];
  if (typeof candidate !== "string") {
    throw new Error(`CLOSURE_PRIVATE_VALUE_INVALID:${field}`);
  }
  return candidate;
}

function assertQuestionExport(
  questions: readonly Record<string, unknown>[],
  rows: readonly Record<string, string>[],
): void {
  if (rows.length !== questions.length) {
    throw new Error("CLOSURE_QUESTION_EXPORT_COUNT_MISMATCH");
  }
  const byId = new Map(rows.map((row) => [row["record_id"], row]));
  if (byId.size !== rows.length) throw new Error("CLOSURE_QUESTION_EXPORT_DUPLICATE_ID");
  const mappings = [
    ["material_id", "material_id"],
    ["pipeline", "pipeline"],
    ["question_stage", "question_stage"],
    ["adj_question_text_accept_or_reject", "pass_a_accepted"],
    ["adj_final_accept_or_reject", "pass_b_accepted"],
    ["overall_accept", "overall_accepted"],
    ["adj_question_grounded_in_permitted_source", "source_grounded"],
    ["adj_answerable_from_source", "answerable"],
    ["adj_clear", "clear"],
    ["adj_ambiguous", "ambiguous"],
    ["adj_fair_difficulty", "fair_difficulty"],
    ["adj_materially_duplicate", "within_pipeline_duplicate"],
    ["adj_language_quality", "language_quality"],
    ["adj_proposed_answer_or_key_correct", "answer_or_key_correct"],
    ["adj_proposed_answer_or_key_grounded", "answer_or_key_grounded"],
    ["adj_explanation_or_evidence_usefulness", "explanation_usefulness"],
  ] as const;
  for (const question of questions) {
    const recordId = value(question, "record_id");
    const row = byId.get(recordId);
    if (!row) throw new Error(`CLOSURE_QUESTION_EXPORT_ID_MISSING:${recordId}`);
    for (const [privateField, publicField] of mappings) {
      if (value(question, privateField) !== row[publicField]) {
        throw new Error(
          `CLOSURE_QUESTION_EXPORT_FIELD_MISMATCH:${recordId}:${publicField}`,
        );
      }
    }
  }
}

function assertWrittenExport(
  written: readonly Record<string, unknown>[],
  rows: readonly Record<string, string>[],
): void {
  if (rows.length !== written.length) {
    throw new Error("CLOSURE_WRITTEN_EXPORT_COUNT_MISMATCH");
  }
  const byId = new Map(rows.map((row) => [row["record_id"], row]));
  if (byId.size !== rows.length) throw new Error("CLOSURE_WRITTEN_EXPORT_DUPLICATE_ID");
  const mappings = [
    ["material_id", "material_id"],
    ["answer_case", "answer_case"],
    ["eligibility", "final_eligibility"],
    ["model_awarded_marks", "model_awarded_marks"],
    ["model_status", "model_status"],
    ["adj_model_feedback_grounded", "diagnostic_feedback_grounded"],
    ["adj_feedback_usefulness", "diagnostic_feedback_usefulness"],
  ] as const;
  for (const item of written) {
    const recordId = value(item, "record_id");
    const row = byId.get(recordId);
    if (!row) throw new Error(`CLOSURE_WRITTEN_EXPORT_ID_MISSING:${recordId}`);
    for (const [privateField, publicField] of mappings) {
      if (value(item, privateField) !== row[publicField]) {
        throw new Error(
          `CLOSURE_WRITTEN_EXPORT_FIELD_MISMATCH:${recordId}:${publicField}`,
        );
      }
    }
    if (row["metric_treatment"] !== "exclude_from_semantic_grading_metrics") {
      throw new Error(`CLOSURE_WRITTEN_METRIC_TREATMENT_INVALID:${recordId}`);
    }
  }
}

function assertCycloneCorrections(
  questions: readonly Record<string, unknown>[],
): void {
  const cyclone = questions.filter(
    (question) => value(question, "material_id") === "CIV-BN-IMG-01",
  );
  if (cyclone.length !== 5) throw new Error("CLOSURE_CYCLONE_COUNT_INVALID");
  const byId = new Map(
    cyclone.map((question) => [value(question, "record_id"), question]),
  );
  for (let ordinal = 1; ordinal <= 4; ordinal += 1) {
    const recordId = `baseline-question:CIV-BN-IMG-01:q${String(ordinal)}`;
    const question = byId.get(recordId);
    if (
      !question ||
      value(question, "adj_question_text_accept_or_reject") !== "accept" ||
      value(question, "adj_final_accept_or_reject") !== "accept" ||
      value(question, "overall_accept") !== "accept"
    ) {
      throw new Error(`CLOSURE_CYCLONE_ACCEPTED_CORRECTION_INVALID:${recordId}`);
    }
  }
  const finalRecordId = "baseline-question:CIV-BN-IMG-01:q5";
  const finalQuestion = byId.get(finalRecordId);
  if (
    !finalQuestion ||
    value(finalQuestion, "adj_clear") !== "no" ||
    value(finalQuestion, "adj_ambiguous") !== "yes" ||
    value(finalQuestion, "adj_question_text_accept_or_reject") !== "reject" ||
    value(finalQuestion, "adj_final_accept_or_reject") !== "accept" ||
    value(finalQuestion, "overall_accept") !== "reject"
  ) {
    throw new Error(`CLOSURE_CYCLONE_REJECTED_CORRECTION_INVALID:${finalRecordId}`);
  }
}

async function main(): Promise<void> {
  const privateRoot = "evaluation/annotations/completed-private/task06-final";
  const questions = (await json(`${privateRoot}/question-human-evidence.json`) as unknown[])
    .map((item) => closureQuestionEvidenceSchema.parse(item));
  const written = (await json(`${privateRoot}/written-human-evidence.json`) as unknown[])
    .map((item) => closureWrittenEvidenceSchema.parse(item));
  const provider = (await json("evaluation/records/public/provider-operations.json") as unknown[])
    .map((item) => providerOperationSchema.parse(item));
  const committed = task06ClosureMetricsSchema.parse(
    await json("evaluation/exports/task06-closure-metrics.json"),
  );
  const questionExport = await csv(
    "evaluation/exports/question-error-analysis-v2.csv",
  );
  const writtenExport = await csv(
    "evaluation/exports/written-evaluation-validity.csv",
  );

  assertClosureEvidence(questions, written);
  const adjudication = computeAdjudicationSummary(questions, written);
  if (
    adjudication.totalDisagreements !== 155 ||
    adjudication.adjudicatedDisagreements !== 155
  ) {
    throw new Error("CLOSURE_ADJUDICATION_COUNT_MISMATCH");
  }
  assertQuestionExport(questions, questionExport);
  assertWrittenExport(written, writtenExport);
  assertCycloneCorrections(questions);
  const questionMetrics = computeQuestionPipelineMetrics(questions);
  const reliability = computeReliabilityReclassification(provider);

  if (stable(questionMetrics) !== stable(committed.questionQuality.pipelines)) {
    throw new Error("CLOSURE_QUESTION_METRICS_MISMATCH");
  }
  if (
    committed.corpus.questions !== questions.length ||
    committed.corpus.writtenCases !== written.length
  ) {
    throw new Error("CLOSURE_WRITTEN_DENOMINATOR_MISMATCH");
  }
  for (const key of [
    "provider_availability",
    "logical_operations",
    "first_pass_valid",
    "repair_attempted",
    "repair_success",
    "final_artifact_valid",
    "controlled_failure",
  ] as const) {
    if (stable(reliability[key]) !== stable(committed.reliability[key])) {
      throw new Error(`CLOSURE_RELIABILITY_MISMATCH_${key.toUpperCase()}`);
    }
  }

  process.stdout.write(
    "Task 06 human-evidence closure reconciliation PASSED: 60 questions, 14 excluded written cases, 155 adjudicated disagreements, 44 logical operations.\n",
  );
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : "CLOSURE_RECONCILIATION_FAILED"}\n`);
  process.exitCode = 1;
});
