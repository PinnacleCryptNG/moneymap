// Step 4: MoneyMap's HTTP adapters against a stand-in Zenith implementing the integration contract.
import { createHmac } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createAdapters } from "../adapters";
import { buildApp } from "../app";
import { openDb, type Db } from "../db";
import { startMockZenith, type MockZenith } from "../mockZenith";

let z: MockZenith;
let app: FastifyInstance;
let db: Db;
const SECRET = "test-feed-secret";

beforeAll(async () => {
  z = await startMockZenith();
  const http = { baseUrl: `${z.url}/`, apiKey: "test-key", timeoutMs: 300, retries: 1 };
  db = openDb(":memory:");
  app = await buildApp(db, {
    adapters: createAdapters({
      oidc: { issuer: z.issuer, audience: z.audience, jwksUrl: `${z.url}/.well-known/jwks.json` },
      coreBanking: http,
      notifications: http,
      applications: http,
      feedSecret: SECRET,
    }),
  });
});
afterAll(async () => {
  await app.close();
  db.close();
  await z.close();
});
beforeEach(() => {
  z.calls.length = 0;
});

const session = async (id: string) => {
  const r = await app.inject({ method: "POST", url: "/api/v1/demo/session", payload: { customer_id: id, preload: true } });
  return { authorization: `Bearer ${r.json().token}` };
};
const admin = async () => ({ authorization: `Bearer ${(await app.inject({ method: "POST", url: "/api/v1/auth/demo-login", payload: { role: "admin" } })).json().token}` });

describe("identity (OpenID Connect)", () => {
  it("accepts a valid Zenith ID token and maps it to the customer", async () => {
    const r = await app.inject({ method: "GET", url: "/api/v1/customer/profile", headers: { authorization: `Bearer ${z.idToken("CUST_SARAH")}` } });
    expect(r.statusCode).toBe(200);
    expect(r.json().first_name).toBe("Sarah");
  });

  it("rejects expired, wrong-audience, wrong-issuer, tampered and alg=none tokens", async () => {
    const nowS = Math.floor(Date.now() / 1000);
    const bad = [
      z.idToken("CUST_SARAH", { exp: nowS - 3600 }),
      z.idToken("CUST_SARAH", { aud: "someone-else" }),
      z.idToken("CUST_SARAH", { iss: "https://evil.example/" }),
      z.idToken("CUST_SARAH").replace(/\.([^.]+)\./, (_, p) => `.${p.slice(0, -2)}AA.`),
      `${Buffer.from('{"alg":"none","kid":"mock-key-1"}').toString("base64url")}.${Buffer.from(JSON.stringify({ iss: z.issuer, aud: z.audience, sub: "CUST_SARAH", exp: nowS + 600 })).toString("base64url")}.`,
    ];
    for (const t of bad) {
      expect((await app.inject({ method: "GET", url: "/api/v1/customer/profile", headers: { authorization: `Bearer ${t}` } })).statusCode).toBe(401);
    }
  });

  it("a valid token for someone who isn't a MoneyMap customer is refused", async () => {
    expect((await app.inject({ method: "GET", url: "/api/v1/customer/profile", headers: { authorization: `Bearer ${z.idToken("CUST_UNKNOWN")}` } })).statusCode).toBe(401);
  });
});

describe("core banking: statement sync", () => {
  it("merges new lines from the bank into the statement the engine reads, and ignores malformed ones", async () => {
    z.setStatement("CUST_TOLU", [
      { id: "ZB-1", date: "2026-10-02", narration: "POS/SPAR IKEJA/LA NG", amount: 18500, direction: "debit", channel: "pos" },
      { id: "ZB-2", date: "2026-10-03", narration: "bad line", amount: -5, direction: "debit", channel: "pos" },
    ]);
    const h = await session("CUST_TOLU");
    const call = z.calls.find((c) => c.path === "/customers/CUST_TOLU/transactions");
    expect(call?.headers.authorization).toBe("Bearer test-key");
    const sync = (await app.inject({ method: "GET", url: "/api/v1/customer/statement-sync", headers: h })).json();
    expect(sync).toMatchObject({ mode: "http", last: { status: "ok", lines: 1 } });
    const t = (await app.inject({ method: "GET", url: "/api/v1/customer/transactions?limit=5", headers: h })).json();
    expect(t.transactions.some((x: { id: string }) => x.id === "BANK_ZB-1")).toBe(true);
    expect(t.transactions.some((x: { id: string }) => x.id === "BANK_ZB-2")).toBe(false);
  });

  it("keeps deciding on the last good copy when the bank is down", async () => {
    z.failNext("/customers/", 5, 503);
    const h = await session("CUST_SARAH");
    const sync = (await app.inject({ method: "GET", url: "/api/v1/customer/statement-sync", headers: h })).json();
    expect(sync.last).toMatchObject({ status: "failed" });
    const r = (await app.inject({ method: "POST", url: "/api/v1/recommendations", headers: h, payload: {} })).json();
    expect(r.decision.product.id).toBe("ZEN_SAVE4ME");
  });
});

