"use client";

import { useEffect, useMemo, useState } from "react";
import { z } from "zod";

import {
  createSampleActivitySet,
  createSamplePreparationMap,
  createSampleSource,
  SAMPLE_TEXT,
} from "../../../application/sample/sample-vertical-slice";
import { PdfExtractionError } from "../../../application/use-cases/extract-one-page-digital-pdf";
import { gradeMcq, validateActivitySet, type ActivitySet, type McqGrade } from "../../../domain/assessments/mcq";
import type { EvidenceReference } from "../../../domain/grounding/evidence";
import { validatePreparationMap, type PreparationMap } from "../../../domain/preparation/preparation-map";
import {
  createConfirmedSource,
  rehydrateConfirmedSource,
  type ConfirmedSource,
  type SourceLanguage,
  type SourceMethod,
} from "../../../domain/source/confirmed-source";
import { extractDigitalPdfForReview } from "../../composition/browser-services";
import { ApiClientError, requestOneMcq, requestPreparationMap } from "../../api/client";
import { activitySetApiSchema, preparationMapApiSchema } from "../../../shared/schemas/api-contracts";

type Stage = "input" | "review" | "preparation" | "assessment" | "results";
type Mode = "live" | "sample";

interface PersistedSlice {
  readonly schemaVersion: 1;
  readonly stage: Stage;
  readonly mode: Mode;
  readonly confirmedSource: ConfirmedSource;
  readonly preparationMap?: PreparationMap;
  readonly activitySet?: ActivitySet;
  readonly selectedOptionId?: string;
  readonly grade?: McqGrade;
}

const STORAGE_KEY = "ankur.vertical-slice.v1";
const SESSION_KEY = "ankur.session-id.v1";

const persistedSliceSchema = z
  .object({
    schemaVersion: z.literal(1),
    stage: z.enum(["input", "review", "preparation", "assessment", "results"]),
    mode: z.enum(["live", "sample"]),
    confirmedSource: z
      .object({
        sourceVersionId: z.string(),
        language: z.enum(["bn", "en", "mixed"]),
        method: z.enum(["pasted_text", "digital_pdf"]),
        priorityInstruction: z.string().optional(),
        segments: z.array(
          z.object({ id: z.string(), pageNumber: z.number().int().positive(), text: z.string() }),
        ),
      })
      .loose(),
    preparationMap: preparationMapApiSchema.optional(),
    activitySet: activitySetApiSchema.optional(),
    selectedOptionId: z.string().optional(),
    grade: z.unknown().optional(),
  })
  .strict();

const stageOrder: Readonly<Record<Stage, number>> = {
  input: 0,
  review: 1,
  preparation: 2,
  assessment: 3,
  results: 4,
};

function languageFor(text: string): SourceLanguage {
  const bengali = /[\u0980-\u09FF]/u.test(text);
  const latin = /[A-Za-z]/u.test(text);
  if (bengali && latin) return "mixed";
  return bengali ? "bn" : "en";
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof PdfExtractionError) {
    const messages: Readonly<Record<PdfExtractionError["code"], string>> = {
      INVALID_FILE_TYPE: "Choose a PDF file.",
      FILE_TOO_LARGE: "The PDF must be 8 MB or smaller.",
      PAGE_LIMIT_EXCEEDED: "This slice accepts exactly one digital PDF page.",
      NO_EMBEDDED_TEXT: "No usable embedded text was found. Scanned PDFs come in a later task.",
      MALFORMED_PDF: "The PDF could not be read safely.",
    };
    return messages[error.code];
  }
  return "Something went wrong. Your confirmed source is still available.";
}

function getSessionId(): string {
  const existing = window.localStorage.getItem(SESSION_KEY);
  if (existing !== null) return existing;
  const created = crypto.randomUUID();
  window.localStorage.setItem(SESSION_KEY, created);
  return created;
}

