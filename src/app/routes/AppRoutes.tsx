import { Navigate, Route, Routes } from "react-router-dom";
import { AdminShell } from "../../components/navigation/AdminShell";
import { AppShell } from "../../components/navigation/AppShell";
import { ActivityPage } from "../../pages/activity/ActivityPage";
import { AdminAuditPage } from "../../pages/admin/AdminAuditPage";
import { AdminIntegrationsPage } from "../../pages/admin/AdminIntegrationsPage";
import { AdminEnginePage } from "../../pages/admin/AdminEnginePage";
import { AdminOverviewPage } from "../../pages/admin/AdminOverviewPage";
import { AdminProductsPage } from "../../pages/admin/AdminProductsPage";
import { DashboardPage } from "../../pages/dashboard/DashboardPage";
import { GoalsPage } from "../../pages/goals/GoalsPage";
import { InboxPage } from "../../pages/inbox/InboxPage";
import { MyMoneyPage } from "../../pages/money/MyMoneyPage";
import { LandingPage } from "../../pages/landing/LandingPage";
import { MapPage } from "../../pages/map/MapPage";
import { OnboardingPage } from "../../pages/onboarding/OnboardingPage";
import { ProductDetailPage } from "../../pages/products/ProductDetailPage";
import { ProductsPage } from "../../pages/products/ProductsPage";
import { SettingsPage } from "../../pages/profile/SettingsPage";
import { RecommendationPage } from "../../pages/recommendation/RecommendationPage";
import { WhyPage } from "../../pages/recommendation/WhyPage";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/onboarding" element={<OnboardingPage />} />
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
      </Route>
      <Route path="/admin" element={<AdminShell />}>
        <Route index element={<AdminOverviewPage />} />
        <Route path="products" element={<AdminProductsPage />} />
        <Route path="engine" element={<AdminEnginePage />} />
        <Route path="integrations" element={<AdminIntegrationsPage />} />
        <Route path="audit" element={<AdminAuditPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