describe("notifications", () => {
  it("delivers a message through the bank with an idempotency key", async () => {
    const h = await session("CUST_SARAH");
    const r = (await app.inject({ method: "POST", url: "/api/v1/demo/events", headers: h, payload: { type: "income" } })).json();
    const call = z.calls.find((c) => c.path === "/messages");
    expect(call?.headers["idempotency-key"]).toBe(r.notification.id);
    expect(call?.body).toMatchObject({ customer_id: "CUST_SARAH", category: "product_suggestion" });
    const status = (await app.inject({ method: "GET", url: "/api/v1/admin/integrations", headers: await admin() })).json();
    expect(status.deliveries[0]).toMatchObject({ notification_id: r.notification.id, status: "delivered", reference: "MSG-00001", channel: "push" });
  });

  it("a failed delivery doesn't block MoneyMap, and the retry delivers it once", async () => {
    z.failNext("/messages", 2, 0); // hangs past the timeout, both attempts
    const h = await session("CUST_SARAH");
    const r = await app.inject({ method: "POST", url: "/api/v1/demo/events", headers: h, payload: { type: "income" } });
    expect(r.statusCode).toBe(201);
    const a = await admin();
    let status = (await app.inject({ method: "GET", url: "/api/v1/admin/integrations", headers: a })).json();
    expect(status.deliveries[0]).toMatchObject({ status: "failed", attempts: 1 });
    expect(status.deliveries[0].last_error).toMatch(/timed out/);
    const retry = (await app.inject({ method: "POST", url: "/api/v1/admin/integrations/retry", headers: a })).json();
    expect(retry.delivered).toBe(1);
    status = (await app.inject({ method: "GET", url: "/api/v1/admin/integrations", headers: a })).json();
    expect(status.deliveries[0]).toMatchObject({ status: "delivered", attempts: 2 });
    expect(status.adapters.find((x: { name: string }) => x.name === "notifications").failures).toBeGreaterThan(0);
  });
});

describe("product requests", () => {
  it("hands the request to the bank and shows its reference", async () => {
    const h = await session("CUST_SARAH");
    const r = (await app.inject({ method: "POST", url: "/api/v1/products/ZEN_SAVE4ME/apply", headers: h, payload: {} })).json();
    expect(r).toMatchObject({ handoff: "handed_off", reference: expect.stringMatching(/^ZEN-REQ-/) });
    expect(z.calls.find((c) => c.path === "/product-requests")?.body).toMatchObject({ product_id: "ZEN_SAVE4ME", source: "moneymap" });
  });

  it("is kept as pending when the bank rejects it with a server error, then retried", async () => {
    z.failNext("/product-requests", 2, 500);
    const h = await session("CUST_SARAH");
    const r = (await app.inject({ method: "POST", url: "/api/v1/products/ZEN_SAVE4ME/apply", headers: h, payload: {} })).json();
    expect(r.handoff).toBe("pending");
    expect((await app.inject({ method: "POST", url: "/api/v1/admin/integrations/retry", headers: await admin() })).json().handed_off).toBe(1);
    const apps = (await app.inject({ method: "GET", url: "/api/v1/applications", headers: h })).json();
    expect(apps[0]).toMatchObject({ handoff: "handed_off", reference: expect.stringMatching(/^ZEN-REQ-/) });
  });
});

describe("signed transaction webhooks", () => {
  const line = { customer_id: "CUST_SARAH", external_id: "TXN-778", narration: "NIP/BRIGHTPATH LOGISTICS LTD/SALARY OCT 2026", amount: 450000, direction: "credit", channel: "transfer" };
  const signed = (body: string, ts = Math.floor(Date.now() / 1000), secret = SECRET) => ({
    "content-type": "application/json",
    "x-moneymap-timestamp": String(ts),
    "x-moneymap-signature": `sha256=${createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex")}`,
  });

  it("accepts a correctly signed line and ignores the same line delivered twice", async () => {
    await session("CUST_SARAH");
    const body = JSON.stringify(line);
    const first = await app.inject({ method: "POST", url: "/api/v1/events/transactions", headers: signed(body), payload: body });
    expect(first.statusCode).toBe(201);
    expect(first.json().event.outcome).toBe("notified");
    const again = await app.inject({ method: "POST", url: "/api/v1/events/transactions", headers: signed(body), payload: body });
    expect(again.statusCode).toBe(200);
    expect(again.json()).toMatchObject({ duplicate: true, notification: null });
  });

  it("rejects a wrong secret, a changed body and an old timestamp", async () => {
    const body = JSON.stringify({ ...line, external_id: "TXN-779" });
    const tampered = JSON.stringify({ ...line, external_id: "TXN-779", amount: 9_000_000 });
    const old = Math.floor(Date.now() / 1000) - 3600;
    for (const [headers, payload] of [
      [signed(body, undefined, "wrong"), body],
      [signed(body), tampered],
      [signed(body, old), body],
    ] as const) {
      expect((await app.inject({ method: "POST", url: "/api/v1/events/transactions", headers, payload })).statusCode).toBe(401);
    }
  });
});
