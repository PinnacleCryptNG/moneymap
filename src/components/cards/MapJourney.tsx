import { Flag, Footprints, MapPin } from "lucide-react";
import type { ReactNode } from "react";

interface Props {
  now: string;
  next: string | null;
  goal: string;
  progress?: number;
  compact?: boolean;
}

/**
 * The MoneyMap visual: YOU ARE HERE → NEXT MOVE → YOUR GOAL, on a midnight card.
 * A row of three stops on wide screens, a vertical route on phones; the route draws itself in.
 */
export function MapJourney({ now, next, goal, progress = 0, compact = false }: Props) {
  const pct = Math.max(0, Math.min(100, Math.round(progress)));
  return (
    <figure
      className={`midnight relative overflow-hidden rounded-[24px] ${compact ? "p-5" : "p-5 sm:p-7"}`}
      aria-label={`Your route: you are here — ${now}; ${next ? `next move — ${next}; ` : ""}goal — ${goal}.`}
    >
      <div className="grid-bg pointer-events-none absolute inset-0" aria-hidden />
      <ol className="relative grid grid-cols-1 gap-0 md:grid-cols-3 md:gap-4" aria-hidden="true">
        <Stop index={0} icon={<MapPin size={18} />} ring="bg-[#2f6bff]/25 text-[#9cbaff]" title="You are here" body={now} />
        <Stop index={1} icon={<Footprints size={18} />} ring="bg-[#2ee6a8] text-[#071226]" title="Next move" body={next ?? "Nothing needed now"} pulse={Boolean(next)} />
        <Stop index={2} icon={<Flag size={18} />} ring="bg-white/10 text-[#2ee6a8]" title="Your goal" body={goal} last>
          {pct > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-[#2ee6a8]" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-caption text-white/70">{pct}%</span>
            </div>
          )}
        </Stop>
      </ol>
    </figure>
  );
}

function Stop({ index, icon, ring, title, body, last = false, pulse = false, children }: { index: number; icon: ReactNode; ring: string; title: string; body: string; last?: boolean; pulse?: boolean; children?: ReactNode }) {
  return (
    <li className="fade-up relative flex gap-4 pb-6 md:flex-col md:gap-3 md:pb-0" style={{ animationDelay: `${index * 180}ms` }}>
      {/* Route to the next stop: down on phones, across on wide screens. */}
      {!last && (
        <>
          <span className="absolute left-[20px] top-12 h-[calc(100%-36px)] w-[3px] origin-top rounded-full bg-gradient-to-b from-[#2f6bff] to-[#2ee6a8] md:hidden" style={{ animation: `mm-grow-y 700ms ${300 + index * 250}ms both cubic-bezier(.65,0,.35,1)` }} />
          <span className="absolute left-14 right-2 top-[20px] hidden h-[3px] origin-left rounded-full bg-gradient-to-r from-[#2f6bff] to-[#2ee6a8] md:block" style={{ animation: `mm-grow-x 800ms ${300 + index * 250}ms both cubic-bezier(.65,0,.35,1)` }} />
        </>
      )}
      <span className={`relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${ring}`}>
        {pulse && <span className="ping absolute inset-0 rounded-full bg-[#2ee6a8]/60" />}
        <span className="relative">{icon}</span>
      </span>
      <div className="min-w-0 pt-1 md:pt-0">
        <p className="text-caption font-bold uppercase tracking-wider text-white/55">{title}</p>
        <p className="font-display text-[18px] font-bold leading-snug text-white">{body}</p>
        {children}
      </div>
    </li>
  );
}
