/** Logo: an abstract "M" route ending in an upward/forward point (spec §53). */
export function LogoMark({ size = 32, inverted = false }: { size?: number; inverted?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill={inverted ? "#FFFFFF" : "#0B1F33"} />
      <path d="M7 23 L7 11 L13 18 L19 11" stroke={inverted ? "#0B1F33" : "#FFFFFF"} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19 11 L25 6" stroke="#18A874" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M21 6 H25 V10" stroke="#18A874" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="7" cy="23" r="2" fill="#1677FF" />
    </svg>
  );
}

export function Logo({ inverted = false, size = 32 }: { inverted?: boolean; size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark size={size} inverted={inverted} />
      <span className={`text-[18px] font-bold tracking-tight ${inverted ? "text-white" : "text-navy"}`}>MoneyMap</span>
    </span>
  );
}