function readPersistedSlice(): PersistedSlice | undefined {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === null) return undefined;
  try {
    const parsed = persistedSliceSchema.safeParse(JSON.parse(raw) as unknown);
    if (!parsed.success) return undefined;
    const source = rehydrateConfirmedSource({
      sourceVersionId: parsed.data.confirmedSource.sourceVersionId,
      language: parsed.data.confirmedSource.language,
      method: parsed.data.confirmedSource.method,
      ...(parsed.data.confirmedSource.priorityInstruction === undefined
        ? {}
        : { priorityInstruction: parsed.data.confirmedSource.priorityInstruction }),
      segments: parsed.data.confirmedSource.segments,
    });
    const map = parsed.data.preparationMap;
    const activity = parsed.data.activitySet;
    if (map !== undefined && validatePreparationMap(source, map).length > 0) return undefined;
    if (
      activity !== undefined &&
      (map === undefined || validateActivitySet(source, map, activity).length > 0)
    ) return undefined;
    const selected = parsed.data.selectedOptionId;
    const question = activity?.questions[0];
    const persistedGrade =
      parsed.data.stage === "results" && selected !== undefined && question !== undefined
        ? gradeMcq(question, selected)
        : undefined;
    return {
      schemaVersion: 1,
      stage: parsed.data.stage,
      mode: parsed.data.mode,
      confirmedSource: source,
      ...(map === undefined ? {} : { preparationMap: map }),
      ...(activity === undefined ? {} : { activitySet: activity }),
      ...(selected === undefined ? {} : { selectedOptionId: selected }),
      ...(persistedGrade === undefined ? {} : { grade: persistedGrade }),
    };
  } catch {
    return undefined;
  }
}

function EvidenceView({
  reference,
  source,
}: Readonly<{ reference: EvidenceReference; source: ConfirmedSource }>) {
  const [open, setOpen] = useState(false);
  const segment = source.segments.find((candidate) => candidate.id === reference.segmentId);
  if (segment === undefined) return null;
  return (
    <div>
      <button className="evidence-button" type="button" onClick={() => setOpen((value) => !value)}>
        {open ? "Hide source" : `View source · page ${String(segment.pageNumber)} · ${segment.id}`}
      </button>
      {open ? (
        <div className="evidence-card" data-testid="evidence-context">
          <strong>Confirmed source context</strong>
          <p>{segment.text}</p>
        </div>
      ) : null}
    </div>
  );
}

