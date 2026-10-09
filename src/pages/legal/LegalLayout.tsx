import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Logo } from "../../components/shared/Logo";

/** Shared frame for the public information pages (privacy, terms, not found). */
export function PublicPage({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <header className="mx-auto flex h-16 w-full max-w-3xl items-center justify-between px-4 md:px-6">
        <Link to="/" aria-label="MoneyMap home"><Logo /></Link>
      </header>
      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16 pt-6 md:px-6">{children}</main>
      <SiteFooter />
    </div>
  );
}

export function SiteFooter({ dark = false }: { dark?: boolean }) {
  const link = `inline-flex min-h-11 items-center hover:underline ${dark ? "text-white/80" : "text-ink-3"}`;
  return (
    <footer className={dark ? "bg-night" : "border-t border-line bg-surface"}>
      {/* Extra bottom space so the floating Demo button never covers these links. */}
      <nav aria-label="Legal" className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 px-4 pb-20 pt-2 text-small md:px-6">
        <Link to="/privacy" className={link}>Privacy policy</Link>
        <Link to="/terms" className={link}>Terms of use</Link>
        <span className={dark ? "text-white/60" : "text-ink-3"}>Prototype · synthetic data only</span>
      </nav>
    </footer>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 !text-[22px]">{title}</h2>
      <div className="flex flex-col gap-3 text-ink-2">{children}</div>
    </section>
  );
}
