import type { ReactNode } from "react";

type Tone = "neutral" | "blue" | "green" | "amber" | "red" | "navy";
const tones: Record<Tone, string> = {
  neutral: "bg-canvas text-ink-2 border-line",
  blue: "bg-blue-50 text-blue-600 border-blue/30",
  green: "bg-green-50 text-green-700 border-green/40",
  amber: "bg-amber-50 text-amber-700 border-amber/40",
  red: "bg-red-50 text-red border-red/30",
  navy: "bg-night text-white border-night",
};

export function Badge({ tone = "neutral", children, icon }: { tone?: Tone; children: ReactNode; icon?: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-caption font-semibold ${tones[tone]}`}>
      {icon}
      {children}
    </span>
  );
}
