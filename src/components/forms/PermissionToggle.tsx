import { useId } from "react";

interface Props {
  title: string;
  use: string;
  why: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}

/** A consent card with a real switch: plain-language "what we use it for" + "why it helps". */
export function PermissionToggle({ title, use, why, checked, onChange }: Props) {
  const id = useId();
  return (
    <div className={`card flex items-start gap-4 p-4 transition-colors ${checked ? "border-blue/30 bg-surface" : ""}`}>
      <div className="flex-1">
        <label htmlFor={id} className="font-semibold">{title}</label>
        <p className="mt-1 text-small text-ink-2"><span className="font-medium">What we use it for: </span>{use}</p>
        <p className="mt-1 text-small text-ink-3"><span className="font-medium">Why it helps: </span>{why}</p>
      </div>
      <button
        id={id}
        role="switch"
        type="button"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative mt-1 inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors ${checked ? "bg-blue" : "bg-line"}`}
      >
        <span className="sr-only">{checked ? "Allowed" : "Not allowed"}</span>
        <span className={`inline-block h-6 w-6 rounded-full bg-surface shadow transition-transform ${checked ? "translate-x-7" : "translate-x-1"}`} />
      </button>
    </div>
  );
}
