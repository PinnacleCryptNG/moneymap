import { useEffect } from "react";
import { HashRouter, useLocation } from "react-router-dom";
import { ToastProvider } from "../components/shared/Toast";
import { StoreProvider } from "./providers/store";
import { AppRoutes } from "./routes/AppRoutes";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => window.scrollTo(0, 0), [pathname]);
  return null;
}

export function App() {
  return (
    <StoreProvider>
      <ToastProvider>
        <HashRouter>
          <ScrollToTop />
          <AppRoutes />
        </HashRouter>
      </ToastProvider>
    </StoreProvider>
  );
}
