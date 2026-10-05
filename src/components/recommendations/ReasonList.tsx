import { Check } from "lucide-react";

export function ReasonList({ items, title = "Based on:" }: { items: string[]; title?: string }) {
  return (
    <div>
      <p className="mb-2 text-small font-medium text-navy-500">{title}</p>
      <ul className="flex flex-col gap-2">
        {items.map((r) => (
          <li key={r} className="flex items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-50 text-green-700">
              <Check size={14} strokeWidth={3} aria-hidden />
            </span>
            <span>{r}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
