// Step 5: security controls — production mode, staff sign-in, headers, CORS, limits, error hygiene, data rights.
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAdapters } from "../adapters";
import { buildApp } from "../app";
import { issueToken } from "../auth";
import { openDb, type Db } from "../db";
import { startMockZenith, type MockZenith } from "../mockZenith";
import { securityConfigFromEnv } from "../security";

describe("production mode", () => {
  let z: MockZenith;
  let app: FastifyInstance;
  let db: Db;
  beforeAll(async () => {
    z = await startMockZenith();
    db = openDb(":memory:");
    app = await buildApp(db, {
      adapters: createAdapters({ oidc: { issuer: z.issuer, audience: z.audience, jwksUrl: `${z.url}/.well-known/jwks.json` } }, { allowDemoTokens: false }),
      security: { mode: "production", corsOrigins: ["https://app.zenithbank.example"], rateLimits: false },
    });
  });
  afterAll(async () => {
    await app.close();
    db.close();
    await z.close();
  });

  it("has no demo sign-in, Demo Mode, demo events or reset endpoints", async () => {
    for (const [method, url] of [
      ["POST", "/api/v1/demo/session"],
      ["POST", "/api/v1/auth/demo-login"],
      ["GET", "/api/v1/demo/customers"],
      ["POST", "/api/v1/demo/reset"],
      ["POST", "/api/v1/demo/events"],
    ] as const) {
      expect((await app.inject({ method, url, payload: method === "POST" ? {} : undefined })).statusCode).toBe(404);
    }
  });

  it("rejects MoneyMap demo tokens, even validly signed ones", async () => {
    for (const t of [issueToken("CUST_SARAH", "customer"), issueToken("zenith-admin", "admin")]) {
      expect((await app.inject({ method: "GET", url: "/api/v1/customer/profile", headers: { authorization: `Bearer ${t}` } })).statusCode).toBe(401);
      expect((await app.inject({ method: "GET", url: "/api/v1/admin/audit", headers: { authorization: `Bearer ${t}` } })).statusCode).toBe(403);
    }
  });

  it("opens the bank view only to staff tokens carrying the MoneyMap admin role", async () => {
    const staff = z.idToken("staff-0042", { roles: ["moneymap_admin"] });
    const customer = z.idToken("CUST_SARAH");
    expect((await app.inject({ method: "GET", url: "/api/v1/admin/audit", headers: { authorization: `Bearer ${staff}` } })).statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: "/api/v1/admin/audit", headers: { authorization: `Bearer ${customer}` } })).statusCode).toBe(403);
    // A staff token is not a customer session.
    expect((await app.inject({ method: "GET", url: "/api/v1/customer/profile", headers: { authorization: `Bearer ${staff}` } })).statusCode).toBe(401);
    expect((await app.inject({ method: "GET", url: "/api/v1/customer/profile", headers: { authorization: `Bearer ${customer}` } })).statusCode).toBe(200);
  });

  it("allows cross-origin calls only from listed origins, and sends HSTS", async () => {
    const ok = await app.inject({ method: "GET", url: "/api/v1/products", headers: { origin: "https://app.zenithbank.example" } });
    expect(ok.headers["access-control-allow-origin"]).toBe("https://app.zenithbank.example");
    const evil = await app.inject({ method: "GET", url: "/api/v1/products", headers: { origin: "https://evil.example" } });
    expect(evil.headers["access-control-allow-origin"]).toBeUndefined();
    expect(ok.headers["strict-transport-security"]).toMatch(/max-age=31536000/);
  });
});

describe("configuration fails closed", () => {
  it("production refuses to start without a strong secret and Zenith sign-in", () => {
    expect(() => securityConfigFromEnv({ MONEYMAP_MODE: "production" })).toThrow(/MONEYMAP_SECRET/);
    const base = { MONEYMAP_MODE: "production", ZENITH_OIDC_ISSUER: "https://id/", ZENITH_OIDC_AUDIENCE: "mm", ZENITH_OIDC_JWKS_URL: "https://id/jwks" };
    expect(() => securityConfigFromEnv({ ...base, MONEYMAP_SECRET: "short" })).toThrow(/32 characters/);
    expect(securityConfigFromEnv({ ...base, MONEYMAP_SECRET: "x".repeat(40) }).mode).toBe("production");
    expect(securityConfigFromEnv({}).mode).toBe("demo");
  });
});

describe("headers, limits and errors", () => {
  let app: FastifyInstance;
  let db: Db;
  beforeAll(async () => {
    db = openDb(":memory:");
    app = await buildApp(db, { security: { mode: "demo", corsOrigins: [], rateLimits: { auth: 3, general: 1000 } } });
    app.get("/page", async (_req, reply) => reply.type("text/html").send("<!doctype html><p>app</p>"));
    app.get("/api/v1/boom", async () => {
      throw new Error("db password is hunter2");
    });
  });
  afterAll(async () => {
    await app.close();
    db.close();
  });

  it("API responses are not cacheable and not sniffable; the app page gets a strict CSP", async () => {
    const api = await app.inject({ method: "GET", url: "/api/v1/products" });
    expect(api.headers["cache-control"]).toBe("no-store");
    expect(api.headers["x-content-type-options"]).toBe("nosniff");
    expect(api.headers["x-frame-options"]).toBe("DENY");
    const page = await app.inject({ method: "GET", url: "/page" });
    expect(page.headers["content-security-policy"]).toMatch(/script-src 'self'; .*frame-ancestors 'none'/);
  });

  it("limits sign-in attempts per client", async () => {
    const tries = [];
    for (let i = 0; i < 4; i++) tries.push(await app.inject({ method: "POST", url: "/api/v1/demo/session", payload: { customer_id: "CUST_SARAH" } }));
    expect(tries.slice(0, 3).every((r) => r.statusCode === 200)).toBe(true);
    expect(tries[3].statusCode).toBe(429);
    expect(Number(tries[3].headers["retry-after"])).toBeGreaterThan(0);
  });

  it("refuses oversized bodies before parsing them", async () => {
    const big = JSON.stringify({ customer_id: "x".repeat(100_000) });
    expect((await app.inject({ method: "POST", url: "/api/v1/products/ZEN_SAVE4ME/eligibility-check", headers: { "content-type": "application/json" }, payload: big })).statusCode).toBe(413);
  });

  it("never shows internal error details", async () => {
    const r = await app.inject({ method: "GET", url: "/api/v1/boom" });
    expect(r.statusCode).toBe(500);
    expect(r.body).not.toMatch(/hunter2/);
    expect(r.json().error).toBe("server_error");
  });
});
