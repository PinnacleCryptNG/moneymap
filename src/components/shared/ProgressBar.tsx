export function ProgressBar({ value, label, tone = "green" }: { value: number; label: string; tone?: "green" | "blue" }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v)}
      className="h-2.5 w-full overflow-hidden rounded-full bg-line"
    >
      <div
        className={`h-full rounded-full transition-[width] duration-500 ease-out ${tone === "green" ? "bg-green" : "bg-blue"}`}
        style={{ width: `${v}%` }}
      />
    </div>
  );
}
