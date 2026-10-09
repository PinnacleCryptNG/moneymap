import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function InsightCard({ icon: Icon, title, body, meta, tone = "blue" }: { icon: LucideIcon; title: string; body: ReactNode; meta?: ReactNode; tone?: "blue" | "green" | "amber" }) {
  const tones = { blue: "bg-blue-50 text-blue", green: "bg-green-50 text-green-700", amber: "bg-amber-50 text-amber-700" };
  return (
    <article className="card flex gap-4 p-5">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] ${tones[tone]}`}><Icon size={24} aria-hidden /></span>
      <div className="min-w-0 flex-1">
        <h3 className="!text-[16px] !leading-6">{title}</h3>
        <p className="text-small text-ink-2">{body}</p>
        {meta && <div className="mt-2">{meta}</div>}
      </div>
    </article>
  );
}
