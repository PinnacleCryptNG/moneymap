import { ArrowLeft, BarChart3, History, Package, SlidersHorizontal } from "lucide-react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { LogoMark } from "../shared/Logo";

const NAV = [
  { to: "/admin", label: "Overview", icon: BarChart3, end: true },
  { to: "/admin/products", label: "Product catalogue", icon: Package },
  { to: "/admin/engine", label: "Engine & rules", icon: SlidersHorizontal },
  { to: "/admin/audit", label: "Audit log", icon: History },
];

export function AdminShell() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 bg-navy text-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 md:px-6">
          <Link to="/admin" className="flex items-center gap-2.5" aria-label="MoneyMap bank view">
            <LogoMark inverted />
            <span className="font-bold">MoneyMap</span>
            <span className="rounded-full bg-white/15 px-2 py-0.5 text-caption">Bank view</span>
          </Link>
          <Link to="/app" className="inline-flex min-h-11 items-center gap-1.5 rounded-[10px] px-3 text-small font-medium text-white/80 hover:bg-white/10 hover:text-white">
            <ArrowLeft size={18} aria-hidden /> Customer app
          </Link>
        </div>
        <nav aria-label="Admin sections" className="mx-auto max-w-7xl overflow-x-auto px-2 md:px-4">
          <ul className="flex gap-1">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `flex min-h-11 items-center gap-2 whitespace-nowrap border-b-2 px-3 text-small font-medium ${isActive ? "border-green text-white" : "border-transparent text-white/70 hover:text-white"}`
                  }
                >
                  <Icon size={18} aria-hidden /> {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main id="main" className="mx-auto max-w-7xl px-4 pb-16 pt-8 md:px-6">
        <Outlet />
      </main>
    </div>
  );
}
