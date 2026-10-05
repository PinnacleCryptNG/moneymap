import { Activity, Compass, Flag, Home, LayoutGrid, Map as MapIcon, Settings, ShieldCheck, User } from "lucide-react";
import { NavLink, Navigate, Outlet, Link, useLocation } from "react-router-dom";
import { useStore } from "../../app/providers/store";
import { Logo } from "../shared/Logo";

const SIDE = [
  { to: "/app", label: "Overview", icon: Home, end: true },
  { to: "/app/goals", label: "My Goals", icon: Flag },
  { to: "/app/map", label: "Insights", icon: MapIcon },
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
  const { customer } = useStore();
  return (
    <header className="sticky top-0 z-30 border-b border-mist bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 md:px-6">
        <Link to="/app" aria-label="MoneyMap home"><Logo /></Link>
        <div className="flex items-center gap-2">
          <Link to="/admin" className="hidden min-h-11 items-center gap-1.5 rounded-[10px] px-3 text-small font-medium text-navy-500 hover:bg-cloud hover:text-navy sm:inline-flex">
            <ShieldCheck size={18} aria-hidden /> Bank admin
          </Link>
          <Link to="/app/settings" className="flex min-h-11 items-center gap-2 rounded-full border border-mist py-1 pl-1 pr-3 hover:bg-cloud" aria-label={`Profile: ${customer.name}`}>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-navy text-small font-semibold text-white" aria-hidden>
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
    <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-30 border-t border-mist bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {BOTTOM.map(({ to, label, icon: Icon, end, primary }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex min-h-16 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${isActive ? "text-blue-600" : "text-navy-500"}`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`flex h-8 w-12 items-center justify-center rounded-full ${primary ? (isActive ? "bg-blue text-white" : "bg-blue-50 text-blue-600") : isActive ? "bg-blue-50" : ""}`}>
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
    <nav aria-label="Sections" className="sticky top-16 hidden h-[calc(100vh-4rem)] w-60 shrink-0 border-r border-mist bg-white px-3 py-6 md:block">
      <ul className="flex flex-col gap-1">
        {SIDE.map(({ to, label, icon: Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex min-h-11 items-center gap-3 rounded-[10px] px-3 font-medium transition-colors ${
                  isActive ? "bg-blue-50 text-blue-600" : "text-navy-700 hover:bg-cloud"
                }`
              }
            >
              <Icon size={20} aria-hidden />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
      <div className="mt-8 rounded-[16px] bg-cloud p-4 text-small text-navy-700">
        <p className="mb-1 font-semibold text-navy">Your data. Your permission. Your map.</p>
        <p className="mb-2">You decide what MoneyMap can use.</p>
        <Link to="/app/settings" className="font-semibold text-blue-600 hover:underline">Manage permissions</Link>
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
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-[10px] focus:bg-white focus:px-4 focus:py-2">Skip to content</a>
      <TopNavigation />
      <div className="mx-auto flex max-w-7xl">
        <SideNavigation />
        <main id="main" className="min-w-0 flex-1 px-4 pb-28 pt-6 md:px-8 md:pb-12 md:pt-8">
          <Outlet />
        </main>
      </div>
      <BottomNavigation />
    </div>
  );
}
