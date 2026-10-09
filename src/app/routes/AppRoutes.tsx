import { lazy, Suspense, useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppShell } from "../../components/navigation/AppShell";
import { ActivityPage } from "../../pages/activity/ActivityPage";
import { DashboardPage } from "../../pages/dashboard/DashboardPage";
import { GoalsPage } from "../../pages/goals/GoalsPage";
import { InboxPage } from "../../pages/inbox/InboxPage";
import { LandingPage } from "../../pages/landing/LandingPage";
import { NotFoundPage } from "../../pages/legal/NotFoundPage";
import { MapPage } from "../../pages/map/MapPage";
import { MyMoneyPage } from "../../pages/money/MyMoneyPage";
import { OnboardingPage } from "../../pages/onboarding/OnboardingPage";
import { ProductDetailPage } from "../../pages/products/ProductDetailPage";
import { ProductsPage } from "../../pages/products/ProductsPage";
import { SettingsPage } from "../../pages/profile/SettingsPage";
import { RecommendationPage } from "../../pages/recommendation/RecommendationPage";
import { WhyPage } from "../../pages/recommendation/WhyPage";
import { trackPageView } from "../../services/analytics-client";

// The bank view and the legal pages are loaded only when visited, so customers download less.
const AdminShell = lazy(() => import("../../components/navigation/AdminShell").then((m) => ({ default: m.AdminShell })));
const AdminOverviewPage = lazy(() => import("../../pages/admin/AdminOverviewPage").then((m) => ({ default: m.AdminOverviewPage })));
const AdminProductsPage = lazy(() => import("../../pages/admin/AdminProductsPage").then((m) => ({ default: m.AdminProductsPage })));
const AdminEnginePage = lazy(() => import("../../pages/admin/AdminEnginePage").then((m) => ({ default: m.AdminEnginePage })));
const AdminIntegrationsPage = lazy(() => import("../../pages/admin/AdminIntegrationsPage").then((m) => ({ default: m.AdminIntegrationsPage })));
const AdminAuditPage = lazy(() => import("../../pages/admin/AdminAuditPage").then((m) => ({ default: m.AdminAuditPage })));
const PrivacyPage = lazy(() => import("../../pages/legal/PrivacyPage").then((m) => ({ default: m.PrivacyPage })));
const TermsPage = lazy(() => import("../../pages/legal/TermsPage").then((m) => ({ default: m.TermsPage })));

/** Every screen gets its own browser-tab title. */
const TITLES: [RegExp, string][] = [
  [/^\/$/, "MoneyMap — Know where you are. Know where to go."],
  [/^\/onboarding/, "Build your MoneyMap"],
  [/^\/app\/recommendation\/why/, "Why this recommendation"],
  [/^\/app\/recommendation/, "Your recommendation"],
  [/^\/app\/map/, "Your financial map"],
  [/^\/app\/my-money/, "Your money"],
  [/^\/app\/goals/, "Your goals"],
  [/^\/app\/products\/./, "Product details"],
  [/^\/app\/products/, "Products"],
  [/^\/app\/activity/, "Activity"],
  [/^\/app\/inbox/, "Messages"],
  [/^\/app\/settings/, "Settings"],
  [/^\/app/, "Your MoneyMap"],
  [/^\/admin\/products/, "Product catalogue · Bank view"],
  [/^\/admin\/engine/, "Engine & rules · Bank view"],
  [/^\/admin\/integrations/, "Integrations · Bank view"],
  [/^\/admin\/audit/, "Audit log · Bank view"],
  [/^\/admin/, "Bank view"],
  [/^\/privacy/, "Privacy policy"],
  [/^\/terms/, "Terms of use"],
];

export const KNOWN_PATHS = TITLES.map(([re]) => re);

function PageMeta() {
  const { pathname } = useLocation();
  useEffect(() => {
    const t = TITLES.find(([re]) => re.test(pathname))?.[1] ?? "Page not found";
    try {
      document.title = pathname === "/" ? t : `${t} · MoneyMap`;
    } catch {
      /* some embedded viewers don't allow it */
    }
    trackPageView(pathname);
  }, [pathname]);
  return null;
}

const Loading = () => <p className="p-8 text-center text-navy-500" role="status">Loading…</p>;

export function AppRoutes() {
  return (
    <Suspense fallback={<Loading />}>
      <PageMeta />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/app" element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="recommendation" element={<RecommendationPage />} />
          <Route path="recommendation/why" element={<WhyPage />} />
          <Route path="map" element={<MapPage />} />
          <Route path="goals" element={<GoalsPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="products/:id" element={<ProductDetailPage />} />
          <Route path="activity" element={<ActivityPage />} />
          <Route path="inbox" element={<InboxPage />} />
          <Route path="my-money" element={<MyMoneyPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Route>
        <Route path="/admin" element={<AdminShell />}>
          <Route index element={<AdminOverviewPage />} />
          <Route path="products" element={<AdminProductsPage />} />
          <Route path="engine" element={<AdminEnginePage />} />
          <Route path="integrations" element={<AdminIntegrationsPage />} />
          <Route path="audit" element={<AdminAuditPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
