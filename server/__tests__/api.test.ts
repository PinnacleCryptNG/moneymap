import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app";
import { openDb, type Db } from "../db";

let app: FastifyInstance;
let db: Db;

beforeAll(async () => {
  db = openDb(":memory:");
  app = await buildApp(db);
});
afterAll(async () => {
  await app.close();
  db.close();
});

async function session(customer_id: string, preload = true) {
  const r = await app.inject({ method: "POST", url: "/api/v1/demo/session", payload: { customer_id, preload } });
  expect(r.statusCode).toBe(200);
  return { authorization: `Bearer ${r.json().token}` };
}
async function admin() {
  const r = await app.inject({ method: "POST", url: "/api/v1/auth/demo-login", payload: { role: "admin" } });
  return { authorization: `Bearer ${r.json().token}` };
}
const recommend = (headers: Record<string, string>, payload = {}) => app.inject({ method: "POST", url: "/api/v1/recommendations", headers, payload });

describe("auth", () => {
  it("rejects customer endpoints without a token", async () => {
    expect((await recommend({})).statusCode).toBe(401);
  });
  it("rejects a tampered token", async () => {
    const { authorization } = await session("CUST_SARAH");
    const bad = authorization.slice(0, -2) + (authorization.endsWith("A") ? "BB" : "AA");
    expect((await recommend({ authorization: bad })).statusCode).toBe(401);
  });
  it("keeps customers out of admin endpoints", async () => {
    const h = await session("CUST_SARAH");
    expect((await app.inject({ method: "GET", url: "/api/v1/admin/audit", headers: h })).statusCode).toBe(403);
  });
});

describe("recommendations", () => {
  it("Sarah gets SAVE4ME, stored with the Phase 2 record fields", async () => {
    const h = await session("CUST_SARAH");
    const r = (await recommend(h)).json();
    expect(r.decision.status).toBe("recommended");
    expect(r.decision.product.id).toBe("ZEN_SAVE4ME");
    expect(r.recommendation).toMatchObject({ customer_id: "CUST_SARAH", product_id: "ZEN_SAVE4ME", need: "goal_saving", eligibility_status: "eligible" });
    expect(r.recommendation.reasons.length).toBeGreaterThan(0);
    expect(r.recommendation.timing_reason).toBeTruthy();
  });

  it("does not duplicate an open recommendation", async () => {
    const h = await session("CUST_SARAH");
    await recommend(h);
    await recommend(h);
    const list = (await app.inject({ method: "GET", url: "/api/v1/recommendations", headers: h })).json();
    expect(list).toHaveLength(1);
  });

  it("returns the stored explanation exactly as shown", async () => {
    const h = await session("CUST_DANIEL");
    const r = (await recommend(h)).json();
    expect(r.decision.product.id).toBe("ZEN_ASPIRE");
    const ex = (await app.inject({ method: "GET", url: `/api/v1/recommendations/${r.recommendation.id}/explanation`, headers: h })).json();
    expect(ex.explanation.whyItFits).toBe(r.engine.explanation.whyItFits);
    expect(ex.trace.at(-1).result).toMatch(/Aspire/);
  });

  it("Tolu gets no recommendation and nothing is stored", async () => {
    const h = await session("CUST_TOLU");
    const r = (await recommend(h)).json();
    expect(r.decision.status).toBe("no_match");
    expect(r.recommendation).toBeNull();
  });

  it("customers can't read each other's recommendations", async () => {
    const sarah = await session("CUST_SARAH");
    const rec = (await recommend(sarah)).json().recommendation;
    const daniel = await session("CUST_DANIEL");
    expect((await app.inject({ method: "GET", url: `/api/v1/recommendations/${rec.id}`, headers: daniel })).statusCode).toBe(404);
  });

  it("'Not relevant' feedback stops the product coming back", async () => {
    const h = await session("CUST_SARAH");
    const rec = (await recommend(h)).json().recommendation;
    const fb = await app.inject({ method: "POST", url: `/api/v1/recommendations/${rec.id}/feedback`, headers: h, payload: { feedback: "not_relevant" } });
    expect(fb.json().status).toBe("dismissed");
    const again = (await recommend(h)).json();
    expect(again.decision.product?.id).not.toBe("ZEN_SAVE4ME");
  });
});

