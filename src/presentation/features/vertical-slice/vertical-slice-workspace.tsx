"use client";

import { LazyMotion, domAnimation, m, useReducedMotion } from "motion/react";
import { ArrowDown, BookOpen, CheckCircle2, FileCheck2, GitBranch, Leaf, PencilLine, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  createSampleActivitySet,
  createSamplePreparationMap,
  createSampleRevisionPlan,
  createSampleRetryWrittenEvaluation,
  createSampleWrittenEvaluation,
  SAMPLE_PARTIAL_WRITTEN_ANSWER,
  SAMPLE_PAGES,
} from "../../../application/sample/sample-vertical-slice";
import { calculateConceptPerformance, reconcileAssessmentTotal, type ConceptPerformance } from "../../../domain/assessments/concept-performance";
import { gradeMcq, type ActivitySet, type AssessmentDifficulty, type McqGrade } from "../../../domain/assessments/mcq";
import { createEmptyWrittenEvaluation, type WrittenAnswerEvaluation } from "../../../domain/assessments/written-evaluation";
import { type PreparationMap } from "../../../domain/preparation/preparation-map";
import { compareAssessmentAttempts, type ImprovementComparison } from "../../../domain/revision/improvement-comparison";
import type { RevisionPlan } from "../../../domain/revision/revision-plan";
import {
  createConfirmedSource,
  SourceDomainError,
  type ConfirmedSource,
  type SourceLanguage,
  type SourceMethod,
} from "../../../domain/source/confirmed-source";
import type { ReviewPage } from "../../../domain/source/page-extraction";
import { DocumentIngestionError } from "../../../infrastructure/documents/browser-document-processor";
import { requestMixedAssessment, requestPageTranscription, requestPersonalizedRevision, requestPreparationMap, requestWrittenEvaluation, ApiClientError } from "../../api/client";
import { AnkurMark } from "../../components/brand/ankur-mark";
import { ConceptCanopy } from "../../components/learning/concept-canopy";
import { AssessmentBuilder } from "../../components/learning/assessment-builder";
import { GrowthRail, type LearningStage } from "../../components/learning/growth-rail";
import { PageReviewCard } from "../../components/learning/page-review-card";
import { PracticeCard } from "../../components/learning/practice-card";
import { ProcessNarrative } from "../../components/learning/process-narrative";
import { ResultSummary } from "../../components/learning/result-summary";
import { RevisionPlanView } from "../../components/learning/revision-plan-view";
import { AdaptiveResultSummary } from "../../components/learning/adaptive-result-summary";
import { RuntimePill, type RuntimeState } from "../../components/learning/runtime-pill";
import { SourceCanvas, type SourceKind } from "../../components/learning/source-canvas";
import { AlertBanner, Badge, Button, Field, TextInput } from "../../components/ui/primitives";
import { processPageImagesForReview, processPdfForReview } from "../../composition/browser-services";
import {
  INGESTION_STORAGE_KEY,
  TASK04_STORAGE_KEY,
  TASK03_STORAGE_KEY,
  migrateTask04Session,
  migrateTask03Session,
  parsePersistedIngestionSession,
  toPersistedIngestionSession,
} from "../../persistence/ingestion-session";

type Stage = LearningStage;
type Mode = "live" | "sample";

interface SourceMetadata {
  readonly name: string;
  readonly kind: "pasted_text" | "pdf" | "page_images" | "sample";
  readonly pageCount: number;
}

const SESSION_KEY = "ankur.session-id.v1";
const LEGACY_STORAGE_KEY = "ankur.vertical-slice.v1";

function languageFor(text: string): SourceLanguage {
  if (text.trim().length === 0) return "mixed";
  const bengali = /[\u0980-\u09FF]/u.test(text);
  const latin = /[A-Za-z]/u.test(text);
  if (bengali && latin) return "mixed";
  return bengali ? "bn" : "en";
}

function sourceMethod(metadata: SourceMetadata | undefined): SourceMethod {
  if (metadata?.kind === "pdf") return "pdf";
  if (metadata?.kind === "page_images") return "page_images";
  return "pasted_text";
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof SourceDomainError) {
    if (error.code === "EMPTY_SOURCE") return "Include at least one page with reviewed text.";
    if (error.code === "SOURCE_TOO_LARGE") return "Confirmed text must be 25,000 characters or fewer.";
    return "The reviewed pages could not form a valid source.";
  }
  if (error instanceof DocumentIngestionError) {
    const messages: Readonly<Record<DocumentIngestionError["code"], string>> = {
      INVALID_FILE_TYPE: "Choose one PDF, or one to three JPG, PNG, or WebP images.",
      FILE_TOO_LARGE: "The selected source must be 8 MB or smaller in total.",
      PAGE_LIMIT_EXCEEDED: "Choose a source containing one to three pages.",
      MALFORMED_PDF: "The PDF could not be read safely. Try a valid PDF or page images.",
      ENCRYPTED_PDF: "Encrypted PDFs are not supported. Export an unlocked copy or use page images.",
      IMAGE_DECODE_FAILED: "One image could not be decoded. Choose a valid JPG, PNG, or WebP file.",
      IMAGE_COMPRESSION_FAILED: "A page could not be prepared below the safe image limit.",
    };
    return messages[error.code];
  }
  return "Something went wrong. Completed page review work remains preserved.";
}

function getSessionId(): string {
  const existing = window.localStorage.getItem(SESSION_KEY);
  if (existing !== null) return existing;
  const created = crypto.randomUUID();
  window.localStorage.setItem(SESSION_KEY, created);
  return created;
}

function sampleReviewPages(): ReviewPage[] {
  return SAMPLE_PAGES.map((page) => ({
    id: `page-${String(page.pageNumber).padStart(3, "0")}`,
    pageNumber: page.pageNumber,
    sourceKind: "sample",
    method: page.pageNumber === 2 ? "gemma_ocr" : "embedded_text",
    text: page.text,
    uncertainSegments: page.pageNumber === 2
      ? [{ text: "কার্বন ডাই-অক্সাইড", reason: "Hyphenation should be checked against the page preview." }]
      : [],
    warnings: page.pageNumber === 2 ? ["OCR drafts must be reviewed and confirmed by the learner."] : [],
    included: true,
    status: "ready",
    previewAvailable: true,
  }));
}

