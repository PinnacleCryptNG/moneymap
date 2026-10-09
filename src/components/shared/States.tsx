import { CloudOff, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./Button";

export function EmptyState({ icon: Icon, title, body, actions }: { icon: LucideIcon; title: string; body: string; actions?: ReactNode }) {
  return (
    <div className="card fade-up flex flex-col items-center px-6 py-12 text-center">
      <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-blue">
        <Icon size={32} aria-hidden />
      </span>
      <h2 className="mb-2">{title}</h2>
      <p className="mb-6 max-w-md text-ink-3">{body}</p>
      {actions && <div className="flex flex-wrap justify-center gap-3">{actions}</div>}
    </div>
  );
}

export function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="card fade-up flex flex-col items-center px-6 py-12 text-center">
      <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red">
        <CloudOff size={32} aria-hidden />
      </span>
      <h2 className="mb-2">We couldn't update your MoneyMap.</h2>
      <p className="mb-6 max-w-md text-ink-3">
        Something interrupted the connection. Your existing information is safe. Try again in a moment.
      </p>
      <Button onClick={onRetry}>Try again</Button>
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />;
}

export function LoadingPanel({ label = "Checking your financial context…" }: { label?: string }) {
  return (
    <div className="card p-6" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <p className="mb-4 text-small text-ink-3" aria-hidden>{label}</p>
      <Skeleton className="mb-3 h-6 w-2/3" />
      <Skeleton className="mb-3 h-4 w-full" />
      <Skeleton className="mb-6 h-4 w-5/6" />
      <Skeleton className="h-12 w-48" />
    </div>
  );
}
