"use client";

import { ArrowLeft, ArrowRight, BookOpenCheck, Brain, Flower2, Lightbulb, ShieldCheck } from "lucide-react";

import type { PreparationMap } from "../../../domain/preparation/preparation-map";
import type { RevisionPlan } from "../../../domain/revision/revision-plan";
import type { ConfirmedSource } from "../../../domain/source/confirmed-source";
import { AlertBanner, Badge, Button } from "../ui/primitives";
import { EvidenceDrawer } from "./evidence";

const modeLabels = {
  weak_area: "Weak-Area Retry",
  reinforcement: "Reinforcement Retry",
  challenge: "Challenge Retry",
} as const;

export function RevisionPlanView({ plan, preparationMap, source, onBack, onStartRetry }: Readonly<{
  plan: RevisionPlan;
  preparationMap: PreparationMap;
  source: ConfirmedSource;
  onBack: () => void;
  onStartRetry: () => void;
}>) {
  const targetConcepts = plan.targetConceptIds.map((id) => preparationMap.concepts.find((concept) => concept.id === id)).filter((concept) => concept !== undefined);
  return <div className="revision-stage" data-testid="revision-plan">
    <div className="stage-heading"><span className="stage-heading__index">06</span><div><p className="eyebrow">Revision in bloom</p><h2>{plan.retryMode === "challenge" ? "Everything assessed is mastered—stretch one step further." : "Review only what this result actually supports."}</h2><p>Your original result is unchanged. Every factual note below is constructed from a confirmed concept and its immutable evidence window.</p></div></div>
    <div className="revision-hero">
      <span className="revision-hero__mark" aria-hidden="true"><Flower2 /></span>
      <div><Badge tone={plan.retryMode === "challenge" ? "sun" : "sprout"}>{modeLabels[plan.retryMode]}</Badge><h3>{targetConcepts.length} focused {targetConcepts.length === 1 ? "concept" : "concepts"}</h3><p>{plan.retryMode === "challenge" ? "No weakness was invented. This optional retry challenges the lowest-performing mastered concept." : "Targets were selected deterministically from the completed result, not chosen by the model."}</p></div>
      <div className="revision-target-list">{targetConcepts.map((concept) => <span key={concept.id} lang={source.language === "bn" ? "bn" : undefined}>{concept.name}</span>)}</div>
    </div>
    <AlertBanner tone="info" title="Memory aids are not evidence">Mnemonic cues are labelled separately. Use the cited confirmed excerpt—not the cue—as the factual authority.</AlertBanner>
    <div className="revision-items">
      {plan.items.map((item, index) => {
        const concept = preparationMap.concepts.find((candidate) => candidate.id === item.conceptId);
        return <article className="revision-note" key={item.id}>
          <header><span>{String(index + 1).padStart(2, "0")}</span><div><p className="eyebrow">Focused revision</p><h3 lang={source.language === "bn" ? "bn" : undefined}>{concept?.name ?? item.conceptId}</h3></div><Badge tone="neutral">{concept?.priority ?? "source"}</Badge></header>
          <div className="revision-note__grid">
            <section><span><Brain aria-hidden="true" />What the result showed</span><p lang={source.language === "bn" ? "bn" : undefined}>{item.learnerIssueSummary}</p></section>
            <section><span><BookOpenCheck aria-hidden="true" />Correct source-backed concept</span><p lang={source.language === "bn" ? "bn" : undefined}>{item.correctedConcept}</p></section>
            <section><span><ShieldCheck aria-hidden="true" />Important fact</span><p lang={source.language === "bn" ? "bn" : undefined}>{item.importantFact}</p></section>
            <section className="revision-note__memory"><span><Lightbulb aria-hidden="true" />Memory aid</span><p lang={source.language === "bn" ? "bn" : undefined}>{item.memoryAid.replace("Memory aid (not evidence): ", "")}</p><small>Not evidence—check the cited source below.</small></section>
          </div>
          <div className="answer-outline"><strong>Model-answer outline</strong><p lang={source.language === "bn" ? "bn" : undefined}>{item.modelAnswerOutline.replace("Use this source-backed point: ", "")}</p></div>
          <div className="revision-evidence">{item.evidence.map((reference) => <EvidenceDrawer key={reference.segmentId} reference={reference} source={source} />)}</div>
        </article>;
      })}
    </div>
    <div className="stage-actions"><Button variant="quiet" onClick={onBack}><ArrowLeft aria-hidden="true" size={16} />Back to original result</Button><Button onClick={onStartRetry}>Start {modeLabels[plan.retryMode]} <ArrowRight aria-hidden="true" size={16} /></Button></div>
  </div>;
}
