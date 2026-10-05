import { Flag, Footprints, MapPin } from "lucide-react";

interface Props {
  now: string;
  next: string | null;
  goal: string;
  progress?: number;
  compact?: boolean;
}

/**
 * The MoneyMap visual: YOU ARE HERE → NEXT STEP → YOUR GOAL.
 * A metaphor for financial direction, not a literal map (spec §56).
 * The route animates from current position → recommendation → goal (spec §77).
 */
export function MapJourney({ now, next, goal, progress = 0, compact = false }: Props) {
  const h = compact ? 180 : 260;
  const route = `M 60 ${h - 36} C 140 ${h - 36}, 150 ${h / 2 + 10}, 230 ${h / 2} S 330 40, 420 36`;
  return (
    <figure className="relative mx-auto w-full max-w-3xl" aria-label={`Your route: you are here — ${now}; ${next ? `next step — ${next}; ` : ""}goal — ${goal}.`}>
      <svg viewBox={`0 0 480 ${h}`} className="w-full" role="img" aria-hidden="true">
        <defs>
          <pattern id="mm-grid" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#E4EAF1" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="480" height={h} fill="url(#mm-grid)" rx="16" opacity="0.7" />
        <path d={route} fill="none" stroke="#E4EAF1" strokeWidth="10" strokeLinecap="round" />
        <path d={route} fill="none" stroke="#1677FF" strokeWidth="4" strokeLinecap="round" className="route-draw" style={{ ["--len" as string]: 520 }} />
        <circle cx="60" cy={h - 36} r="12" fill="#FFFFFF" stroke="#1677FF" strokeWidth="4" />
        {next && <circle cx="230" cy={h / 2} r="11" fill="#FFFFFF" stroke="#0B1F33" strokeWidth="4" className="fade-up" style={{ animationDelay: "300ms" }} />}
        <circle cx="420" cy="36" r="13" fill="#18A874" className="fade-up" style={{ animationDelay: "500ms" }} />
        <circle cx="420" cy="36" r="5" fill="#FFFFFF" />
      </svg>
      <div className="pointer-events-none absolute inset-0 text-small">
        <Label style={{ left: "4%", bottom: compact ? "2%" : "4%" }} icon={<MapPin size={14} aria-hidden />} title="You are here" body={now} />
        {next && <Label style={{ left: "38%", top: compact ? "8%" : "14%" }} icon={<Footprints size={14} aria-hidden />} title="Next step" body={next} />}
        <Label
          style={{ right: "2%", top: compact ? "30%" : "24%" }}
          align="right"
          icon={<Flag size={14} aria-hidden />}
          title={`Your goal${progress ? ` · ${Math.round(progress)}%` : ""}`}
          body={goal}
          tone="green"
        />
      </div>
    </figure>
  );
}

function Label({ style, title, body, icon, align = "left", tone = "navy" }: { style: React.CSSProperties; title: string; body: string; icon: React.ReactNode; align?: "left" | "right"; tone?: "navy" | "green" }) {
  return (
    <div className={`absolute max-w-[42%] rounded-[10px] border border-mist bg-white/95 px-2.5 py-1.5 shadow-sm ${align === "right" ? "text-right" : ""}`} style={style}>
      <p className={`flex items-center gap-1 text-caption uppercase tracking-wide ${align === "right" ? "justify-end" : ""} ${tone === "green" ? "text-green-700" : "text-navy-500"}`}>
        {icon}
        {title}
      </p>
      <p className="truncate font-semibold text-navy">{body}</p>
    </div>
  );
}
