"use client";

import { AlertTriangle, Brain, Check, Flower2, ListChecks, Sparkles, Sprout } from "lucide-react";
import { LazyMotion, domAnimation, m, useReducedMotion } from "motion/react";

import { weakConcepts, type ConceptPerformance } from "../../../domain/assessments/concept-performance";
import type { ActivitySet, McqGrade } from "../../../domain/assessments/mcq";
import type { WrittenAnswerEvaluation } from "../../../domain/assessments/written-evaluation";
import type { ConfirmedSource } from "../../../domain/source/confirmed-source";
import { AlertBanner, Badge, Button } from "../ui/primitives";
import { EvidenceDrawer } from "./evidence";

function formatMarks(value: number): string { return Number.isInteger(value) ? String(value) : value.toFixed(1); }

export function ResultSummary({ mcqGrade, writtenEvaluation, activitySet, source, performance, onNewSource }: Readonly<{
  mcqGrade: McqGrade;
  writtenEvaluation: WrittenAnswerEvaluation;
  activitySet: ActivitySet;
  source: ConfirmedSource;
  performance: readonly ConceptPerformance[];
  onNewSource: () => void;
}>) {
  const reduceMotion = useReducedMotion();
  const mcq = activitySet.questions[0];
  const written = activitySet.questions[1];
  const total = mcqGrade.earnedMarks + writtenEvaluation.awardedMarks;
  const weak = weakConcepts(performance);
  return <LazyMotion features={domAnimation}><div className="result-stage">
    <div className="stage-heading"><span className="stage-heading__index">05</span><div><p className="eyebrow">Growth check</p><h2>Your mixed assessment result</h2><p>Objective marks come from code; written marks are a validated Gemma 4 estimate against the confirmed rubric.</p></div></div>
    <m.section animate={{ opacity: 1, y: 0 }} className="result-pulse result-pulse--mixed" initial={reduceMotion ? false : { opacity: 0, y: 12 }}>
      <div className="result-pulse__rings" aria-hidden="true"><i /><i /><span><Check /></span></div><div><p>Assessment complete</p><strong>{formatMarks(total)} / 6</strong><small>{weak.length === 0 ? "Every assessed concept is growing strongly." : `${String(weak.length)} concept${weak.length === 1 ? "" : "s"} ready for focused review.`}</small></div>
    </m.section>
    <AlertBanner tone="info" title="Written grading is an AI estimate">It is grounded in your confirmed source and fixed rubric, but it is not an official academic grade.</AlertBanner>
    <div className="mixed-result-grid">
      <article className="question-result"><header><Badge tone={mcqGrade.correct ? "sprout" : "sun"}>MCQ · {mcqGrade.earnedMarks}/1</Badge><h3>{mcqGrade.status === "unanswered" ? "Not answered" : mcqGrade.correct ? "Correct" : "Not correct"}</h3></header><p lang={source.language === "bn" ? "bn" : undefined}>{mcq.explanation}</p><dl><div><dt>Your answer</dt><dd>{mcqGrade.selectedOptionId ?? "—"}</dd></div><div><dt>Correct answer</dt><dd>{mcqGrade.correctOptionId}</dd></div></dl>{mcq.evidence.map((reference) => <EvidenceDrawer key={reference.segmentId} reference={reference} source={source} />)}</article>
      <article className="question-result"><header><Badge tone="indigo">Written · {formatMarks(writtenEvaluation.awardedMarks)}/5</Badge><h3>{writtenEvaluation.status.replaceAll("_", " ")}</h3></header><p lang={source.language === "bn" ? "bn" : undefined}>{writtenEvaluation.feedback}</p><div className="concept-tags"><span>Covered</span>{writtenEvaluation.coveredConceptIds.map((id) => <code key={id}>{id.replace("concept-photosynthesis-", "")}</code>)}</div><div className="concept-tags concept-tags--missing"><span>Missing</span>{writtenEvaluation.missingConceptIds.map((id) => <code key={id}>{id.replace("concept-photosynthesis-", "")}</code>)}</div>{writtenEvaluation.evidence.map((reference) => <EvidenceDrawer key={reference.segmentId} reference={reference} source={source} />)}</article>
    </div>
    <section className="rubric-breakdown" aria-labelledby="rubric-title"><header><span><ListChecks aria-hidden="true" /></span><div><p className="eyebrow">Criterion reconciliation</p><h3 id="rubric-title">How the written mark was built</h3></div><strong>{formatMarks(writtenEvaluation.awardedMarks)} / 5</strong></header><div>{written.rubric.map((criterion) => { const result = writtenEvaluation.criterionResults.find((item) => item.criterionId === criterion.id); return <article key={criterion.id}><span className={`criterion-state criterion-state--${result?.state ?? "not_met"}`}><Check aria-hidden="true" size={14} /></span><div><strong>{criterion.description}</strong><p>{result?.reason}</p><code>{criterion.id}</code></div><b>{formatMarks(result?.awardedMarks ?? 0)} / {criterion.maximumMarks}</b></article>; })}</div></section>
    {writtenEvaluation.incorrectClaims.length === 0 && writtenEvaluation.unsupportedClaims.length === 0 ? null : <AlertBanner tone="warning" title="Claims to revisit"><ul>{[...writtenEvaluation.incorrectClaims, ...writtenEvaluation.unsupportedClaims].map((claim) => <li key={claim}>{claim}</li>)}</ul></AlertBanner>}
    <section className="concept-performance" aria-labelledby="performance-title"><header><span><Brain aria-hidden="true" /></span><div><p className="eyebrow">Deterministic diagnosis</p><h3 id="performance-title">Concept performance</h3></div></header><div>{performance.map((item) => <article key={item.conceptId}><div className="performance-ring" style={{ "--score": `${String(item.percentage)}%` } as React.CSSProperties}><strong>{item.percentage}%</strong></div><div><h4 lang={source.language === "bn" ? "bn" : undefined}>{item.name}</h4><p>{item.strength.replaceAll("_", " ")} · {item.priority} priority</p><small>Objective {formatMarks(item.objective.earnedMarks)}/{formatMarks(item.objective.availableMarks)} · Written {formatMarks(item.written.earnedMarks)}/{formatMarks(item.written.availableMarks)}</small></div></article>)}</div></section>
    <section className="weak-concepts" aria-labelledby="weak-title"><header><span><Sprout aria-hidden="true" /></span><div><p className="eyebrow">Next growth edge</p><h3 id="weak-title">Weak concepts, ordered by urgency</h3></div></header>{weak.length === 0 ? <p>No weak concept was identified in this two-question check.</p> : <ol>{weak.map((item) => <li key={item.conceptId}><AlertTriangle aria-hidden="true" size={18} /><div><strong lang={source.language === "bn" ? "bn" : undefined}>{item.name}</strong><span>{item.strength.replaceAll("_", " ")} · {item.percentage}% · {item.priority} priority</span></div></li>)}</ol>}<div className="revision-coming"><Flower2 aria-hidden="true" /><div><strong>Revision coming next</strong><p>Task 04 identifies where to focus. It does not generate revision notes or retry questions yet.</p></div><Badge tone="neutral">Task 05</Badge></div></section>
    <div className="stage-actions"><Button onClick={onNewSource}><Sparkles aria-hidden="true" size={16} />Start a new source</Button></div>
  </div></LazyMotion>;
}