describe("consent enforcement", () => {
  it("withdrawing everything removes all signals and the recommendation", async () => {
    const h = await session("CUST_SARAH");
    await app.inject({
      method: "POST",
      url: "/api/v1/consent",
      headers: h,
      payload: { account_activity: false, income_patterns: false, spending_patterns: false, existing_products: false, financial_goals: false },
    });
    const ctx = (await app.inject({ method: "GET", url: "/api/v1/customer/financial-context", headers: h })).json();
    expect(ctx.context.signals).toHaveLength(0);
    expect(ctx.context.income).toBeNull();
    const profile = (await app.inject({ method: "GET", url: "/api/v1/customer/profile", headers: h })).json();
    expect(profile.recent_transactions).toBeNull();
    expect((await recommend(h)).json().decision.status).toBe("no_match");
    const history = (await app.inject({ method: "GET", url: "/api/v1/consent", headers: h })).json().history;
    expect(history.length).toBeGreaterThanOrEqual(5);
  });
});

describe("goals and validation", () => {
  it("rejects invalid goals", async () => {
    const h = await session("CUST_TOLU");
    const tiny = await app.inject({ method: "POST", url: "/api/v1/goals", headers: h, payload: { type: "save_more", label: "x", amount: 5, timeline_months: 12 } });
    expect(tiny.statusCode).toBe(400);
    const long = await app.inject({ method: "POST", url: "/api/v1/goals", headers: h, payload: { type: "save_more", label: "x", amount: 50000, timeline_months: 999 } });
    expect(long.statusCode).toBe(400);
    const extra = await app.inject({ method: "POST", url: "/api/v1/goals", headers: h, payload: { type: "save_more", label: "x", amount: 50000, timeline_months: 12, hack: true } });
    expect(extra.statusCode).toBe(400);
  });

  it("a new car goal changes Tolu's answer to Asset Finance", async () => {
    const h = await session("CUST_TOLU");
    const g = await app.inject({
      method: "POST",
      url: "/api/v1/goals",
      headers: h,
      payload: { type: "major_expense", expense_kind: "vehicle", label: "Buy a car", amount: 6_000_000, timeline_months: 12 },
    });
    expect(g.statusCode).toBe(201);
    expect((await recommend(h)).json().decision.product.id).toBe("ZEN_ASSET_FINANCE");
  });
});

describe("PRD entities", () => {
  it("stores reasons, feedback history, interactions, profile, signals and the model version", async () => {
    const h = await session("CUST_SARAH");
    const rec = (await recommend(h)).json().recommendation;

    const detail = (await app.inject({ method: "GET", url: `/api/v1/recommendations/${rec.id}`, headers: h })).json();
    expect(detail.reason_details.map((r: { label: string }) => r.label)).toContain("Your goal");

    await app.inject({ method: "POST", url: `/api/v1/recommendations/${rec.id}/feedback`, headers: h, payload: { feedback: "not_understood" } });
    await app.inject({ method: "POST", url: `/api/v1/recommendations/${rec.id}/feedback`, headers: h, payload: { feedback: "useful" } });
    const after = (await app.inject({ method: "GET", url: `/api/v1/recommendations/${rec.id}`, headers: h })).json();
    expect(after.feedback_history.map((f: { feedback: string }) => f.feedback)).toEqual(["not_understood", "useful"]);

    await app.inject({ method: "GET", url: "/api/v1/products/ZEN_SAVE4ME", headers: h });
    await app.inject({ method: "POST", url: "/api/v1/products/ZEN_SAVE4ME/eligibility-check", headers: h });
    await app.inject({ method: "POST", url: "/api/v1/products/ZEN_SAVE4ME/apply", headers: h });
    const a = await admin();
    const metrics = (await app.inject({ method: "GET", url: "/api/v1/admin/metrics", headers: a })).json();
    const kinds = metrics.interactions.filter((i: { product_id: string }) => i.product_id === "ZEN_SAVE4ME").map((i: { interaction: string }) => i.interaction);
    expect(kinds).toEqual(expect.arrayContaining(["viewed", "eligibility_checked", "requested"]));

    const sig = (await app.inject({ method: "GET", url: "/api/v1/customer/signals", headers: h })).json();
    expect(sig.financial_profile.income_avg).toBe(450000);
    expect(sig.signals.map((x: { signal: string }) => x.signal)).toContain("regular_surplus");

    const models = (await app.inject({ method: "GET", url: "/api/v1/admin/model-versions", headers: a })).json();
    expect(models[0].weights.needFit).toBe(0.3);
  });

  it("withdrawing consent removes stored signals and profile values", async () => {
    const h = await session("CUST_SARAH");
    await app.inject({ method: "POST", url: "/api/v1/consent", headers: h, payload: { income_patterns: false, spending_patterns: false } });
    const sig = (await app.inject({ method: "GET", url: "/api/v1/customer/signals", headers: h })).json();
    expect(sig.financial_profile.income_avg).toBeNull();
    expect(sig.signals.some((x: { source_permission: string }) => x.source_permission === "income_patterns")).toBe(false);
  });

  it("publishes product eligibility conditions with their basis", async () => {
    const p = (await app.inject({ method: "GET", url: "/api/v1/products/ZEN_ASPIRE" })).json();
    const seg = p.eligibility_conditions.find((c: { condition: string }) => c.condition === "segments");
    expect(seg).toMatchObject({ basis: "published", value: ["student"] });
  });

  it("serves the MoneyMap preview without issuing a recommendation", async () => {
    const h = await session("CUST_DANIEL");
    const preview = (await app.inject({ method: "GET", url: "/api/v1/customer/moneymap?requested_more=true", headers: h })).json();
    expect(preview.top.product.product_id).toBe("ZEN_ASPIRE");
    expect((await app.inject({ method: "GET", url: "/api/v1/recommendations", headers: h })).json()).toHaveLength(0);
  });
});

