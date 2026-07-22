import { Check, CircleDashed } from "lucide-react";

import { SkeletonLines } from "../ui/primitives";

const generationSteps = ["Reading confirmed source", "Mapping concepts", "Validating evidence", "Preparing practice"] as const;
const ingestionSteps = ["Reading page structure", "Routing this page", "Preparing a legible image", "Saving the editable draft"] as const;

function activeIndex(message: string): number {
  if (/extract|read/i.test(message)) return 0;
  if (/analy|map/i.test(message)) return 1;
  if (/validat/i.test(message)) return 2;
  return 3;
}

export function ProcessNarrative({ message, kind = "generation" }: Readonly<{ message: string; kind?: "generation" | "ingestion" }>) {
  const active = activeIndex(message);
  const steps = kind === "ingestion" ? ingestionSteps : generationSteps;
  const longLiveOperation = kind === "generation" && !/fixed|offline|sample/iu.test(message);
  return (
    <section className="process-narrative" role="status" aria-live="polite">
      <div>
        <span className="process-narrative__kicker"><CircleDashed aria-hidden="true" size={16} />Ankur is working</span>
        <strong>{message}</strong>
        {longLiveOperation ? <p className="process-narrative__wait">Live Gemma operations often take around a minute and may take up to two. Keep this tab open; your confirmed source and answers are already saved.</p> : null}
        <SkeletonLines />
      </div>
      <ol aria-label={kind === "ingestion" ? "Page processing progress" : "Generation progress"}>
        {steps.map((step, index) => (
          <li className={kind === "ingestion" ? index < active ? "is-complete" : index === active ? "is-active" : undefined : undefined} key={step}>
            <span aria-hidden="true">{kind === "ingestion" && index < active ? <Check size={13} /> : index + 1}</span>{step}
          </li>
        ))}
      </ol>
    </section>
  );
}