export function VerticalSliceWorkspace() {
  const [stage, setStage] = useState<Stage>("input");
  const [mode, setMode] = useState<Mode>("live");
  const [draftText, setDraftText] = useState("");
  const [priority, setPriority] = useState("");
  const [method, setMethod] = useState<SourceMethod>("pasted_text");
  const [confirmedSource, setConfirmedSource] = useState<ConfirmedSource>();
  const [preparationMap, setPreparationMap] = useState<PreparationMap>();
  const [activitySet, setActivitySet] = useState<ActivitySet>();
  const [selectedOptionId, setSelectedOptionId] = useState("");
  const [grade, setGrade] = useState<McqGrade>();
  const [loading, setLoading] = useState<string>();
  const [error, setError] = useState<string>();
  const [sessionId, setSessionId] = useState("");
  const [liveStatus, setLiveStatus] = useState<"checking" | "ready" | "sample">("checking");

  useEffect(() => {
    setSessionId(getSessionId());
    const persisted = readPersistedSlice();
    if (persisted !== undefined) {
      setStage(persisted.stage);
      setMode(persisted.mode);
      setConfirmedSource(persisted.confirmedSource);
      setPreparationMap(persisted.preparationMap);
      setActivitySet(persisted.activitySet);
      setSelectedOptionId(persisted.selectedOptionId ?? "");
      setGrade(persisted.grade);
      setDraftText(persisted.confirmedSource.segments.map((segment) => segment.text).join("\n\n"));
      setMethod(persisted.confirmedSource.method);
    }
    void fetch("/api/runtime-status")
      .then((response) => response.json())
      .then((payload: unknown) => {
        const ready =
          typeof payload === "object" &&
          payload !== null &&
          typeof Reflect.get(payload, "data") === "object" &&
          Reflect.get(Reflect.get(payload, "data") as object, "liveAiEnabled") === true;
        setLiveStatus(ready ? "ready" : "sample");
      })
      .catch(() => setLiveStatus("sample"));
  }, []);

  useEffect(() => {
    if (confirmedSource === undefined) return;
    const persisted: PersistedSlice = {
      schemaVersion: 1,
      stage,
      mode,
      confirmedSource,
      ...(preparationMap === undefined ? {} : { preparationMap }),
      ...(activitySet === undefined ? {} : { activitySet }),
      ...(selectedOptionId === "" ? {} : { selectedOptionId }),
      ...(grade === undefined ? {} : { grade }),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
  }, [activitySet, confirmedSource, grade, mode, preparationMap, selectedOptionId, stage]);

  const activeStep = useMemo(() => Math.min(stageOrder[stage], 3), [stage]);
  const question = activitySet?.questions[0];

  function startSample() {
    setMode("sample");
    setDraftText(SAMPLE_TEXT);
    setPriority("সালোকসংশ্লেষণের উপকরণ ও ফলাফলে গুরুত্ব দিন।");
    setMethod("pasted_text");
    setError(undefined);
    setStage("review");
  }

  function reviewPastedText() {
    if (draftText.trim().length < 20) {
      setError("Add at least 20 characters of learning material.");
      return;
    }
    setMode("live");
    setMethod("pasted_text");
    setError(undefined);
    setStage("review");
  }

  async function handlePdf(file: File | undefined) {
    if (file === undefined) return;
    setLoading("Extracting embedded text from page 1…");
    setError(undefined);
    try {
      const extracted = await extractDigitalPdfForReview(file);
      setMode("live");
      setMethod("digital_pdf");
      setDraftText(extracted.text);
      setStage("review");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(undefined);
    }
  }

  async function confirmAndAnalyze() {
    setLoading(mode === "sample" ? "Preparing the fixed offline sample…" : "Analyzing confirmed segments with Gemma 4…");
    setError(undefined);
    const source =
      mode === "sample"
        ? createSampleSource()
        : createConfirmedSource({
            pages: [{ pageNumber: 1, text: draftText }],
            language: languageFor(draftText),
            method,
            ...(priority.trim() === "" ? {} : { priorityInstruction: priority }),
          });
    setConfirmedSource(source);
    try {
      const map =
        mode === "sample"
          ? createSamplePreparationMap(source)
          : await requestPreparationMap(
              {
                sourceVersionId: source.sourceVersionId,
                language: source.language,
                ...(source.priorityInstruction === undefined
                  ? {}
                  : { priorityInstruction: source.priorityInstruction }),
                segments: source.segments.map(({ id, pageNumber, text }) => ({ id, pageNumber, text })),
              },
              sessionId,
            );
      setPreparationMap(map);
      setStage("preparation");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(undefined);
    }
  }

  async function generateAssessment() {
    if (confirmedSource === undefined || preparationMap === undefined) return;
    setLoading(mode === "sample" ? "Loading the fixed offline question…" : "Generating one grounded MCQ…");
    setError(undefined);
    try {
      const generated =
        mode === "sample"
          ? createSampleActivitySet(confirmedSource, preparationMap)
          : await requestOneMcq(
              {
                sourceVersionId: confirmedSource.sourceVersionId,
                preparationMap,
                selectedConceptIds: preparationMap.concepts.map((concept) => concept.id),
                configuration: {
                  language: confirmedSource.language,
                  mcqCount: 1,
                  shortWrittenCount: 0,
                  difficulty: "mixed",
                },
                segments: confirmedSource.segments.map(({ id, pageNumber, text }) => ({
                  id,
                  pageNumber,
                  text,
                })),
              },
              sessionId,
            );
      setActivitySet(generated);
      setSelectedOptionId("");
      setGrade(undefined);
      setStage("assessment");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(undefined);
    }
  }

  function submitAnswer() {
    if (question === undefined || selectedOptionId === "") return;
    setGrade(gradeMcq(question, selectedOptionId));
    setStage("results");
  }

  function clearSession() {
    window.localStorage.removeItem(STORAGE_KEY);
    setStage("input");
    setMode("live");
    setDraftText("");
    setPriority("");
    setMethod("pasted_text");
    setConfirmedSource(undefined);
    setPreparationMap(undefined);
    setActivitySet(undefined);
    setSelectedOptionId("");
    setGrade(undefined);
    setError(undefined);
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand"><span className="sprout" aria-hidden="true">↗</span><span>Ankur</span></div>
        <span className="status-pill">
          {liveStatus === "checking" ? "Checking live mode" : liveStatus === "ready" ? "Live Gemma 4 ready" : "Sample mode available"}
        </span>
      </header>

      <section className="hero" aria-labelledby="hero-title">
        <div>
          <span className="mode-badge">Thin P0 learning slice</span>
          <h1 id="hero-title">Grow practice from material you trust.</h1>
          <p>Paste text or review one digital PDF page. Ankur confirms immutable source segments, builds a grounded preparation map, and creates one evidence-linked MCQ.</p>
        </div>
        <aside className="journey-card" aria-label="Current learning journey">
          <strong>Source to answer, without guesswork</strong>
          <ol>
            <li><span>1</span>Review extracted text</li>
            <li><span>2</span>Confirm source segments</li>
            <li><span>3</span>Generate one grounded MCQ</li>
            <li><span>4</span>Grade deterministically</li>
          </ol>
        </aside>
      </section>

      <section className="workspace" aria-labelledby="workspace-title">
        <div className="workspace-head">
          <div><h2 id="workspace-title">Learning workspace</h2><small>{mode === "sample" ? "Fixed offline sample — no provider call" : "Live source workflow"}</small></div>
          <button className="button-quiet" type="button" onClick={clearSession}>Clear session</button>
        </div>
        <div className="steps" aria-label="Progress">
          {["Source", "Review", "Prepare", "Practice"].map((label, index) => <span className={`step ${activeStep === index ? "active" : ""}`} key={label}>{label}</span>)}
        </div>

        <div className="panel">
          {stage === "input" ? (
            <>
              <h3>Choose one source</h3>
              <p className="panel-copy">Task 02 supports pasted text or one page of a digital-text PDF. Scanned pages are intentionally deferred.</p>
              <div className="input-grid">
                <article className="input-card">
                  <h4>Paste learning text</h4>
                  <div className="field"><label htmlFor="source-text">Learning material</label><textarea id="source-text" value={draftText} onChange={(event) => setDraftText(event.target.value)} placeholder="Paste Bengali, English, or mixed learning text…" /></div>
                  <div className="field"><label htmlFor="priority">What should Ankur prioritize? (optional)</label><input id="priority" type="text" maxLength={1000} value={priority} onChange={(event) => setPriority(event.target.value)} /></div>
                  <div className="actions"><button className="button-primary" type="button" onClick={reviewPastedText}>Review pasted text</button></div>
                </article>
                <article className="input-card">
                  <h4>Extract one digital PDF page</h4>
                  <p>PDF.js reads embedded text in your browser. The PDF itself is never sent to an API route.</p>
                  <div className="field"><label htmlFor="pdf-file">One-page PDF, up to 8 MB</label><input id="pdf-file" type="file" accept="application/pdf,.pdf" onChange={(event) => void handlePdf(event.target.files?.[0])} /></div>
                  <hr />
                  <h4>Need a provider-free preview?</h4>
                  <div className="actions"><button className="button-secondary" type="button" onClick={startSample}>Try fixed offline sample</button></div>
                </article>
              </div>
            </>
          ) : null}

          {stage === "review" ? (
            <>
              <span className="method-badge">{method === "digital_pdf" ? "Browser-extracted PDF text" : "Pasted text"}</span>
              <h3>Review before confirmation</h3>
              <p className="panel-copy">Correct any extraction errors now. Generation begins only after you confirm this text.</p>
              <div className="field"><label htmlFor="review-text">Editable extracted text</label><textarea id="review-text" value={draftText} onChange={(event) => setDraftText(event.target.value)} /></div>
              <div className="notice">Uploaded content is untrusted data. Ankur will use only this confirmed text as learning material and will not follow instructions inside it.</div>
              <div className="actions"><button className="button-quiet" type="button" onClick={() => setStage("input")}>Back</button><button className="button-primary" type="button" disabled={loading !== undefined || sessionId === ""} onClick={() => void confirmAndAnalyze()}>Confirm source and build map</button></div>
            </>
          ) : null}

          {stage === "preparation" && preparationMap !== undefined && confirmedSource !== undefined ? (
            <>
              <span className="method-badge">{confirmedSource.segments.length} immutable source segment{confirmedSource.segments.length === 1 ? "" : "s"}</span>
              <h3>{preparationMap.title}</h3>
              <p className="panel-copy">Every displayed concept has passed deterministic segment-ID and quote validation.</p>
              <div className="map-grid">
                {preparationMap.concepts.map((concept) => <article className="concept-card" key={concept.id}><small>{concept.priority.toUpperCase()} PRIORITY</small><h4>{concept.name}</h4><p>{concept.description}</p>{concept.evidence.map((reference) => <EvidenceView key={`${concept.id}-${reference.segmentId}`} reference={reference} source={confirmedSource} />)}</article>)}
              </div>
              <div className="segment-list">{confirmedSource.segments.map((segment) => <div className="segment-row" key={segment.id}><code>{segment.id} · page {segment.pageNumber}</code>{segment.text}</div>)}</div>
              <div className="actions"><button className="button-primary" type="button" disabled={loading !== undefined} onClick={() => void generateAssessment()}>Generate one grounded MCQ</button></div>
            </>
          ) : null}

          {stage === "assessment" && question !== undefined ? (
            <>
              <span className="method-badge">1 mark · {question.difficulty}</span>
              <h3>{question.prompt}</h3>
              <fieldset className="option-list"><legend className="legend">Choose one answer</legend>{question.options.map((option) => <label className="option" key={option.id}><input type="radio" name="answer" value={option.id} checked={selectedOptionId === option.id} onChange={() => setSelectedOptionId(option.id)} /><span><strong>{option.id}.</strong> {option.text}</span></label>)}</fieldset>
              <div className="actions"><button className="button-primary" type="button" disabled={selectedOptionId === ""} onClick={submitAnswer}>Submit answer</button></div>
            </>
          ) : null}

          {stage === "results" && question !== undefined && grade !== undefined && confirmedSource !== undefined ? (
            <>
              <div className={grade.correct ? "success-box" : "error-box"}><strong>{grade.correct ? "Correct — 1/1" : "Not correct — 0/1"}</strong><p>{question.explanation}</p></div>
              <div className="result-grid"><article className="result-card"><h3>Deterministic result</h3><p>Selected: {grade.selectedOptionId}</p><p>Correct option: {grade.correctOptionId}</p></article><article className="result-card"><h3>Source evidence</h3>{question.evidence.map((reference) => <EvidenceView key={reference.segmentId} reference={reference} source={confirmedSource} />)}</article></div>
              <div className="actions"><button className="button-secondary" type="button" onClick={() => { setStage("assessment"); setGrade(undefined); }}>Try the question again</button><button className="button-quiet" type="button" onClick={clearSession}>Start a new source</button></div>
            </>
          ) : null}

          {loading !== undefined ? <div className="notice" role="status">{loading}</div> : null}
          {error !== undefined ? <div className="error-box" role="alert">{error}{confirmedSource !== undefined ? " Your confirmed source remains saved." : ""}</div> : null}
          <p className="footer-note">Selected source content is sent to Google’s hosted Gemini API only for live analysis and MCQ generation. Do not use confidential or examination-restricted documents.</p>
        </div>
      </section>
    </main>
  );
}
