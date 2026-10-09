import type { ReactNode } from "react";

export function PageHeader({ eyebrow, title, body, actions }: { eyebrow?: string; title: string; body?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
        <h1>{title}</h1>
        {body && <p className="mt-2 max-w-2xl text-ink-3">{body}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
    </header>
  );
}
