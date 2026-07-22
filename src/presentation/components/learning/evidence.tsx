"use client";

import { AnimatePresence, LazyMotion, domAnimation, m, useReducedMotion } from "motion/react";
import { BookOpenText, ChevronDown } from "lucide-react";
import { useId, useState } from "react";

import type { EvidenceReference } from "../../../domain/grounding/evidence";
import type { ConfirmedSource } from "../../../domain/source/confirmed-source";

export function EvidenceChip({ segmentId, pageNumber }: Readonly<{ segmentId: string; pageNumber: number }>) {
  return <span className="evidence-chip"><BookOpenText aria-hidden="true" size={14} />Page {pageNumber} · {segmentId}</span>;
}

export function EvidenceDrawer({ reference, source }: Readonly<{ reference: EvidenceReference; source: ConfirmedSource }>) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const reduceMotion = useReducedMotion();
  const segment = source.segments.find((candidate) => candidate.id === reference.segmentId);
  if (segment === undefined) return null;

  return (
    <LazyMotion features={domAnimation}>
      <div className="evidence-disclosure">
        <button
          aria-controls={id}
          aria-expanded={open}
          className="evidence-disclosure__button"
          onClick={() => setOpen((value) => !value)}
          type="button"
        >
          <EvidenceChip pageNumber={segment.pageNumber} segmentId={segment.id} />
          <span>{open ? "Hide source" : "View source"}</span>
          <ChevronDown aria-hidden="true" className={open ? "is-open" : undefined} size={16} />
        </button>
        <AnimatePresence initial={false}>
          {open ? (
            <m.div
              animate={{ height: "auto", opacity: 1 }}
              className="evidence-disclosure__body"
              data-testid="evidence-context"
              exit={{ height: 0, opacity: 0 }}
              id={id}
              initial={reduceMotion ? false : { height: 0, opacity: 0 }}
              role="region"
            >
              <strong>Confirmed source context</strong>
              <p lang={source.language === "bn" ? "bn" : undefined}>{segment.text}</p>
              {reference.quote === undefined ? null : <blockquote lang={source.language === "bn" ? "bn" : undefined}>“{reference.quote}”</blockquote>}
            </m.div>
          ) : null}
        </AnimatePresence>
      </div>
    </LazyMotion>
  );
}
