import { BookMarked, CheckCircle2, Layers3 } from "lucide-react";

import type { PreparationMap } from "../../../domain/preparation/preparation-map";
import type { ConfirmedSource } from "../../../domain/source/confirmed-source";
import { Badge } from "../ui/primitives";
import { EvidenceDrawer } from "./evidence";

export function ConceptCanopy({ map, source }: Readonly<{ map: PreparationMap; source: ConfirmedSource }>) {
  return (
    <div className="concept-canopy">
      <div className="stage-heading">
        <span className="stage-heading__index">03</span>
        <div><p className="eyebrow">Knowledge canopy</p><h2>{map.title}</h2><p>Concepts are connected only to evidence that passed deterministic source validation.</p></div>
      </div>
      <div className="canopy-meta">
        <span><Layers3 aria-hidden="true" size={17} />{map.concepts.length} concepts</span>
        <span><BookMarked aria-hidden="true" size={17} />{source.segments.length} immutable segment{source.segments.length === 1 ? "" : "s"}</span>
        <span><CheckCircle2 aria-hidden="true" size={17} />Grounding verified</span>
      </div>
      <div className="canopy-grid">
        {map.concepts.map((concept, index) => (
          <article className="concept-node" key={concept.id}>
            <div className="concept-node__top"><span>{String(index + 1).padStart(2, "0")}</span><Badge tone={concept.priority === "high" ? "sun" : concept.priority === "medium" ? "sprout" : "neutral"}>{concept.priority} priority</Badge></div>
            <h3 lang={map.language === "bn" ? "bn" : undefined}>{concept.name}</h3>
            <p lang={map.language === "bn" ? "bn" : undefined}>{concept.description}</p>
            <div className="concept-node__evidence">
              {concept.evidence.map((reference) => <EvidenceDrawer key={`${concept.id}-${reference.segmentId}`} reference={reference} source={source} />)}
            </div>
          </article>
        ))}
      </div>
      <details className="source-ledger">
        <summary>Inspect confirmed source ledger</summary>
        <div>
          {source.segments.map((segment) => (
            <article key={segment.id}>
              <code>{segment.id} · page {segment.pageNumber}</code>
              <p lang={source.language === "bn" ? "bn" : undefined}>{segment.text}</p>
            </article>
          ))}
        </div>
      </details>
    </div>
  );
}