describe("transactions (step 2)", () => {
  it("serves the statement with raw narration, category and readable description", async () => {
    const h = await session("CUST_DANIEL");
    const r = (await app.inject({ method: "GET", url: "/api/v1/customer/transactions?limit=500", headers: h })).json();
    expect(r.count).toBeGreaterThan(100);
    const allowance = r.transactions.find((t: { narration: string }) => /ALLOWANCE/.test(t.narration));
    expect(allowance).toMatchObject({ direction: "credit", category: "allowance" });
    expect(r.transactions.some((t: { category: string }) => t.category === "education")).toBe(true);
  });

  it("hides money-out lines when account activity isn't shared", async () => {
    const h = await session("CUST_SARAH");
    await app.inject({ method: "POST", url: "/api/v1/consent", headers: h, payload: { account_activity: false } });
    const r = (await app.inject({ method: "GET", url: "/api/v1/customer/transactions", headers: h })).json();
    expect(r.transactions.every((t: { direction: string }) => t.direction === "credit")).toBe(true);
  });

  it("derives figures from the stored rows: new transactions change the answer", async () => {
    const h = await session("CUST_SARAH");
    const before = (await app.inject({ method: "GET", url: "/api/v1/customer/signals", headers: h })).json();
    expect(before.financial_profile.surplus_avg).toBe(170000);
    for (const m of ["04", "05", "06", "07", "08", "09"]) {
      db.raw
        .prepare("INSERT INTO transactions (id, customer_id, date, narration, amount, direction, channel) VALUES (?, 'CUST_SARAH', ?, 'NIP TRF TO NEW LANDLORD/RENT TOP UP', 160000, 'debit', 'transfer')")
        .run(`TEST-${m}`, `2026-${m}-26`);
    }
    const after = (await app.inject({ method: "GET", url: "/api/v1/customer/signals", headers: h })).json();
    expect(after.financial_profile.surplus_avg).toBe(10000);
    expect(after.signals.some((x: { signal: string }) => x.signal === "regular_surplus")).toBe(false);
    db.raw.prepare("DELETE FROM transactions WHERE id LIKE 'TEST-%'").run();
  });
});

describe("products and governance", () => {
  it("records a product request without opening anything", async () => {
    const h = await session("CUST_SARAH");
    const r = await app.inject({ method: "POST", url: "/api/v1/products/ZEN_SAVE4ME/apply", headers: h });
    expect(r.statusCode).toBe(201);
    expect(r.json().status).toBe("submitted");
  });

  it("a deactivated product is never recommended, and the change is versioned", async () => {
    const a = await admin();
    const off = await app.inject({ method: "PATCH", url: "/api/v1/admin/products/ZEN_SAVE4ME", headers: a, payload: { status: "inactive" } });
    expect(off.json().version).toBe(2);
    const h = await session("CUST_SARAH");
    expect((await recommend(h)).json().decision.product?.id).not.toBe("ZEN_SAVE4ME");
    await app.inject({ method: "PATCH", url: "/api/v1/admin/products/ZEN_SAVE4ME", headers: a, payload: { status: "active" } });
  });

  it("keeps a hash-chained audit log that detects tampering", async () => {
    const a = await admin();
    const ok = (await app.inject({ method: "GET", url: "/api/v1/admin/audit", headers: a })).json();
    expect(ok.integrity.intact).toBe(true);
    expect(ok.entries.length).toBeGreaterThan(5);
    db.raw.exec("UPDATE audit_log SET detail = 'edited' WHERE seq = 2");
    const bad = (await app.inject({ method: "GET", url: "/api/v1/admin/audit", headers: a })).json();
    expect(bad.integrity.intact).toBe(false);
    expect(bad.integrity.brokenAt).toBe(2);
  });

  it("serves the OpenAPI document", async () => {
    const r = await app.inject({ method: "GET", url: "/docs/json" });
    expect(r.statusCode).toBe(200);
    expect(Object.keys(r.json().paths)).toContain("/api/v1/recommendations");
  });
});
