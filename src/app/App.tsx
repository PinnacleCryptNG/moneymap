import { Component, useEffect, type ReactNode } from "react";
import { HashRouter, MemoryRouter, useLocation } from "react-router-dom";
import { ToastProvider } from "../components/shared/Toast";
import { StoreProvider } from "./providers/store";
import { AppRoutes } from "./routes/AppRoutes";

/**
 * Hosted inside an embedded viewer (e.g. a sandboxed frame) the page may not be allowed
 * to change its own URL, so builds with VITE_ROUTER=memory keep navigation in memory.
 */
const Router = import.meta.env.VITE_ROUTER === "memory" ? MemoryRouter : HashRouter;

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    // Never return scrollTo's result: some embedded viewers wrap it, and React would call it as a cleanup.
    try {
      window.scrollTo(0, 0);
    } catch {
      /* scrolling is a convenience only */
    }
  }, [pathname]);
  return null;
}

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="mb-3">We couldn't update your MoneyMap.</h1>
        <p className="mb-6 text-navy-500">Something interrupted the app. Your existing information is safe.</p>
        <button
          type="button"
          className="min-h-12 rounded-[10px] bg-blue px-5 font-semibold text-white"
          onClick={() => {
            try {
              localStorage.removeItem("moneymap:v3");
            } catch {
              /* ignore */
            }
            location.reload();
          }}
        >
          Start again
        </button>
        <p className="mt-6 text-caption !font-normal text-navy-500">{this.state.error.message}</p>
      </div>
    );
  }
}

export function App() {
  return (
    <ErrorBoundary>
      <StoreProvider>
        <ToastProvider>
          <Router>
            <ScrollToTop />
            <AppRoutes />
          </Router>
        </ToastProvider>
      </StoreProvider>
    </ErrorBoundary>
  );
}
