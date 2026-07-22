import {
  ChartNoAxesColumnIncreasing,
  CircleHelp,
  FileText,
  Flower2,
  GitBranch,
  ScanText,
} from "lucide-react";

export type LearningStage = "input" | "review" | "confirmed" | "preparation" | "assessment" | "results";

const steps = [
  { label: "Source", icon: FileText, blocked: false },
  { label: "Review", icon: ScanText, blocked: false },
  { label: "Map", icon: GitBranch, blocked: false },
  { label: "Practice", icon: CircleHelp, blocked: false },
  { label: "Result", icon: ChartNoAxesColumnIncreasing, blocked: false },
  { label: "Revise", icon: Flower2, blocked: true },
] as const;

const stageIndex: Readonly<Record<LearningStage, number>> = {
  input: 0,
  review: 1,
  confirmed: 1,
  preparation: 2,
  assessment: 3,
  results: 4,
};

export function GrowthRail({ stage }: Readonly<{ stage: LearningStage }>) {
  const current = stageIndex[stage];
  return (
    <nav className="growth-rail" aria-label="Learning journey" tabIndex={0}>
      <p className="growth-rail__eyebrow">Growth path</p>
      <ol>
        {steps.map(({ label, icon: Icon, blocked }, index) => {
          const state = blocked ? "blocked" : index < current ? "complete" : index === current ? "active" : "upcoming";
          return (
            <li className={`growth-rail__step growth-rail__step--${state}`} key={label}>
              <span className="growth-rail__node" aria-hidden="true"><Icon size={17} strokeWidth={1.8} /></span>
              <span>
                <strong aria-current={state === "active" ? "step" : undefined}>{label}</strong>
                <small>{blocked ? "Later" : state === "complete" ? "Complete" : state === "active" ? "In progress" : "Up next"}</small>
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
