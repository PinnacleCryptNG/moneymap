// Smoke test for a deployed MoneyMap: node scripts/smoke.mjs https://your-app.onrender.com
// Walks the core journey through the live API (plus the app and docs pages) and reports each step.
const BASE = (process.argv[2] ?? process.env.QA_URL ?? "http://localhost:8080").replace(/\/$/, "");
let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
};
async function api(method, path, body, token) {
  const res = await fetch(`${BASE}/api/v1${path}`, {
    method,
    headers: { ...(body && { "content-type": "application/json" }), ...(token && { authorization: `Bearer ${token}` }) },
    body: body && JSON.stringify(body),
  });
  return { status: res.status, json: res.status === 204 ? null : await res.json().catch(() => null) };
}
// Bot protection: solve the server's sign-in puzzle (SHA-256 with a number of leading zero bits).
import { createHash } from "node:crypto";
async function pow() {
  const c = (await api("GET", "/demo/challenge")).json;
  if (!c?.bits) return undefined;
  for (let i = 0; ; i++) {
    const h = createHash("sha256").update(`${c.challenge}:${i}`).digest();
    let n = 0;
    for (const b of h) {
      if (b === 0) { n += 8; continue; }
      n += Math.clz32(b) - 24;
      break;
    }
    if (n >= c.bits) return { challenge: c.challenge, nonce: String(i) };
  }
}
const session = async (id) => (await api("POST", "/demo/session", { customer_id: id, preload: true, pow: await pow() })).json.token;

console.log(`Smoke test: ${BASE}`);
const t0 = Date.now();
const health = await api("GET", "/health");
check("Server healthy", health.json?.status === "ok", `${((Date.now() - t0) / 1000).toFixed(1)}s`);
check("Audit chain intact", health.json?.audit?.intact === true);

const page = await fetch(`${BASE}/`);
const html = await page.text();
check("App page served", page.ok && html.includes('id="root"'));
const script = html.match(/src="([^"]+\.js)"/)?.[1];
const scriptUrl = script ? new URL(script, `${BASE}/`) : null;
const main = scriptUrl ? await (await fetch(scriptUrl)).text() : "";
// The main script imports shared chunks (the bank view is split out); read those too.
const chunks = await Promise.all([...main.matchAll(/from"(\.\/[^"]+\.js)"/g)].map(async (m) => (await fetch(new URL(m[1], scriptUrl))).text()));
const bundle = [main, ...chunks].join("\n");
check("App built in API mode", bundle.includes("/api/v1") && bundle.includes("/customer/moneymap"));

// Launch checklist: public files, metadata, 404, headers, bot protection, anonymous visit counting.
for (const [file, type] of [["robots.txt", "text/plain"], ["sitemap.xml", "xml"], ["og-image.png", "image/png"], ["site.webmanifest", ""], ["apple-touch-icon.png", "image/png"]]) {
  const r = await fetch(`${BASE}/${file}`);
  check(`Serves ${file}`, r.ok && (r.headers.get("content-type") ?? "").includes(type));
}
check("Social preview tags", html.includes('property="og:image"') && html.includes('name="twitter:card"'));
check("Page description", /<meta name="description" content="[^"]{50,}/.test(html));
const missing = await fetch(`${BASE}/no-such-page`);
check("Unknown page → custom 404", missing.status === 404 && (await missing.text()).includes("This page isn't on the map"));
check("Security headers on the app", (page.headers.get("content-security-policy") ?? "").includes("frame-ancestors 'none'") && page.headers.get("x-content-type-options") === "nosniff");
check("HTTP redirects to HTTPS", BASE.startsWith("http://localhost") || (await fetch(BASE.replace("https://", "http://") + "/", { redirect: "manual" })).status === 301);
const noPuzzle = await api("POST", "/demo/session", { customer_id: "CUST_SARAH", preload: true });
const challenge = (await api("GET", "/demo/challenge")).json;
check("Bot protection on sign-in", challenge?.bits > 0 ? noPuzzle.status === 403 : true, `${challenge?.bits ?? 0} bits`);
check("Anonymous visit counting", (await api("POST", "/analytics/pageview", { path: "/" })).status === 204);
check("API docs page", (await fetch(`${BASE}/docs/json`)).ok);
check("Product catalogue", (await api("GET", "/products")).json?.length === 6);

const sarah = await session("CUST_SARAH");
const s1 = await api("POST", "/recommendations", {}, sarah);
check("Sarah → SAVE4ME", s1.json?.decision?.product?.id === "ZEN_SAVE4ME", `${s1.json?.decision?.match_score}% match`);
const recId = s1.json?.recommendation?.id;
const ex = await api("GET", `/recommendations/${recId}/explanation`, null, sarah);
check("Stored explanation", Boolean(ex.json?.explanation?.whyItFits));
await api("POST", `/recommendations/${recId}/feedback`, { feedback: "not_relevant" }, sarah);
const s2 = await api("POST", "/recommendations", {}, sarah);
check("Not relevant → not shown again", s2.json?.decision?.product?.id !== "ZEN_SAVE4ME", s2.json?.decision?.status);

const customers = await api("GET", "/demo/customers");
check("Two demo customers", customers.json?.length === 2, customers.json?.map?.((c) => c.name).join(", "));

const tolu = await session("CUST_TOLU");
const n = await api("POST", "/recommendations", {}, tolu);
check("Tolu → no recommendation", n.json?.decision?.status === "no_match" && n.json?.recommendation === null);
await api("POST", "/goals", { type: "major_expense", expense_kind: "vehicle", label: "Buy a car", amount: 6000000, timeline_months: 12 }, tolu);
check("Tolu + car goal → Asset Finance", (await api("POST", "/recommendations", {}, tolu)).json?.decision?.product?.id === "ZEN_ASSET_FINANCE");

const sarahEv = await session("CUST_SARAH");
const ev = await api("POST", "/demo/events", { type: "income" }, sarahEv);
check("Salary lands → one message", ev.json?.event?.outcome === "notified" && ev.json?.notification?.product_id === "ZEN_SAVE4ME", ev.json?.event?.reason);
const ev2 = await api("POST", "/demo/events", { type: "windfall" }, sarahEv);
check("Bonus right after → held back", ev2.json?.event?.outcome === "held_back", ev2.json?.event?.reason);
const toluEv = await session("CUST_TOLU");
const ev3 = await api("POST", "/demo/events", { type: "windfall" }, toluEv);
check("Tolu bonus → nothing sent", ev3.json?.event?.outcome === "held_back" && ev3.json?.notification === null);

const off = { account_activity: false, income_patterns: false, spending_patterns: false, existing_products: false, financial_goals: false };
const sarah2 = await session("CUST_SARAH");
await api("POST", "/consent", off, sarah2);
const ctx = await api("GET", "/customer/financial-context", null, sarah2);
check("Withdrawn consent → no signals", ctx.json?.context?.signals?.length === 0);
check("No token → refused", (await api("POST", "/recommendations", {})).status === 401);
check("Invalid goal → rejected", (await api("POST", "/goals", { type: "save_more", label: "x", amount: 5, timeline_months: 12 }, tolu)).status === 400);

console.log(`\n${failures ? `${failures} failed` : "All checks passed"}`);
process.exit(failures ? 1 : 0);
