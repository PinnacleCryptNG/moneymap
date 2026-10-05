import type { ReactNode } from "react";

type Tone = "neutral" | "blue" | "green" | "amber" | "red" | "navy";
const tones: Record<Tone, string> = {
  neutral: "bg-cloud text-navy-700 border-mist",
  blue: "bg-blue-50 text-blue-600 border-[#cfe0ff]",
  green: "bg-green-50 text-green-700 border-[#c5ecdc]",
  amber: "bg-amber-50 text-amber-700 border-[#fbe2b6]",
  red: "bg-red-50 text-red border-[#f4cccc]",
  navy: "bg-navy text-white border-navy",
};

export function Badge({ tone = "neutral", children, icon }: { tone?: Tone; children: ReactNode; icon?: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-caption ${tones[tone]}`}>
      {icon}
      {children}
    </span>
  );
}
