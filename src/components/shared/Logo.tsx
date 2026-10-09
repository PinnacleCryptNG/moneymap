import { useId } from "react";

/**
 * The MoneyMap mark: an "M" drawn as a route. It sets off from a white "you are here" dot,
 * climbs two hills and reaches a mint goal at the summit, ringed like a contour line.
 * The last leg of the M is faint: the road carries on after the goal.
 * Same drawing as public/logo.svg and the brand kit in docs/brand.
 */
export function LogoMark({ size = 32, inverted = false }: { size?: number; inverted?: boolean }) {
  const id = useId().replace(/:/g, "");
  const small = size < 24;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop stopColor="#12274f" />
          <stop offset="1" stopColor="#050d1d" />
        </linearGradient>
        <linearGradient id={`${id}-rt`} x1="12" y1="49" x2="43" y2="15" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7aa2ff" />
          <stop offset="1" stopColor="#2ee6a8" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill={`url(#${id}-bg)`} stroke={inverted ? "rgb(255 255 255 / 0.16)" : "none"} strokeWidth="2" />
      {!small && <circle cx="43" cy="16" r="10" stroke="#2ee6a8" strokeOpacity=".25" strokeWidth="2" />}
      <path d="M43 16 L52 49" stroke="#ffffff" strokeOpacity=".26" strokeWidth="6" strokeLinecap="round" />
      <path d="M12 49 L21.5 17 L32 37 L43 16" stroke={`url(#${id}-rt)`} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="49" r="4.5" fill="#ffffff" />
      <circle cx="43" cy="16" r="6" fill="#2ee6a8" />
    </svg>
  );
}

export function Logo({ inverted = false, size = 32 }: { inverted?: boolean; size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark size={size} inverted={inverted} />
      <span className={`font-display text-[19px] font-semibold tracking-[-0.03em] ${inverted ? "text-white" : "text-ink"}`}>
        Money<span className={inverted ? "text-mint" : "text-green-700"}>Map</span>
      </span>
    </span>
  );
}
