import type { Band } from "../../engine";

const BAND_LABEL: Record<Band, string> = {
  strong: "Strong match",
  potential: "Potential match",
  low: "Weak match",
  excluded: "Not eligible",
};

/** A score is never shown alone — it always carries its band label (spec §22). */
export function MatchScore({ score, band, size = 88 }: { score: number; band: Band; size?: number }) {
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  const color = band === "strong" ? "#18A874" : band === "potential" ? "#F59E0B" : "#52657A";
  return (
    <div className="flex items-center gap-3">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${score}% match — ${BAND_LABEL[band]}`}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#E4EAF1" strokeWidth="8" fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - score / 100)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="route-draw"
          style={{ ["--len" as string]: c }}
        />
        <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" className="fill-navy" fontSize={size / 4.2} fontWeight={700}>
          {score}%
        </text>
      </svg>
      <div>
        <p className="font-semibold">{score}% match</p>
        <p className="text-small text-navy-500">{BAND_LABEL[band]}</p>
      </div>
    </div>
  );
}
