import { CircleDashed, ShieldCheck, Sparkles, WifiOff } from "lucide-react";

export type RuntimeState = "checking" | "ready" | "sample" | "unavailable";

const content = {
  checking: { label: "Checking live mode", icon: CircleDashed },
  ready: { label: "Gemma 4 ready", icon: ShieldCheck },
  sample: { label: "Sample mode", icon: Sparkles },
  unavailable: { label: "Live mode unavailable", icon: WifiOff },
} as const;

export function RuntimePill({ state }: Readonly<{ state: RuntimeState }>) {
  const { label, icon: Icon } = content[state];
  return (
    <span className={`runtime-pill runtime-pill--${state}`} role="status">
      <Icon aria-hidden="true" size={15} strokeWidth={1.9} />
      {label}
    </span>
  );
}
