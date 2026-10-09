/** Logo: an abstract "M" route ending in an upward/forward point (spec §53). */
export function LogoMark({ size = 32, inverted = false }: { size?: number; inverted?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="mm-logo-bg" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor={inverted ? "#16294d" : "#122650"} />
          <stop offset="1" stopColor="#071226" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#mm-logo-bg)" stroke={inverted ? "rgb(255 255 255 / 0.18)" : "none"} />
      <path d="M7 23 L7 11 L13 18 L19 11" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19 11 L25 6" stroke="#2EE6A8" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M21 6 H25 V10" stroke="#2EE6A8" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="7" cy="23" r="2" fill="#7AA2FF" />
    </svg>
  );
}

export function Logo({ inverted = false, size = 32 }: { inverted?: boolean; size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark size={size} inverted={inverted} />
      <span className={`font-display text-[19px] font-extrabold tracking-tight ${inverted ? "text-white" : "text-ink"}`}>MoneyMap</span>
    </span>
  );
}
