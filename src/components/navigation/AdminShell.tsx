import { ArrowLeft, BarChart3, Database, History, Package, Plug, SlidersHorizontal } from "lucide-react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { LogoMark } from "../shared/Logo";
import { SyncBanner } from "../shared/SyncBanner";
import { ThemeToggle } from "../shared/ThemeToggle";

const NAV = [
  { to: "/admin", label: "Overview", icon: BarChart3, end: true },
  { to: "/admin/products", label: "Product catalogue", icon: Package },
  { to: "/admin/engine", label: "Engine & rules", icon: SlidersHorizontal },
  { to: "/admin/integrations", label: "Integrations", icon: Plug },
  { to: "/admin/audit", label: "Audit log", icon: History },
];

/** The bank view: a dark sidebar on wide screens, a dark bar with tabs on phones. */
export function AdminShell() {
  const { pathname } = useLocation();
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
      {/* Sidebar (wide screens). */}
      <aside className="midnight sticky top-0 hidden h-screen flex-col px-4 py-5 text-white lg:flex">
        <Link to="/admin" className="flex items-center gap-2.5 px-2" aria-label="MoneyMap bank view">
          <LogoMark inverted />
          <span className="font-display text-[17px] font-semibold tracking-tight">MoneyMap</span>
        </Link>
        <p className="mt-1 px-2 pl-[50px] text-[12px] text-white/50">Bank view · Zenith</p>

        <nav aria-label="Admin sections" className="mt-8">
          <ul className="flex flex-col gap-0.5">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `group relative flex min-h-10 items-center gap-3 rounded-[10px] px-3 text-[14px] font-medium transition ${isActive ? "bg-white/[.09] text-white" : "text-white/65 hover:bg-white/[.05] hover:text-white"}`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-mint" aria-hidden />}
                      <Icon size={17} aria-hidden className={isActive ? "text-mint" : ""} /> {label}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-auto flex flex-col gap-3 pb-16">
          <div className="rounded-[14px] border border-white/10 bg-white/[.04] p-3">
            <p className="flex items-center gap-2 text-[12px] font-medium text-white/80"><Database size={14} aria-hidden className="text-mint" /> Synthetic data</p>
            <p className="mt-1 text-[12px] leading-relaxed text-white/50">No real customer is shown here. Figures come from the live engine.</p>
          </div>
          <div className="flex items-center justify-between">
            <Link to="/app" className="inline-flex min-h-10 items-center gap-1.5 rounded-[10px] px-2 text-[13px] font-medium text-white/70 hover:bg-white/10 hover:text-white">
              <ArrowLeft size={16} aria-hidden /> Customer app
            </Link>
            <ThemeToggle onDark />
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        {/* Top bar and tabs (phones and tablets). */}
        <header className="midnight sticky top-0 z-30 text-white lg:hidden">
          <div className="flex h-14 items-center justify-between gap-3 px-4">
            <Link to="/admin" className="flex items-center gap-2" aria-label="MoneyMap bank view">
              <LogoMark inverted />
              <span className="font-display font-semibold">MoneyMap</span>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white/80">Bank view</span>
            </Link>
            <div className="flex items-center gap-1">
              <ThemeToggle onDark />
              <Link to="/app" className="inline-flex min-h-11 items-center gap-1 rounded-[10px] px-2 text-small font-medium text-white/80 hover:bg-white/10" aria-label="Back to the customer app">
                <ArrowLeft size={18} aria-hidden /> App
              </Link>
            </div>
          </div>
          <nav aria-label="Admin sections" className="overflow-x-auto px-2">
            <ul className="flex gap-1">
              {NAV.map(({ to, label, icon: Icon, end }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    end={end}
                    className={({ isActive }) =>
                      `flex min-h-11 items-center gap-2 whitespace-nowrap border-b-2 px-3 text-small font-medium ${isActive ? "border-mint text-white" : "border-transparent text-white/70 hover:text-white"}`
                    }
                  >
                    <Icon size={16} aria-hidden /> {label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </header>
        <main id="main" className="mx-auto max-w-[1200px] px-4 pb-16 pt-6 md:px-8 md:pt-10">
          <SyncBanner />
          <div key={pathname} className="page-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
