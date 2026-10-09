import { Activity, Bell, Compass, Wallet, Flag, Home, LayoutGrid, Map as MapIcon, Settings, ShieldCheck, User } from "lucide-react";
import { NavLink, Navigate, Outlet, Link, useLocation } from "react-router-dom";
import { useStore } from "../../app/providers/store";
import { Logo } from "../shared/Logo";
import { ThemeToggle } from "../shared/ThemeToggle";
import { SyncBanner } from "../shared/SyncBanner";

const SIDE = [
  { to: "/app", label: "Overview", icon: Home, end: true },
  { to: "/app/goals", label: "My Goals", icon: Flag },
  { to: "/app/map", label: "Insights", icon: MapIcon },
  { to: "/app/my-money", label: "My money", icon: Wallet },
  { to: "/app/products", label: "Products", icon: LayoutGrid },
  { to: "/app/activity", label: "Activity", icon: Activity },
  { to: "/app/settings", label: "Settings", icon: Settings },
];

const BOTTOM = [
  { to: "/app", label: "Home", icon: Home, end: true },
  { to: "/app/goals", label: "Goals", icon: Flag },
  { to: "/app/map", label: "Map", icon: Compass, primary: true },
  { to: "/app/activity", label: "Activity", icon: Activity },
  { to: "/app/settings", label: "Profile", icon: User },
];

export function TopNavigation() {
  const { customer, state } = useStore();
  const unread = state.notifications.filter((n) => !n.read_at).length;
  return (
    <header className="glass sticky top-0 z-30 border-b border-line">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 md:px-6">
        <Link to="/app" aria-label="MoneyMap home"><Logo /></Link>
        <div className="flex items-center gap-2">
          <Link to="/admin" className="hidden min-h-11 items-center gap-1.5 rounded-[10px] px-3 text-small font-medium text-ink-3 hover:bg-canvas hover:text-ink sm:inline-flex">
            <ShieldCheck size={18} aria-hidden /> Bank view
          </Link>
          <ThemeToggle />
          <Link
            to="/app/inbox"
            className="relative flex h-11 w-11 items-center justify-center rounded-full text-ink-2 hover:bg-ink/[.06]"
            aria-label={unread ? `Messages, ${unread} unread` : "Messages"}
          >
            <Bell size={20} aria-hidden />
            {unread > 0 && (
              <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-alert px-1 text-[10px] font-bold text-white" aria-hidden>
                {unread}
              </span>
            )}
          </Link>
          <Link to="/app/settings" className="flex min-h-11 items-center gap-2 rounded-full border border-line py-1 pl-1 pr-3 hover:bg-canvas" aria-label={`Profile: ${customer.name}`}>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-mint font-display text-small font-bold text-night" aria-hidden>
              {customer.firstName[0]}
            </span>
            <span className="hidden text-small font-medium sm:inline">{customer.firstName}</span>
          </Link>
        </div>
      </div>
    </header>
  );
}

export function BottomNavigation() {
  return (
    <nav aria-label="Primary" className="glass fixed inset-x-0 bottom-0 z-30 border-t border-line pb-[env(safe-area-inset-bottom)] md:hidden">
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {BOTTOM.map(({ to, label, icon: Icon, end, primary }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex min-h-16 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${isActive ? "text-ink" : "text-ink-3"}`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`flex h-8 w-12 items-center justify-center rounded-full ${primary ? "bg-mint text-night shadow-[0_6px_16px_-6px_rgb(46_230_168/0.7)]" : isActive ? "bg-ink/[.08]" : ""}`}>
                    <Icon size={20} aria-hidden />
                  </span>
                  {label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function SideNavigation() {
  return (
    <nav aria-label="Sections" className="sticky top-16 hidden h-[calc(100vh-4rem)] w-64 shrink-0 px-4 py-6 md:block">
      <ul className="flex flex-col gap-1">
        {SIDE.map(({ to, label, icon: Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                `relative flex min-h-11 items-center gap-3 rounded-[12px] px-3 font-medium transition-colors ${
                  isActive
                    ? "bg-surface text-ink shadow-[var(--shadow-card)] ring-1 ring-line before:absolute before:left-0 before:top-2.5 before:h-6 before:w-1 before:rounded-r-full before:bg-mint"
                    : "text-ink-2 hover:bg-ink/[.05] hover:text-ink"
                }`
              }
            >
              <Icon size={20} aria-hidden />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
      <div className="midnight relative mt-8 overflow-hidden rounded-[20px] p-4 text-small">
        <p className="mb-1 font-display font-bold text-white">Your data. Your permission. Your map.</p>
        <p className="mb-3 text-white/70">You decide what MoneyMap can use.</p>
        <Link to="/app/settings" className="font-semibold text-[#2ee6a8] hover:underline">Manage permissions →</Link>
      </div>
    </nav>
  );
}

export function AppShell() {
  const { state } = useStore();
  const location = useLocation();
  if (!state.onboarded) return <Navigate to="/onboarding" replace state={{ from: location.pathname }} />;
  return (
    <div className="min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-[10px] focus:bg-surface focus:px-4 focus:py-2">Skip to content</a>
      <TopNavigation />
      <div className="mx-auto flex max-w-7xl">
        <SideNavigation />
        <main id="main" className="min-w-0 flex-1 px-4 pb-28 pt-6 md:px-8 md:pb-12 md:pt-8">
          <SyncBanner />
          <div key={location.pathname} className="page-in">
            <Outlet />
          </div>
        </main>
      </div>
      <BottomNavigation />
    </div>
  );
}