function HeroComposition() {
  return (
    <div className="hero-composition" aria-label="Source becomes a grounded map and practice question">
      <div className="hero-orbit hero-orbit--one" aria-hidden="true" /><div className="hero-orbit hero-orbit--two" aria-hidden="true" />
      <article className="hero-sheet"><span><BookOpen size={17} />Source</span><i /><i /><i /></article>
      <article className="hero-map"><span><GitBranch size={17} />Concept map</span><div><i /><i /><i /></div></article>
      <article className="hero-question"><span>?</span><div><strong>Practice</strong><small>Evidence linked</small></div></article>
      <span className="hero-leaf hero-leaf--one" aria-hidden="true"><Leaf /></span><span className="hero-leaf hero-leaf--two" aria-hidden="true"><Leaf /></span>
    </div>
  );
}

export function VerticalSliceWorkspace() {
  const [stage, setStage] = useState<Stage>("input");
  const [mode, setMode] = useState<Mode>("live");
  const [sourceKind, setSourceKind] = useState<SourceKind>("text");
  const [draftText, setDraftText] = useState("");
  const [pages, setPages] = useState<ReviewPage[]>([]);
  const [metadata, setMetadata] = useState<SourceMetadata>();
  const [priority, setPriority] = useState("");
  const [confirmedSource, setConfirmedSource] = useState<ConfirmedSource>();
  const [preparationMap, setPreparationMap] = useState<PreparationMap>();
  const [activitySet, setActivitySet] = useState<ActivitySet>();
  const [assessmentTitle, setAssessmentTitle] = useState("");
  const [difficulty, setDifficulty] = useState<AssessmentDifficulty>("medium");
  const [selectedConceptIds, setSelectedConceptIds] = useState<string[]>([]);
  const [selectedOptionId, setSelectedOptionId] = useState("");
  const [writtenAnswer, setWrittenAnswer] = useState("");
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<0 | 1>(0);
  const [grade, setGrade] = useState<McqGrade>();
  const [writtenEvaluation, setWrittenEvaluation] = useState<WrittenAnswerEvaluation>();
  const [conceptPerformance, setConceptPerformance] = useState<ConceptPerformance[]>();
  const [writtenOperationId, setWrittenOperationId] = useState<string>();
  const [uncertainWrittenFailure, setUncertainWrittenFailure] = useState(false);
  const [revisionPlan, setRevisionPlan] = useState<RevisionPlan>();
  const [revisionOperationId, setRevisionOperationId] = useState<string>();
  const [uncertainRevisionFailure, setUncertainRevisionFailure] = useState(false);
  const [retrySelectedOptionId, setRetrySelectedOptionId] = useState("");
  const [retryWrittenAnswer, setRetryWrittenAnswer] = useState("");
  const [retryCurrentQuestionIndex, setRetryCurrentQuestionIndex] = useState<0 | 1>(0);
  const [retryGrade, setRetryGrade] = useState<McqGrade>();
  const [retryWrittenEvaluation, setRetryWrittenEvaluation] = useState<WrittenAnswerEvaluation>();
  const [retryConceptPerformance, setRetryConceptPerformance] = useState<ConceptPerformance[]>();
  const [retryWrittenOperationId, setRetryWrittenOperationId] = useState<string>();
  const [uncertainRetryFailure, setUncertainRetryFailure] = useState(false);
  const [improvementComparison, setImprovementComparison] = useState<ImprovementComparison>();
  const [confirmingSubmission, setConfirmingSubmission] = useState(false);
  const [submittingAssessment, setSubmittingAssessment] = useState(false);
  const [loading, setLoading] = useState<string>();
  const [loadingKind, setLoadingKind] = useState<"ingestion" | "generation">("generation");
  const [error, setError] = useState<string>();
  const [sessionId, setSessionId] = useState("");
  const [draftId, setDraftId] = useState("");
  const [liveStatus, setLiveStatus] = useState<RuntimeState>("checking");
  const [hydrated, setHydrated] = useState(false);
  const [motionReady, setMotionReady] = useState(false);
  const [recoveryNotice, setRecoveryNotice] = useState(false);
  const workspaceRef = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    setMotionReady(true);
    setSessionId(getSessionId());
    setDraftId(`draft-${crypto.randomUUID()}`);
    const raw = window.localStorage.getItem(INGESTION_STORAGE_KEY);
    const task04 = window.localStorage.getItem(TASK04_STORAGE_KEY);
    const task03 = window.localStorage.getItem(TASK03_STORAGE_KEY);
    const persisted = raw !== null ? parsePersistedIngestionSession(raw)
      : task04 !== null ? migrateTask04Session(task04)
        : task03 !== null ? migrateTask03Session(task03) : undefined;
    if (persisted !== undefined) {
      setStage(persisted.stage); setMode(persisted.mode); setSourceKind(persisted.sourceKind);
      setPages([...persisted.pages]); setPriority(persisted.priorityInstruction);
      setMetadata(persisted.sourceMetadata); setConfirmedSource(persisted.confirmedSource);
      setPreparationMap(persisted.preparationMap); setActivitySet(persisted.activitySet);
      setAssessmentTitle(persisted.assessmentConfiguration?.title ?? "");
      setDifficulty(persisted.assessmentConfiguration?.difficulty ?? "medium");
      setSelectedConceptIds([...(persisted.assessmentConfiguration?.selectedConceptIds ?? persisted.preparationMap?.concepts.map((concept) => concept.id) ?? [])]);
      setSelectedOptionId(persisted.selectedOptionId ?? ""); setWrittenAnswer(persisted.writtenAnswer ?? "");
      setCurrentQuestionIndex(persisted.currentQuestionIndex); setGrade(persisted.mcqGrade);
      setWrittenEvaluation(persisted.writtenEvaluation); setConceptPerformance(persisted.conceptPerformance === undefined ? undefined : [...persisted.conceptPerformance]);
      setWrittenOperationId(persisted.writtenOperationId); setUncertainWrittenFailure(persisted.uncertainWrittenFailure);
      setRevisionPlan(persisted.revisionPlan); setRevisionOperationId(persisted.revisionOperationId); setUncertainRevisionFailure(persisted.uncertainRevisionFailure);
      setRetrySelectedOptionId(persisted.retrySelectedOptionId ?? ""); setRetryWrittenAnswer(persisted.retryWrittenAnswer);
      setRetryCurrentQuestionIndex(persisted.retryCurrentQuestionIndex); setRetryGrade(persisted.retryMcqGrade);
      setRetryWrittenEvaluation(persisted.retryWrittenEvaluation);
      setRetryConceptPerformance(persisted.retryConceptPerformance === undefined ? undefined : [...persisted.retryConceptPerformance]);
      setRetryWrittenOperationId(persisted.retryWrittenOperationId); setUncertainRetryFailure(persisted.uncertainRetryFailure);
      setImprovementComparison(persisted.improvementComparison);
      setDraftText(persisted.pages[0]?.sourceKind === "pasted_text" ? persisted.pages[0].text : "");
      setRecoveryNotice(persisted.recoveredWithoutPreviews && persisted.pages.some((page) => page.sourceKind === "pdf" || page.sourceKind === "page_image"));
    }
    setHydrated(true);
    void fetch("/api/runtime-status").then((response) => response.json()).then((payload: unknown) => {
      const data = typeof payload === "object" && payload !== null && typeof Reflect.get(payload, "data") === "object" ? Reflect.get(payload, "data") as object : undefined;
      if (data === undefined) { setLiveStatus("unavailable"); return; }
      if (Reflect.get(data, "liveAiEnabled") === true) setLiveStatus("ready");
      else if (Reflect.get(data, "sampleModeEnabled") === true) setLiveStatus("sample");
      else setLiveStatus("unavailable");
    }).catch(() => setLiveStatus("unavailable"));
  }, []);

  useEffect(() => {
    if (!hydrated || (pages.length === 0 && confirmedSource === undefined)) return;
    window.localStorage.setItem(INGESTION_STORAGE_KEY, toPersistedIngestionSession({
      stage, mode, sourceKind,
      ...(metadata === undefined ? {} : { sourceMetadata: metadata }),
      pages, priorityInstruction: priority,
      ...(confirmedSource === undefined ? {} : { confirmedSource }),
      ...(preparationMap === undefined ? {} : { preparationMap }),
      ...(preparationMap === undefined || assessmentTitle.trim() === "" || selectedConceptIds.length === 0 ? {} : { assessmentConfiguration: { title: assessmentTitle, selectedConceptIds, difficulty } }),
      ...(activitySet === undefined ? {} : { activitySet }),
      ...(selectedOptionId === "" ? {} : { selectedOptionId }),
      writtenAnswer, currentQuestionIndex,
      ...(grade === undefined ? {} : { mcqGrade: grade }),
      ...(writtenEvaluation === undefined ? {} : { writtenEvaluation }),
      ...(conceptPerformance === undefined ? {} : { conceptPerformance }),
      ...(writtenOperationId === undefined ? {} : { writtenOperationId }),
      uncertainWrittenFailure,
      ...(revisionPlan === undefined ? {} : { revisionPlan }),
      ...(revisionOperationId === undefined ? {} : { revisionOperationId }),
      uncertainRevisionFailure,
      ...(retrySelectedOptionId === "" ? {} : { retrySelectedOptionId }),
      retryWrittenAnswer, retryCurrentQuestionIndex,
      ...(retryGrade === undefined ? {} : { retryMcqGrade: retryGrade }),
      ...(retryWrittenEvaluation === undefined ? {} : { retryWrittenEvaluation }),
      ...(retryConceptPerformance === undefined ? {} : { retryConceptPerformance }),
      ...(retryWrittenOperationId === undefined ? {} : { retryWrittenOperationId }),
      uncertainRetryFailure,
      ...(improvementComparison === undefined ? {} : { improvementComparison }),
    }));
  }, [activitySet, assessmentTitle, conceptPerformance, confirmedSource, currentQuestionIndex, difficulty, grade, hydrated, improvementComparison, metadata, mode, pages, preparationMap, priority, retryConceptPerformance, retryCurrentQuestionIndex, retryGrade, retrySelectedOptionId, retryWrittenAnswer, retryWrittenEvaluation, retryWrittenOperationId, revisionOperationId, revisionPlan, selectedConceptIds, selectedOptionId, sourceKind, stage, uncertainRetryFailure, uncertainRevisionFailure, uncertainWrittenFailure, writtenAnswer, writtenEvaluation, writtenOperationId]);

  const hasProcessingPage = pages.some((page) => page.status === "processing");
  const canConfirm = !hasProcessingPage && pages.some((page) => page.included && page.text.trim().length > 0);

  function clearAdaptiveState() {
    setRevisionPlan(undefined); setRevisionOperationId(undefined); setUncertainRevisionFailure(false);
    setRetrySelectedOptionId(""); setRetryWrittenAnswer(""); setRetryCurrentQuestionIndex(0);
    setRetryGrade(undefined); setRetryWrittenEvaluation(undefined); setRetryConceptPerformance(undefined);
    setRetryWrittenOperationId(undefined); setUncertainRetryFailure(false); setImprovementComparison(undefined);
  }

  function invalidateDownstream() {
    if (confirmedSource !== undefined || preparationMap !== undefined || activitySet !== undefined) {
      setConfirmedSource(undefined); setPreparationMap(undefined); setActivitySet(undefined);
      setAssessmentTitle(""); setSelectedConceptIds([]); setSelectedOptionId(""); setWrittenAnswer(""); setGrade(undefined);
      setWrittenEvaluation(undefined); setConceptPerformance(undefined); setWrittenOperationId(undefined); setUncertainWrittenFailure(false); clearAdaptiveState(); setStage("review");
    }
  }

  function updatePage(pageNumber: number, change: (page: ReviewPage) => ReviewPage) {
    setPages((current) => current.map((page) => page.pageNumber === pageNumber ? change(page) : page));
  }

  async function transcribeOne(page: ReviewPage) {
    if (page.transcriptionImage === undefined || sessionId === "") return;
    invalidateDownstream();
    updatePage(page.pageNumber, (current) => ({ ...current, status: "processing", error: undefined }));
    setLoadingKind("ingestion"); setLoading(`Transcribing page ${String(page.pageNumber)} of ${String(pages.length)}…`); setError(undefined);
    try {
      const result = await requestPageTranscription({
        sourceVersionDraftId: draftId,
        materialOrdinal: 1,
        pageNumber: page.pageNumber,
        mimeType: page.transcriptionImage.mimeType,
        imageBase64: page.transcriptionImage.base64Data,
        ...(page.rawExtraction === undefined ? {} : { optionalRawExtraction: page.rawExtraction }),
        targetLanguage: languageFor(page.rawExtraction ?? ""),
      }, sessionId);
      updatePage(page.pageNumber, (current) => ({
        ...current,
        text: result.text,
        method: "gemma_ocr",
        uncertainSegments: result.uncertainSegments,
        warnings: [...current.warnings, ...result.warnings],
        status: "ready",
        error: undefined,
      }));
    } catch (caught) {
      const message = errorMessage(caught);
      updatePage(page.pageNumber, (current) => ({
        ...current,
        text: current.text || current.rawExtraction || "",
        status: "error",
        error: `${message} You can retry while this page preview is open, type the text manually, or exclude this page.`,
      }));
      setError(message);
    } finally {
      setLoading(undefined);
    }
  }

  async function transcribePending(nextPages: readonly ReviewPage[]) {
    for (const page of nextPages) {
      if (page.status === "processing") await transcribeOne(page);
    }
  }

  function startSample() {
    setMode("sample"); setSourceKind("pdf"); setDraftText(""); setPriority("");
    const nextPages = sampleReviewPages();
    setPages(nextPages); setMetadata({ name: "Bengali photosynthesis · mixed sample", kind: "sample", pageCount: 3 });
    setConfirmedSource(undefined); setPreparationMap(undefined); setActivitySet(undefined); setAssessmentTitle(""); setSelectedConceptIds([]);
    setSelectedOptionId(""); setWrittenAnswer(SAMPLE_PARTIAL_WRITTEN_ANSWER); setCurrentQuestionIndex(0); setGrade(undefined);
    setWrittenEvaluation(undefined); setConceptPerformance(undefined); setWrittenOperationId(undefined); setUncertainWrittenFailure(false);
    clearAdaptiveState();
    setError(undefined); setRecoveryNotice(false); setStage("review");
  }

  function reviewPastedText() {
    if (draftText.trim().length < 20) { setError("Add at least 20 characters of learning material."); return; }
    const nextPage: ReviewPage = {
      id: "page-001", pageNumber: 1, sourceKind: "pasted_text", method: "manual_text",
      text: draftText, uncertainSegments: [], warnings: [], included: true, status: "ready", previewAvailable: false,
    };
    setMode("live"); setPages([nextPage]); setMetadata({ name: "Pasted learning material", kind: "pasted_text", pageCount: 1 });
    setConfirmedSource(undefined); setPreparationMap(undefined); setActivitySet(undefined); setAssessmentTitle(""); setSelectedConceptIds([]); setWrittenAnswer(""); clearAdaptiveState(); setError(undefined); setStage("review");
  }

  async function handlePdf(file: File | undefined) {
    if (file === undefined) return;
    setLoadingKind("ingestion"); setLoading("Reading and routing PDF pages in your browser…"); setError(undefined);
    try {
      const processed = await processPdfForReview(file);
      setMode("live"); setSourceKind("pdf"); setPages([...processed.pages]);
      setMetadata({ name: processed.sourceName, kind: "pdf", pageCount: processed.pages.length });
      setConfirmedSource(undefined); setPreparationMap(undefined); setActivitySet(undefined); setAssessmentTitle(""); setSelectedConceptIds([]); setWrittenAnswer(""); clearAdaptiveState(); setRecoveryNotice(false); setStage("review");
      await transcribePending(processed.pages);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally { setLoading(undefined); }
  }

  async function handleImages(files: readonly File[]) {
    if (files.length === 0) return;
    setLoadingKind("ingestion"); setLoading("Preparing page images on your device…"); setError(undefined);
    try {
      const processed = await processPageImagesForReview(files);
      setMode("live"); setSourceKind("images"); setPages([...processed.pages]);
      setMetadata({ name: processed.sourceName, kind: "page_images", pageCount: processed.pages.length });
      setConfirmedSource(undefined); setPreparationMap(undefined); setActivitySet(undefined); setAssessmentTitle(""); setSelectedConceptIds([]); setWrittenAnswer(""); clearAdaptiveState(); setRecoveryNotice(false); setStage("review");
      await transcribePending(processed.pages);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally { setLoading(undefined); }
  }

  function confirmSource() {
    setError(undefined);
    try {
      const includedPages = pages.filter((page) => page.included && page.text.trim().length > 0)
        .map((page) => ({ pageNumber: page.pageNumber, text: page.text }));
      const combined = includedPages.map((page) => page.text).join("\n\n");
      const source = createConfirmedSource({
        pages: includedPages,
        language: languageFor(combined),
        method: sourceMethod(metadata),
        ...(priority.trim() === "" ? {} : { priorityInstruction: priority }),
      });
      setConfirmedSource(source); setPreparationMap(undefined); setActivitySet(undefined); setAssessmentTitle(""); setSelectedConceptIds([]);
      setSelectedOptionId(""); setWrittenAnswer(mode === "sample" ? SAMPLE_PARTIAL_WRITTEN_ANSWER : ""); setGrade(undefined);
      setWrittenEvaluation(undefined); setConceptPerformance(undefined); clearAdaptiveState(); setStage("confirmed");
    } catch (caught) { setError(errorMessage(caught)); }
  }

  async function buildPreparationMap() {
    if (confirmedSource === undefined) return;
    setLoadingKind("generation"); setLoading(mode === "sample" ? "Preparing the fixed offline concept map…" : "Mapping concepts from confirmed segments…"); setError(undefined);
    try {
      const map = mode === "sample" ? createSamplePreparationMap(confirmedSource) : await requestPreparationMap({
        sourceVersionId: confirmedSource.sourceVersionId,
        language: confirmedSource.language,
        ...(confirmedSource.priorityInstruction === undefined ? {} : { priorityInstruction: confirmedSource.priorityInstruction }),
        segments: confirmedSource.segments.map(({ id, pageNumber, text }) => ({ id, pageNumber, text })),
      }, sessionId);
      setPreparationMap(map); setAssessmentTitle(`${map.title} · Focus assessment`); setSelectedConceptIds(map.concepts.map((concept) => concept.id)); setDifficulty("medium"); setStage("preparation");
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setLoading(undefined); }
  }

  async function generateAssessment() {
    if (confirmedSource === undefined || preparationMap === undefined) return;
    setLoadingKind("generation"); setLoading(mode === "sample" ? "Preparing the fixed offline mixed assessment…" : "Preparing one MCQ and one written question…"); setError(undefined);
    try {
      const generated = mode === "sample" ? createSampleActivitySet(confirmedSource, preparationMap) : await requestMixedAssessment({
        sourceVersionId: confirmedSource.sourceVersionId, preparationMap,
        selectedConceptIds,
        configuration: { title: assessmentTitle.trim(), language: confirmedSource.language, mcqCount: 1, shortWrittenCount: 1, difficulty },
        segments: confirmedSource.segments.map(({ id, pageNumber, text }) => ({ id, pageNumber, text })),
      }, sessionId);
      setActivitySet(generated); setSelectedOptionId(""); setWrittenAnswer(mode === "sample" ? SAMPLE_PARTIAL_WRITTEN_ANSWER : ""); setCurrentQuestionIndex(0);
      setGrade(undefined); setWrittenEvaluation(undefined); setConceptPerformance(undefined); setWrittenOperationId(undefined); setUncertainWrittenFailure(false); clearAdaptiveState(); setStage("assessment");
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setLoading(undefined); }
  }

  function updateAssessmentConfiguration(change: () => void) {
    change(); setActivitySet(undefined); setSelectedOptionId(""); setWrittenAnswer(mode === "sample" ? SAMPLE_PARTIAL_WRITTEN_ANSWER : "");
    setGrade(undefined); setWrittenEvaluation(undefined); setConceptPerformance(undefined); setWrittenOperationId(undefined); setUncertainWrittenFailure(false); clearAdaptiveState();
  }

  function toggleConcept(conceptId: string) {
    updateAssessmentConfiguration(() => setSelectedConceptIds((current) => current.includes(conceptId) ? current.filter((id) => id !== conceptId) : [...current, conceptId]));
  }

  async function submitAssessment() {
    if (activitySet === undefined || confirmedSource === undefined || preparationMap === undefined || submittingAssessment) return;
    setConfirmingSubmission(false); setSubmittingAssessment(true); setError(undefined); setLoadingKind("generation");
    const operationId = writtenOperationId ?? `written-${crypto.randomUUID()}`;
    setWrittenOperationId(operationId);
    const mcqGrade = gradeMcq(activitySet.questions[0], selectedOptionId);
    setGrade(mcqGrade);
    try {
      let evaluation: WrittenAnswerEvaluation;
      if (writtenAnswer.trim() === "") {
        evaluation = createEmptyWrittenEvaluation({ question: activitySet.questions[1], requestId: operationId });
      } else if (mode === "sample") {
        setLoading("Applying the fixed grounded sample rubric…");
        evaluation = createSampleWrittenEvaluation(activitySet);
      } else {
        setLoading("Gemma 4 is reconciling each rubric criterion…");
        const allowedIds = new Set([
          ...activitySet.questions[1].evidence.map((reference) => reference.segmentId),
          ...activitySet.questions[1].rubric.flatMap((criterion) => criterion.evidence.map((reference) => reference.segmentId)),
        ]);
        evaluation = await requestWrittenEvaluation({
          operationId, sourceVersionId: confirmedSource.sourceVersionId, question: activitySet.questions[1], studentAnswer: writtenAnswer,
          evidenceSegments: confirmedSource.segments.filter((segment) => allowedIds.has(segment.id)).map(({ id, pageNumber, text }) => ({ id, pageNumber, text })),
        }, sessionId);
      }
      const performance = calculateConceptPerformance({ concepts: preparationMap.concepts, mcqQuestion: activitySet.questions[0], mcqGrade, writtenQuestion: activitySet.questions[1], writtenEvaluation: evaluation });
      if (!reconcileAssessmentTotal({ mcqGrade, writtenEvaluation: evaluation, performance })) throw new Error("Assessment totals did not reconcile.");
      window.localStorage.setItem(INGESTION_STORAGE_KEY, toPersistedIngestionSession({
        stage: "results", mode, sourceKind, ...(metadata === undefined ? {} : { sourceMetadata: metadata }), pages,
        priorityInstruction: priority, confirmedSource, preparationMap,
        assessmentConfiguration: { title: assessmentTitle, selectedConceptIds, difficulty }, activitySet,
        ...(selectedOptionId === "" ? {} : { selectedOptionId }), writtenAnswer, currentQuestionIndex,
        mcqGrade, writtenEvaluation: evaluation, conceptPerformance: performance, writtenOperationId: operationId, uncertainWrittenFailure: false,
      }));
      setWrittenEvaluation(evaluation); setConceptPerformance(performance); setUncertainWrittenFailure(false); setStage("results");
    } catch (caught) {
      setUncertainWrittenFailure(writtenAnswer.trim() !== ""); setError(`${errorMessage(caught)} Your answers and assessment remain saved. Review your connection before explicitly retrying grading.`);
    } finally { setLoading(undefined); setSubmittingAssessment(false); }
  }

  async function generateRevision() {
    if (
      confirmedSource === undefined || preparationMap === undefined || activitySet === undefined ||
      grade === undefined || writtenEvaluation === undefined || conceptPerformance === undefined || loading !== undefined
    ) return;
    const operationId = revisionOperationId ?? `revision-${crypto.randomUUID()}`;
    setRevisionOperationId(operationId); setLoadingKind("generation");
    setLoading(mode === "sample" ? "Opening the pre-generated grounded revision…" : "Building source-grounded notes and a focused retry…");
    setError(undefined); setUncertainRevisionFailure(false);
    try {
      const plan = mode === "sample" ? createSampleRevisionPlan({
        source: confirmedSource,
        preparationMap,
        originalActivity: activitySet,
        originalResultId: `result-${activitySet.id}`,
        performance: conceptPerformance,
        writtenEvaluation,
      }) : await requestPersonalizedRevision({
        operationId,
        sourceVersionId: confirmedSource.sourceVersionId,
        preparationMap,
        originalActivity: activitySet,
        originalResultId: `result-${activitySet.id}`,
        originalMcqGrade: grade,
        originalWrittenEvaluation: writtenEvaluation,
        conceptPerformance,
        language: confirmedSource.language,
        segments: confirmedSource.segments.map(({ id, pageNumber, text }) => ({ id, pageNumber, text })),
      }, sessionId);
      setRevisionPlan(plan); setRetrySelectedOptionId("");
      setRetryWrittenAnswer(mode === "sample" ? plan.retryActivity.questions[1].referenceAnswer : ""); setRetryCurrentQuestionIndex(0);
      setRetryGrade(undefined); setRetryWrittenEvaluation(undefined); setRetryConceptPerformance(undefined);
      setRetryWrittenOperationId(undefined); setUncertainRetryFailure(false); setImprovementComparison(undefined);
      setStage("revision");
    } catch (caught) {
      setUncertainRevisionFailure(mode === "live");
      setError(`${errorMessage(caught)} Your completed assessment result remains saved. You can explicitly retry revision generation.`);
    } finally { setLoading(undefined); }
  }

  async function submitRetry() {
    if (
      revisionPlan === undefined || confirmedSource === undefined || preparationMap === undefined ||
      grade === undefined || writtenEvaluation === undefined || conceptPerformance === undefined || submittingAssessment
    ) return;
    setConfirmingSubmission(false); setSubmittingAssessment(true); setError(undefined); setLoadingKind("generation");
    const operationId = retryWrittenOperationId ?? `retry-written-${crypto.randomUUID()}`;
    setRetryWrittenOperationId(operationId);
    const nextGrade = gradeMcq(revisionPlan.retryActivity.questions[0], retrySelectedOptionId);
    setRetryGrade(nextGrade);
    try {
      let evaluation: WrittenAnswerEvaluation;
      if (retryWrittenAnswer.trim() === "") {
        evaluation = createEmptyWrittenEvaluation({ question: revisionPlan.retryActivity.questions[1], requestId: operationId });
      } else if (mode === "sample") {
        setLoading("Applying the fixed retry rubric…");
        evaluation = createSampleRetryWrittenEvaluation(revisionPlan.retryActivity);
      } else {
        setLoading("Gemma 4 is grading the retry against the unchanged rubric rules…");
        const question = revisionPlan.retryActivity.questions[1];
        const allowedIds = new Set([
          ...question.evidence.map((reference) => reference.segmentId),
          ...question.rubric.flatMap((criterion) => criterion.evidence.map((reference) => reference.segmentId)),
        ]);
        evaluation = await requestWrittenEvaluation({
          operationId,
          sourceVersionId: confirmedSource.sourceVersionId,
          question,
          studentAnswer: retryWrittenAnswer,
          evidenceSegments: confirmedSource.segments.filter((segment) => allowedIds.has(segment.id)).map(({ id, pageNumber, text }) => ({ id, pageNumber, text })),
        }, sessionId);
      }
      const performance = calculateConceptPerformance({
        concepts: preparationMap.concepts,
        mcqQuestion: revisionPlan.retryActivity.questions[0],
        mcqGrade: nextGrade,
        writtenQuestion: revisionPlan.retryActivity.questions[1],
        writtenEvaluation: evaluation,
      });
      if (!reconcileAssessmentTotal({ mcqGrade: nextGrade, writtenEvaluation: evaluation, performance })) {
        throw new Error("Retry totals did not reconcile.");
      }
      const comparison = compareAssessmentAttempts({
        originalMcqGrade: grade,
        originalWrittenEvaluation: writtenEvaluation,
        originalPerformance: conceptPerformance,
        retryMcqGrade: nextGrade,
        retryWrittenEvaluation: evaluation,
        retryPerformance: performance,
      });
      setRetryWrittenEvaluation(evaluation); setRetryConceptPerformance(performance);
      setImprovementComparison(comparison); setUncertainRetryFailure(false); setStage("adaptive_results");
    } catch (caught) {
      setUncertainRetryFailure(retryWrittenAnswer.trim() !== "");
      setError(`${errorMessage(caught)} The revision plan, retry questions, and both entered answers remain saved. Retry grading only when you choose.`);
    } finally { setLoading(undefined); setSubmittingAssessment(false); }
  }

  function clearSession() {
    window.localStorage.removeItem(INGESTION_STORAGE_KEY); window.localStorage.removeItem(TASK04_STORAGE_KEY); window.localStorage.removeItem(TASK03_STORAGE_KEY); window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    setStage("input"); setMode("live"); setSourceKind("text"); setDraftText(""); setPages([]); setMetadata(undefined); setPriority("");
    setConfirmedSource(undefined); setPreparationMap(undefined); setActivitySet(undefined); setAssessmentTitle(""); setDifficulty("medium"); setSelectedConceptIds([]);
    setSelectedOptionId(""); setWrittenAnswer(""); setCurrentQuestionIndex(0); setGrade(undefined); setWrittenEvaluation(undefined); setConceptPerformance(undefined);
    setWrittenOperationId(undefined); setUncertainWrittenFailure(false); clearAdaptiveState(); setConfirmingSubmission(false); setSubmittingAssessment(false); setError(undefined); setRecoveryNotice(false);
  }

  function enterWorkspace() {
    workspaceRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    workspaceRef.current?.focus({ preventScroll: true });
  }

  return (
    <LazyMotion features={domAnimation}>
      <main>
        <header className="site-header">
          <a className="brand-link" href="#top" aria-label="Ankur home"><AnkurMark /></a>
          <nav aria-label="Primary navigation"><a href="#how-it-works">How it works</a><a href="#workspace">Workspace</a></nav>
          <RuntimePill state={liveStatus} />
        </header>

        <section className="hero" id="top" aria-labelledby="hero-title">
          <div className="hero__copy">
            <Badge tone="sprout"><Sparkles aria-hidden="true" size={14} />Source-grounded learning</Badge>
            <h1 id="hero-title">Turn what you read<br />into what you <em>know.</em></h1>
            <p>Bring one trusted lesson. Ankur helps you review it, see its structure, and practise with answers you can trace back to the source.</p>
            <div className="hero__actions"><Button onClick={enterWorkspace}>Start learning <ArrowDown aria-hidden="true" size={17} /></Button><Button variant="quiet" onClick={startSample}>Explore a Bengali sample</Button></div>
            <div className="hero__trust"><span><ShieldCheck aria-hidden="true" size={16} />Review before generation</span><span><FileCheck2 aria-hidden="true" size={16} />Evidence linked</span></div>
          </div>
          <HeroComposition />
        </section>

        <section className="principles" id="how-it-works" aria-label="How Ankur works">
          <article><span>01</span><div><strong>You confirm the source</strong><p>Nothing is generated until you review every included page.</p></div></article>
          <article><span>02</span><div><strong>Ankur maps the ideas</strong><p>Every concept points to an immutable page segment.</p></div></article>
          <article><span>03</span><div><strong>You practise with proof</strong><p>Answers are graded by rules, then linked to evidence.</p></div></article>
        </section>

        <section className="studio" id="workspace" ref={workspaceRef} tabIndex={-1} aria-labelledby="workspace-title">
          <header className="studio__header">
            <div><p className="eyebrow">Your learning studio</p><h2 id="workspace-title">Grow understanding, one step at a time.</h2></div>
            <div><Badge tone={mode === "sample" ? "sun" : "neutral"}>{mode === "sample" ? "Provider-free mixed sample" : "Live source workflow"}</Badge><Button size="small" variant="quiet" onClick={clearSession}>Clear session</Button></div>
          </header>
          <div className="studio__layout">
            <GrowthRail stage={stage} />
            <div className="stage-panel">
              {liveStatus === "unavailable" && mode !== "sample" ? <AlertBanner tone="warning" title="Live generation is unavailable">Pasted text review still works. Scanned-page transcription needs live mode; the complete mixed sample remains available.</AlertBanner> : null}
              {recoveryNotice ? <AlertBanner tone="info" title="Review recovered without original previews">Your edits, methods, warnings, and include choices were restored. Re-select the original source only if you need previews or a transcription retry.</AlertBanner> : null}
              <m.div key={stage} animate={{ opacity: 1, y: 0 }} initial={motionReady && !reduceMotion ? { opacity: 0, y: 10 } : false} transition={{ duration: reduceMotion ? 0 : 0.22 }}>
                {stage === "input" ? <SourceCanvas sourceKind={sourceKind} draftText={draftText} onSourceKindChange={setSourceKind} onDraftChange={setDraftText} onReviewText={reviewPastedText} onPdf={(file) => void handlePdf(file)} onImages={(files) => void handleImages(files)} onSample={startSample} onResumeReview={() => setStage("review")} hasReviewDraft={pages.length > 0} disabled={loading !== undefined} /> : null}
                {stage === "review" ? (
                  <div className="review-stage">
                    <div className="stage-heading"><span className="stage-heading__index">02</span><div><p className="eyebrow">Review every page</p><h2>Make the extraction trustworthy.</h2><p>OCR is always a draft. Correct text, resolve warnings, and choose which pages belong in the confirmed source.</p></div></div>
                    <div className="review-summary"><div><strong>{metadata?.name ?? "Current source"}</strong><span>{String(pages.length)} {pages.length === 1 ? "page" : "pages"} · {String(pages.filter((page) => page.included).length)} included</span></div><Button size="small" variant="quiet" onClick={() => setStage("input")}>Choose another source</Button></div>
                    <div className="page-review-list">
                      {pages.map((page) => <PageReviewCard key={page.id} page={page} onTextChange={(text) => { invalidateDownstream(); updatePage(page.pageNumber, (current) => ({ ...current, text, method: current.method === "gemma_ocr" ? "gemma_ocr" : "manual_text" })); }} onIncludedChange={(included) => { invalidateDownstream(); updatePage(page.pageNumber, (current) => ({ ...current, included })); }} onRetry={() => void transcribeOne(page)} />)}
                    </div>
                    <section className="priority-panel" aria-labelledby="priority-title">
                      <div><p className="eyebrow">Application-controlled guidance</p><h3 id="priority-title">What should Ankur prioritize?</h3><p>This guides emphasis after confirmation. It cannot override the source, and document text is never treated as an instruction.</p></div>
                      <Field id="priority" label="Learner priority" hint={`${String(priority.length)}/1,000 · optional and separate from source content`}><TextInput id="priority" maxLength={1_000} value={priority} onChange={(event) => { invalidateDownstream(); setPriority(event.target.value); }} /></Field>
                    </section>
                    <AlertBanner tone="info" title="Source text remains data, never instructions">Ankur will not follow commands that appear inside uploaded or pasted learning material.</AlertBanner>
                    <div className="stage-actions stage-actions--confirm"><Button variant="quiet" onClick={() => setStage("input")}>Back</Button><Button disabled={!canConfirm || loading !== undefined} onClick={confirmSource}>Confirm reviewed source</Button></div>
                  </div>
                ) : null}
                {stage === "confirmed" && confirmedSource !== undefined ? (
                  <section className="confirmed-source-state">
                    <span className="confirmed-source-state__icon"><CheckCircle2 aria-hidden="true" /></span>
                    <p className="eyebrow">Source confirmed</p><h2>Your reviewed pages are now the evidence boundary.</h2>
                    <p>{String(confirmedSource.segments.length)} immutable segments across {String(new Set(confirmedSource.segments.map((segment) => segment.pageNumber)).size)} included {pages.length === 1 ? "page" : "pages"}. Generation can begin only from these segments.</p>
                    <dl><div><dt>Version</dt><dd>{confirmedSource.sourceVersionId}</dd></div><div><dt>Language</dt><dd>{confirmedSource.language}</dd></div><div><dt>Priority</dt><dd>{confirmedSource.priorityInstruction ?? "No additional priority"}</dd></div></dl>
                    <div className="stage-actions"><Button variant="quiet" onClick={() => setStage("review")}><PencilLine aria-hidden="true" size={16} />Edit reviewed pages</Button><Button disabled={loading !== undefined || sessionId === ""} onClick={() => void buildPreparationMap()}>Build preparation map</Button></div>
                  </section>
                ) : null}
                {stage === "preparation" && preparationMap !== undefined && confirmedSource !== undefined ? <div><ConceptCanopy map={preparationMap} source={confirmedSource} /><AssessmentBuilder map={preparationMap} title={assessmentTitle} difficulty={difficulty} selectedConceptIds={selectedConceptIds} disabled={loading !== undefined} onTitleChange={(title) => updateAssessmentConfiguration(() => setAssessmentTitle(title))} onDifficultyChange={(value) => updateAssessmentConfiguration(() => setDifficulty(value))} onConceptToggle={toggleConcept} onGenerate={() => void generateAssessment()} /><div className="stage-actions"><Button variant="quiet" onClick={() => setStage("review")}>Edit source</Button></div></div> : null}
                {stage === "assessment" && activitySet !== undefined && confirmedSource !== undefined ? <><PracticeCard activitySet={activitySet} language={confirmedSource.language} currentQuestionIndex={currentQuestionIndex} selectedOptionId={selectedOptionId} writtenAnswer={writtenAnswer} submitting={submittingAssessment} confirming={confirmingSubmission} onSelect={setSelectedOptionId} onWrittenChange={setWrittenAnswer} onPrevious={() => setCurrentQuestionIndex(0)} onNext={() => setCurrentQuestionIndex(1)} onRequestSubmit={() => setConfirmingSubmission(true)} onCancelSubmit={() => setConfirmingSubmission(false)} onConfirmSubmit={() => void submitAssessment()} />{uncertainWrittenFailure ? <AlertBanner tone="warning" title="A retry may repeat the grading request">No automatic retry was made. Confirm the connection, then use Review and submit again only when you choose to retry.</AlertBanner> : null}</> : null}
                {stage === "results" && activitySet !== undefined && grade !== undefined && writtenEvaluation !== undefined && conceptPerformance !== undefined && confirmedSource !== undefined ? <><ResultSummary mcqGrade={grade} writtenEvaluation={writtenEvaluation} activitySet={activitySet} source={confirmedSource} performance={conceptPerformance} revisionPending={loading !== undefined} onRevise={() => void generateRevision()} onNewSource={clearSession} />{uncertainRevisionFailure ? <AlertBanner tone="warning" title="Revision generation may be repeated">No automatic retry was made. Your original result is intact; explicitly choose Build revision plan when you are ready.</AlertBanner> : null}</> : null}
                {stage === "revision" && revisionPlan !== undefined && preparationMap !== undefined && confirmedSource !== undefined ? <RevisionPlanView plan={revisionPlan} preparationMap={preparationMap} source={confirmedSource} onBack={() => setStage("results")} onStartRetry={() => setStage("retry")} /> : null}
                {stage === "retry" && revisionPlan !== undefined && preparationMap !== undefined && confirmedSource !== undefined ? <><PracticeCard activitySet={revisionPlan.retryActivity} language={confirmedSource.language} currentQuestionIndex={retryCurrentQuestionIndex} selectedOptionId={retrySelectedOptionId} writtenAnswer={retryWrittenAnswer} submitting={submittingAssessment} confirming={confirmingSubmission} variant="retry" targetNames={revisionPlan.targetConceptIds.map((id) => preparationMap.concepts.find((concept) => concept.id === id)?.name ?? id)} onSelect={setRetrySelectedOptionId} onWrittenChange={setRetryWrittenAnswer} onPrevious={() => setRetryCurrentQuestionIndex(0)} onNext={() => setRetryCurrentQuestionIndex(1)} onRequestSubmit={() => setConfirmingSubmission(true)} onCancelSubmit={() => setConfirmingSubmission(false)} onConfirmSubmit={() => void submitRetry()} />{uncertainRetryFailure ? <AlertBanner tone="warning" title="Retry grading may be repeated">No automatic retry was made. The original result, revision plan, and both retry answers are still saved.</AlertBanner> : null}<div className="stage-actions"><Button variant="quiet" onClick={() => setStage("revision")}>Review notes</Button></div></> : null}
                {stage === "adaptive_results" && revisionPlan !== undefined && confirmedSource !== undefined && grade !== undefined && writtenEvaluation !== undefined && retryGrade !== undefined && retryWrittenEvaluation !== undefined && retryConceptPerformance !== undefined && improvementComparison !== undefined ? <AdaptiveResultSummary plan={revisionPlan} source={confirmedSource} originalMcqGrade={grade} originalWrittenEvaluation={writtenEvaluation} retryMcqGrade={retryGrade} retryWrittenEvaluation={retryWrittenEvaluation} retryPerformance={retryConceptPerformance} comparison={improvementComparison} onReviewRevision={() => setStage("revision")} onNewSource={clearSession} /> : null}
              </m.div>
              {loading === undefined ? null : <ProcessNarrative message={loading} kind={loadingKind} />}
              {error === undefined ? null : <AlertBanner tone="danger" title="We could not complete that step" role="alert">{error} Confirmed source, review work, and entered answers remain saved.</AlertBanner>}
              <p className="privacy-note">PDFs are processed on this device. Live transcription sends one compressed page image to Google’s hosted Gemini API; analysis sends only explicitly confirmed text. Do not use confidential or examination-restricted material.</p>
            </div>
          </div>
        </section>

        <footer className="site-footer"><AnkurMark compact /><p>Learning that grows from evidence.</p><span>Grounded adaptive learning loop</span></footer>
      </main>
    </LazyMotion>
  );
}
