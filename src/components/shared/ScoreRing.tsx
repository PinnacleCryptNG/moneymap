/** An animated match ring (0–100). */
export function ScoreRing({ value, size = 64, onDark = false, label }: { value: number; size?: number; onDark?: boolean; label?: string }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={label ?? `${value}% match`}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="6" className={onDark ? "stroke-white/15" : "stroke-line"} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          className="route-draw stroke-mint"
          style={{ ["--len" as string]: c, strokeDasharray: `${(c * value) / 100} ${c}` }}
        />
      </svg>
      <span className={`absolute inset-0 flex items-center justify-center font-display font-extrabold ${onDark ? "text-white" : "text-ink"}`} style={{ fontSize: size * 0.24 }} aria-hidden>
        {value}%
      </span>
    </div>
  );
}
