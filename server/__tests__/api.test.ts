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
    const h = await session("CUST_SARAH");
    const r = (await recommend(h)).json();
    expect(r.decision.product.id).toBe("ZEN_SAVE4ME");
    const ex = (await app.inject({ method: "GET", url: `/api/v1/recommendations/${r.recommendation.id}/explanation`, headers: h })).json();
    expect(ex.explanation.whyItFits).toBe(r.engine.explanation.whyItFits);
    expect(ex.trace.at(-1).result).toMatch(/SAVE4ME/);
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
    const tolu = await session("CUST_TOLU");
    expect((await app.inject({ method: "GET", url: `/api/v1/recommendations/${rec.id}`, headers: tolu })).statusCode).toBe(404);
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
    const h = await session("CUST_SARAH");
    const preview = (await app.inject({ method: "GET", url: "/api/v1/customer/moneymap?requested_more=true", headers: h })).json();
    expect(preview.top.product.product_id).toBe("ZEN_SAVE4ME");
    expect((await app.inject({ method: "GET", url: "/api/v1/recommendations", headers: h })).json()).toHaveLength(0);
  });
});

describe("transactions (step 2)", () => {
  it("serves the statement with raw narration, category and readable description", async () => {
    const h = await session("CUST_TOLU");
    const r = (await app.inject({ method: "GET", url: "/api/v1/customer/transactions?limit=500", headers: h })).json();
    expect(r.count).toBeGreaterThan(50);
    const salary = r.transactions.find((t: { narration: string }) => /SALARY/.test(t.narration));
    expect(salary).toMatchObject({ direction: "credit", category: "salary" });
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

describe("event triggers (step 3)", () => {
  const simulate = (h: Record<string, string>, type: "income" | "windfall") =>
    app.inject({ method: "POST", url: "/api/v1/demo/events", headers: h, payload: { type } });

  it("Sarah's salary landing issues SAVE4ME with a payday reason and one message", async () => {
    const h = await session("CUST_SARAH");
    const r = (await simulate(h, "income")).json();
    expect(r.trigger).toMatchObject({ type: "income_received", amount: 450000 });
    expect(r.transaction.narration).toMatch(/BRIGHTPATH LOGISTICS LTD\/SALARY OCT 2026/);
    expect(r.event.outcome).toBe("notified");
    expect(r.notification).toMatchObject({ kind: "new_recommendation", product_id: "ZEN_SAVE4ME" });
    const ex = (await app.inject({ method: "GET", url: `/api/v1/recommendations/${r.notification.recommendation_id}/explanation`, headers: h })).json();
    expect(ex.explanation.whyNow).toMatch(/just arrived/);
    expect((await app.inject({ method: "GET", url: "/api/v1/notifications", headers: h })).json()).toHaveLength(1);
  });

  it("sends at most one message a week, and logs why it stayed quiet", async () => {
    const h = await session("CUST_SARAH");
    await simulate(h, "income");
    const second = (await simulate(h, "windfall")).json();
    expect(second.trigger.type).toBe("windfall");
    expect(second.event).toMatchObject({ outcome: "held_back" });
    expect(second.event.reason).toMatch(/at most one a week/);
    expect(second.notification).toBeNull();
    expect((await app.inject({ method: "GET", url: "/api/v1/events", headers: h })).json()).toHaveLength(2);
  });

  it("Tolu's bonus is noticed but nothing is sent, because nothing would help", async () => {
    const h = await session("CUST_TOLU");
    const r = (await simulate(h, "windfall")).json();
    expect(r.trigger.type).toBe("windfall");
    expect(r.event.outcome).toBe("held_back");
    expect(r.notification).toBeNull();
    expect((await app.inject({ method: "GET", url: "/api/v1/recommendations", headers: h })).json()).toHaveLength(0);
  });

  it("doesn't act on money coming in without income permission", async () => {
    const h = await session("CUST_SARAH");
    await app.inject({ method: "POST", url: "/api/v1/consent", headers: h, payload: { income_patterns: false } });
    const r = (await simulate(h, "income")).json();
    expect(r.event.outcome).toBe("held_back");
    expect(r.event.reason).toMatch(/haven't shared income/);
  });

  it("the bank feed is admin-only, validated, and ignores everyday spending", async () => {
    const h = await session("CUST_SARAH");
    const line = { customer_id: "CUST_SARAH", narration: "POS/SHOPRITE LEKKI/LA NG", amount: 12500, direction: "debit", channel: "pos" };
    expect((await app.inject({ method: "POST", url: "/api/v1/events/transactions", headers: h, payload: line })).statusCode).toBe(403);
    const a = await admin();
    const ok = await app.inject({ method: "POST", url: "/api/v1/events/transactions", headers: a, payload: line });
    expect(ok.statusCode).toBe(201);
    expect(ok.json().trigger).toBeNull();
    expect((await app.inject({ method: "POST", url: "/api/v1/events/transactions", headers: a, payload: { ...line, amount: -5 } })).statusCode).toBe(400);
    expect((await app.inject({ method: "GET", url: "/api/v1/admin/events", headers: a })).statusCode).toBe(200);
  });

  it("a fresh demo session clears live lines, events and messages", async () => {
    let h = await session("CUST_SARAH");
    await simulate(h, "income");
    h = await session("CUST_SARAH");
    expect((await app.inject({ method: "GET", url: "/api/v1/notifications", headers: h })).json()).toHaveLength(0);
    const t = (await app.inject({ method: "GET", url: "/api/v1/customer/transactions?limit=1", headers: h })).json();
    expect(t.transactions[0].id).not.toMatch(/^LIVE_/);
  });
});

describe("integrations in demo mode (step 4)", () => {
  it("every adapter reports demo mode, and requests get a demo reference", async () => {
    const h = await session("CUST_SARAH");
    const a = (await app.inject({ method: "POST", url: "/api/v1/products/ZEN_SAVE4ME/apply", headers: h, payload: {} })).json();
    expect(a).toMatchObject({ handoff: "handed_off", reference: expect.stringMatching(/^DEMO-/) });
    const status = (await app.inject({ method: "GET", url: "/api/v1/admin/integrations", headers: await admin() })).json();
    expect(status.adapters.map((x: { name: string; mode: string }) => `${x.name}:${x.mode}`)).toEqual([
      "identity:demo",
      "core_banking:demo",
      "notifications:demo",
      "applications:demo",
    ]);
    expect(status.inbound_feed.signed_webhooks).toBe(false);
  });

  it("refuses signed webhooks when no secret is configured", async () => {
    const r = await app.inject({
      method: "POST",
      url: "/api/v1/events/transactions",
      headers: { "content-type": "application/json", "x-moneymap-signature": "sha256=00", "x-moneymap-timestamp": String(Math.floor(Date.now() / 1000)) },
      payload: JSON.stringify({ customer_id: "CUST_SARAH", narration: "POS/X/LA NG", amount: 100, direction: "debit", channel: "pos" }),
    });
    expect(r.statusCode).toBe(401);
  });
});

describe("data rights (step 5)", () => {
  it("exports everything MoneyMap holds, as a downloadable document", async () => {
    const h = await session("CUST_SARAH");
    await app.inject({ method: "POST", url: "/api/v1/demo/events", headers: h, payload: { type: "income" } });
    const r = await app.inject({ method: "GET", url: "/api/v1/customer/data-export", headers: h });
    expect(r.headers["content-disposition"]).toMatch(/attachment; filename="moneymap-data-CUST_SARAH.json"/);
    const d = r.json();
    expect(d.consent.current.income_patterns).toBe(true);
    expect(d.goals).toHaveLength(1);
    expect(d.recommendations).toHaveLength(1);
    expect(d.messages).toHaveLength(1);
  });

  it("erases it on request and keeps only the fact of erasure in the audit log", async () => {
    const h = await session("CUST_SARAH");
    await app.inject({ method: "POST", url: "/api/v1/demo/events", headers: h, payload: { type: "income" } });
    expect((await app.inject({ method: "DELETE", url: "/api/v1/customer/data", headers: h })).statusCode).toBe(204);
    const d = (await app.inject({ method: "GET", url: "/api/v1/customer/data-export", headers: h })).json();
    expect(d.goals).toHaveLength(0);
    expect(d.recommendations).toHaveLength(0);
    expect(d.messages).toHaveLength(0);
    expect(Object.values(d.consent.current).some(Boolean)).toBe(false);
    expect(d.statement.lines).toBe(db.getTransactions("CUST_SARAH").filter((t) => !t.id.startsWith("LIVE_")).length);
    const audit = (await app.inject({ method: "GET", url: "/api/v1/admin/audit", headers: await admin() })).json();
    expect(audit.entries.some((e: { action: string }) => e.action === "customer.data_erased")).toBe(true);
  });

  it("the audit log holds no amounts or bank narrations", async () => {
    const h = await session("CUST_SARAH");
    await app.inject({ method: "POST", url: "/api/v1/demo/events", headers: h, payload: { type: "income" } });
    await app.inject({ method: "POST", url: "/api/v1/demo/events", headers: h, payload: { type: "windfall" } });
    const audit = (await app.inject({ method: "GET", url: "/api/v1/admin/audit", headers: await admin() })).json();
    const text = audit.entries.map((e: { detail: string }) => e.detail).join("\n");
    expect(text).not.toMatch(/450000|900000|₦|BRIGHTPATH|Brightpath/);
  });
});

describe("the customer's own answers", () => {
  const answers = {
    accounts: [{ kind: "personal", amount: { kind: "exact", value: 120000 } }],
    fixedIncome: { kind: "exact", value: 300000 },
    variableIncome: [{ title: "Hair business", amount: { kind: "range", min: 50000, max: 150000 } }],
    expenses: { mode: "itemised", items: [{ category: "Food", amount: { kind: "range", min: 60000, max: 80000 } }, { category: "Rent", amount: { kind: "unsure" } }] },
  };

  it("are saved, used where the statement isn't shared, exported and erased", async () => {
    const h = await session("CUST_TOLU", false);
    await app.inject({ method: "POST", url: "/api/v1/consent", headers: h, payload: { financial_goals: true } });
    const put = await app.inject({ method: "PUT", url: "/api/v1/customer/self-report", headers: h, payload: answers });
    expect(put.statusCode).toBe(200);
    expect(put.json().updatedAt).toBeTruthy();
    const ctx = (await app.inject({ method: "GET", url: "/api/v1/customer/financial-context", headers: h })).json();
    expect(ctx.context.income.average).toBe(400000);
    expect(ctx.context.signals.some((s: { source: string }) => s.source === "self_reported")).toBe(true);
    expect((await app.inject({ method: "GET", url: "/api/v1/customer/data-export", headers: h })).json().your_answers.fixedIncome.value).toBe(300000);
    await app.inject({ method: "DELETE", url: "/api/v1/customer/data", headers: h });
    expect((await app.inject({ method: "GET", url: "/api/v1/customer/self-report", headers: h })).json()).toBeNull();
  });

  it("rejects malformed answers: backwards ranges, negative amounts, unknown fields", async () => {
    const h = await session("CUST_TOLU", false);
    for (const bad of [
      { ...answers, fixedIncome: { kind: "range", min: 200000, max: 100000 } },
      { ...answers, fixedIncome: { kind: "exact", value: -5 } },
      { ...answers, accounts: [{ kind: "crypto", amount: { kind: "unsure" } }] },
      { ...answers, extra: true },
    ]) {
      expect((await app.inject({ method: "PUT", url: "/api/v1/customer/self-report", headers: h, payload: bad })).statusCode).toBe(400);
    }
  });

  it("never put amounts in the audit log", async () => {
    const h = await session("CUST_TOLU", false);
    await app.inject({ method: "PUT", url: "/api/v1/customer/self-report", headers: h, payload: answers });
    const audit = (await app.inject({ method: "GET", url: "/api/v1/admin/audit", headers: await admin() })).json();
    const entry = audit.entries.find((e: { action: string }) => e.action === "self_report.updated");
    expect(entry.detail).toBe("CUST_TOLU: accounts, fixed income, variable income, expenses");
  });
});
