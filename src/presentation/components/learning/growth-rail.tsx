import {
  ChartNoAxesColumnIncreasing,
  CircleHelp,
  FileText,
  Flower2,
  GitBranch,
  ScanText,
} from "lucide-react";

export type LearningStage = "input" | "review" | "confirmed" | "preparation" | "assessment" | "results" | "revision" | "retry" | "adaptive_results";

const steps = [
  { label: "Source", icon: FileText },
  { label: "Review", icon: ScanText },
  { label: "Map", icon: GitBranch },
  { label: "Practice", icon: CircleHelp },
  { label: "Result", icon: ChartNoAxesColumnIncreasing },
  { label: "Revise", icon: Flower2 },
] as const;

const stageIndex: Readonly<Record<LearningStage, number>> = {
  input: 0,
  review: 1,
  confirmed: 1,
  preparation: 2,
  assessment: 3,
  results: 4,
  revision: 5,
  retry: 5,
  adaptive_results: 5,
};

export function GrowthRail({ stage }: Readonly<{ stage: LearningStage }>) {
  const current = stageIndex[stage];
  return (
    <nav className="growth-rail" aria-label="Learning journey" tabIndex={0}>
      <p className="growth-rail__eyebrow">Growth path</p>
      <ol>
        {steps.map(({ label, icon: Icon }, index) => {
          const state = index < current ? "complete" : index === current ? "active" : "upcoming";
          return (
            <li className={`growth-rail__step growth-rail__step--${state}`} key={label}>
              <span className="growth-rail__node" aria-hidden="true"><Icon size={17} strokeWidth={1.8} /></span>
              <span>
                <strong aria-current={state === "active" ? "step" : undefined}>{label}</strong>
                <small>{state === "complete" ? "Complete" : state === "active" ? "In progress" : "Up next"}</small>
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
