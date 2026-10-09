// Privacy-friendly visit counting: public pages only, no cookies, no identifiers, nothing sent under Do Not Track.
import { API_MODE } from "./http";

const PUBLIC_PAGES = new Set(["/", "/privacy", "/terms"]);

export function trackPageView(pathname: string) {
  if (!API_MODE || !PUBLIC_PAGES.has(pathname)) return;
  try {
    const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
    if (nav.doNotTrack === "1" || nav.globalPrivacyControl) return;
    const base = (import.meta.env.VITE_API_URL ?? "") + "/api/v1/analytics/pageview";
    void fetch(base, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path: pathname }), keepalive: true }).catch(() => undefined);
  } catch {
    /* counting is never allowed to affect the page */
  }
}
