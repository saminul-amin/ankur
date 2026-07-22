"use client";

import { Check, RefreshCcw, Sprout, X } from "lucide-react";
import { LazyMotion, domAnimation, m, useReducedMotion } from "motion/react";

import type { McqGrade, SingleMcqQuestion } from "../../../domain/assessments/mcq";
import type { ConfirmedSource } from "../../../domain/source/confirmed-source";
import { Button } from "../ui/primitives";
import { EvidenceDrawer } from "./evidence";

export function ResultSummary({
  grade,
  question,
  source,
  onRetry,
  onNewSource,
}: Readonly<{
  grade: McqGrade;
  question: SingleMcqQuestion;
  source: ConfirmedSource;
  onRetry: () => void;
  onNewSource: () => void;
}>) {
  const reduceMotion = useReducedMotion();
  return (
    <LazyMotion features={domAnimation}>
      <div className="result-stage">
        <div className="stage-heading">
          <span className="stage-heading__index">05</span>
          <div><p className="eyebrow">Growth check</p><h2>Your grounded result</h2><p>Grading is deterministic; Gemma does not decide whether your answer is correct.</p></div>
        </div>
        <m.section
          animate={{ opacity: 1, y: 0 }}
          className={`result-pulse result-pulse--${grade.correct ? "correct" : "incorrect"}`}
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
        >
          <div className="result-pulse__rings" aria-hidden="true"><i /><i /><span>{grade.correct ? <Check /> : <X />}</span></div>
          <div><p>{grade.correct ? "A new leaf unlocked" : "A useful point to revisit"}</p><strong>{grade.correct ? "Correct — 1/1" : "Not correct — 0/1"}</strong></div>
        </m.section>
        <div className="result-grid">
          <article className="result-detail">
            <span className="result-detail__icon"><Sprout aria-hidden="true" size={20} /></span>
            <div><h3>Why this answer?</h3><p lang={source.language === "bn" ? "bn" : undefined}>{question.explanation}</p><dl><div><dt>Your answer</dt><dd>{grade.selectedOptionId}</dd></div><div><dt>Correct answer</dt><dd>{grade.correctOptionId}</dd></div></dl></div>
          </article>
          <article className="result-detail">
            <span className="result-detail__icon"><RefreshCcw aria-hidden="true" size={20} /></span>
            <div><h3>Trace it to the source</h3><p>Open the confirmed passage that supports this question.</p>{question.evidence.map((reference) => <EvidenceDrawer key={reference.segmentId} reference={reference} source={source} />)}</div>
          </article>
        </div>
        <div className="stage-actions"><Button variant="secondary" onClick={onRetry}>Try the question again</Button><Button variant="quiet" onClick={onNewSource}>Start a new source</Button></div>
      </div>
    </LazyMotion>
  );
}
