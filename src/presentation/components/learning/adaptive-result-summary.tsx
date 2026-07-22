"use client";

import { ArrowLeft, CheckCircle2, Flower2, RefreshCcw, ShieldCheck, Sparkles, TrendingDown, TrendingUp } from "lucide-react";

import type { ConceptPerformance } from "../../../domain/assessments/concept-performance";
import type { McqGrade } from "../../../domain/assessments/mcq";
import type { WrittenAnswerEvaluation } from "../../../domain/assessments/written-evaluation";
import type { ImprovementComparison } from "../../../domain/revision/improvement-comparison";
import type { RevisionPlan } from "../../../domain/revision/revision-plan";
import type { ConfirmedSource } from "../../../domain/source/confirmed-source";
import { AlertBanner, Badge, Button } from "../ui/primitives";
import { EvidenceDrawer } from "./evidence";

function marks(value: number): string { return Number.isInteger(value) ? String(value) : value.toFixed(1); }

export function AdaptiveResultSummary({ plan, source, originalMcqGrade, originalWrittenEvaluation, retryMcqGrade, retryWrittenEvaluation, retryPerformance, comparison, onReviewRevision, onNewSource }: Readonly<{
  plan: RevisionPlan;
  source: ConfirmedSource;
  originalMcqGrade: McqGrade;
  originalWrittenEvaluation: WrittenAnswerEvaluation;
  retryMcqGrade: McqGrade;
  retryWrittenEvaluation: WrittenAnswerEvaluation;
  retryPerformance: readonly ConceptPerformance[];
  comparison: ImprovementComparison;
  onReviewRevision: () => void;
  onNewSource: () => void;
}>) {
  const improved = comparison.absoluteChange > 0;
  return <div className="adaptive-result" data-testid="adaptive-result">
    <div className="stage-heading"><span className="stage-heading__index">07</span><div><p className="eyebrow">Adaptive loop complete</p><h2>{improved ? "Retry performance improved." : comparison.absoluteChange === 0 ? "Retry performance held steady." : "The retry exposed more to review."}</h2><p>This is one short comparison—not a claim of durable learning. Scores and concept categories were calculated deterministically.</p></div></div>
    <section className={`comparison-hero ${improved ? "comparison-hero--improved" : ""}`}>
      <div><span>Original</span><strong>{marks(comparison.originalScore)}<small>/6</small></strong><p>MCQ {originalMcqGrade.earnedMarks}/1 · Written {marks(originalWrittenEvaluation.awardedMarks)}/5</p></div>
      <div className="comparison-hero__change">{improved ? <TrendingUp aria-hidden="true" /> : <TrendingDown aria-hidden="true" />}<strong>{comparison.absoluteChange > 0 ? "+" : ""}{marks(comparison.absoluteChange)}</strong><span>{comparison.percentagePointChange > 0 ? "+" : ""}{marks(comparison.percentagePointChange)} percentage points</span></div>
      <div><span>Retry</span><strong>{marks(comparison.retryScore)}<small>/6</small></strong><p>MCQ {retryMcqGrade.earnedMarks}/1 · Written {marks(retryWrittenEvaluation.awardedMarks)}/5</p></div>
    </section>
    <AlertBanner tone="info" title="Written grading remains an AI estimate">Both written attempts use the same validated criterion-level grading path. This is not an official academic grade.</AlertBanner>
    <section className="comparison-concepts" aria-labelledby="comparison-concepts-title"><header><span><Flower2 aria-hidden="true" /></span><div><p className="eyebrow">Concept comparison</p><h3 id="comparison-concepts-title">What changed in this retry</h3></div></header><div>{comparison.concepts.map((item) => <article key={item.conceptId}><div><strong lang={source.language === "bn" ? "bn" : undefined}>{item.name}</strong><Badge tone={item.change === "improved" ? "sprout" : item.change === "regressed" ? "sun" : "neutral"}>{item.change}</Badge></div><div className="concept-score-line"><span style={{ width: `${String(item.originalPercentage)}%` }} /><i style={{ width: `${String(item.retryPercentage)}%` }} /></div><p>{item.originalPercentage}% → {item.retryPercentage}% · {item.mastered ? "mastered on retry" : "still needs review"}</p></article>)}</div></section>
    <section className="retry-review" aria-labelledby="retry-review-title"><header><span><CheckCircle2 aria-hidden="true" /></span><div><p className="eyebrow">Retry review</p><h3 id="retry-review-title">Answers, criteria, and evidence</h3></div></header><div className="retry-review__grid"><article><Badge tone={retryMcqGrade.correct ? "sprout" : "sun"}>MCQ · {retryMcqGrade.earnedMarks}/1</Badge><h4>{retryMcqGrade.correct ? "Correct" : "Review the answer"}</h4><p lang={source.language === "bn" ? "bn" : undefined}>{plan.retryActivity.questions[0].explanation}</p>{plan.retryActivity.questions[0].evidence.map((reference) => <EvidenceDrawer key={reference.segmentId} reference={reference} source={source} />)}</article><article><Badge tone="indigo">Written · {marks(retryWrittenEvaluation.awardedMarks)}/5</Badge><h4>{retryWrittenEvaluation.status.replaceAll("_", " ")}</h4><p lang={source.language === "bn" ? "bn" : undefined}>{retryWrittenEvaluation.feedback}</p>{retryWrittenEvaluation.evidence.map((reference) => <EvidenceDrawer key={reference.segmentId} reference={reference} source={source} />)}</article></div></section>
    <section className="next-recommendation"><ShieldCheck aria-hidden="true" /><div><p className="eyebrow">Careful next step</p><h3>{comparison.remainingUrgentConceptIds.length === 0 ? "Keep the evidence connection" : "One urgent edge remains"}</h3><p>{comparison.recommendation}</p><small>{String(retryPerformance.length)} retry concept {retryPerformance.length === 1 ? "result" : "results"} reconciled with the 6-mark total.</small></div></section>
    <div className="stage-actions"><Button variant="quiet" onClick={onReviewRevision}><ArrowLeft aria-hidden="true" size={16} />Review revision notes</Button><Button onClick={onNewSource}><RefreshCcw aria-hidden="true" size={16} />Start a new source</Button></div>
    <p className="adaptive-complete"><Sparkles aria-hidden="true" />Confirmed source → diagnosis → revision → retry → comparison</p>
  </div>;
}
