// MoneyMap REST API (PRD §38) — Fastify with OpenAPI documentation at /docs.
import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import { DEFAULT_PREFERENCES } from "../src/data/defaults";
import { MODEL_VERSION, REMIND_LATER_DAYS, THRESHOLDS, WEIGHTS, runEngine, toApiResponse, toRecord, type EngineResult } from "../src/engine";
import { simulateCohort } from "../src/services/analytics";
import type { AppNotification, Channel, FeedbackType, GoalDraft, Permissions, Preferences, RawTransaction, Trigger } from "../src/types";
import { decideOnTrigger, detectTrigger, simulatedCredit } from "../src/engine/triggers";
import { GOAL_LIMITS } from "../src/utils/goals";
import { DEMO_TODAY } from "../src/data/ledgers";
import { categorise, describe } from "../src/engine/ledger";
import { issueToken, verifyToken, type Session } from "./auth";
import { publicProfile, redactProfile } from "./consent";
import { PERMISSION_KEYS, type Db } from "./db";

declare module "fastify" {
  interface FastifyRequest {
    session: Session | null;
  }
}

const GOAL_TYPES = ["save_more", "grow_money", "major_expense", "everyday", "grow_business", "protect", "not_sure"];
const EXPENSE_KINDS = ["rent", "school_fees", "wedding", "vehicle", "equipment", "other"];
const FEEDBACK: FeedbackType[] = ["useful", "not_relevant", "not_understood", "not_wanted", "remind_later"];
const CATEGORIES = ["savings", "accounts", "financing", "cards"];

const permissionsSchema = {
  type: "object",
  additionalProperties: false,
  properties: Object.fromEntries(PERMISSION_KEYS.map((k) => [k, { type: "boolean" }])),
} as const;

const goalBody = {
  type: "object",
  additionalProperties: false,
  required: ["type", "label", "timeline_months"],
  properties: {
    type: { type: "string", enum: GOAL_TYPES },
    label: { type: "string", minLength: 1, maxLength: 80 },
    amount: { type: "integer", minimum: 0, maximum: GOAL_LIMITS.maxAmount },
    timeline_months: { type: "integer", minimum: GOAL_LIMITS.minMonths, maximum: GOAL_LIMITS.maxMonths },
    saved: { type: "integer", minimum: 0, maximum: GOAL_LIMITS.maxAmount },
    expense_kind: { type: "string", enum: EXPENSE_KINDS },
    active: { type: "boolean" },
  },
} as const;

interface GoalBody {
  type: GoalDraft["type"];
  label: string;
  amount?: number;
  timeline_months: number;
  saved?: number;
  expense_kind?: GoalDraft["expenseKind"];
  active?: boolean;
}

const fail = (reply: FastifyReply, code: number, error: string, message: string) => reply.code(code).send({ error, message });

export async function buildApp(db: Db, opts: { logger?: boolean } = {}) {
  const app = Fastify({ logger: opts.logger ?? false, ajv: { customOptions: { removeAdditional: false, coerceTypes: false } } });

  await app.register(cors, { origin: true });
  await app.register(swagger, {
    openapi: {
      info: {
        title: "MoneyMap API",
        version: "2.0.0",
        description:
          "Decision layer for intelligent product matching (Zenith Bank Zecathon 6.0, Challenge #9). Prototype on synthetic data. " +
          "Get a token from POST /api/v1/demo/session (customer) or POST /api/v1/auth/demo-login (admin), then click Authorize.",
      },
      components: { securitySchemes: { bearer: { type: "http", scheme: "bearer" } } },
      tags: [
        { name: "Demo & auth", description: "Demo sessions. In production MoneyMap reuses the Zenith app's sign-in." },
        { name: "Customer" },
        { name: "Consent" },
        { name: "Goals" },
        { name: "Recommendations" },
        { name: "Products" },
        { name: "Preferences" },
        { name: "Events", description: "Step 3: new account activity triggers a fresh look. MoneyMap messages the customer only when the engine finds a strong reason." },
        { name: "Bank (admin)" },
      ],
    },
  });
  await app.register(swaggerUi, { routePrefix: "/docs" });

  app.decorateRequest("session", null);
  app.addHook("onRequest", async (req) => {
    const h = req.headers.authorization;
    req.session = verifyToken(h?.startsWith("Bearer ") ? h.slice(7) : undefined);
  });

  const customerOnly = async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.session || req.session.role !== "customer") return fail(reply, 401, "unauthorized", "Sign in as a customer first.");
    if (!db.getCustomer(req.session.sub)) return fail(reply, 401, "unauthorized", "Unknown customer.");
  };
  const adminOnly = async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.session || req.session.role !== "admin") return fail(reply, 403, "forbidden", "Bank admin access required.");
  };
  const secured = { security: [{ bearer: [] }] };

  db.registerModelVersion(MODEL_VERSION, WEIGHTS, THRESHOLDS, "Transparent rules + weighted scoring (prototype weights, PRD §28).");

  /** Run the decision engine for a customer on consent-filtered data, and persist the resulting profile and signals. */
  function evaluate(customerId: string, requestedMore = false, trigger: Trigger | null = null): EngineResult {
    const permissions = db.getPermissions(customerId);
    const result = runEngine({
      customer: redactProfile(db.getCustomer(customerId)!, permissions),
      permissions,
      goal: db.activeGoal(customerId),
      preferences: db.getPreferences(customerId),
      products: db.listProducts(),
      history: db.listRecommendations(customerId),
      requestedMore,
      trigger,
    });
    db.saveFinancialSnapshot(customerId, result.context);
    return result;
  }

  const goalOut = (g: ReturnType<Db["listGoals"]>[number]) => ({
    id: g.id,
    type: g.type,
    label: g.label,
    amount: g.amount,
    timeline_months: g.timelineMonths,
    saved: g.saved,
    expense_kind: g.expenseKind ?? null,
    active: g.active,
    created_at: g.createdAt,
  });

  // ---------------- Health ----------------
  app.get("/api/v1/health", { schema: { hide: true } }, async () => ({ status: "ok", audit: db.verifyAudit() }));

  // ---------------- Demo & auth ----------------
  app.post<{ Body: { customer_id: string; preload?: boolean } }>(
    "/api/v1/demo/session",
    {
      schema: {
        tags: ["Demo & auth"],
        summary: "Start a demo session as a synthetic customer",
        description: "preload=true loads the full context instantly (all permissions granted, default goal) — Demo Mode. preload=false starts fresh for onboarding.",
        body: {
          type: "object",
          required: ["customer_id"],
          additionalProperties: false,
          properties: { customer_id: { type: "string" }, preload: { type: "boolean" } },
        },
      },
    },
    async (req, reply) => {
      const c = db.getCustomer(req.body.customer_id);
      if (!c) return fail(reply, 404, "not_found", "No such demo customer.");
      db.resetCustomer(c.id);
      if (req.body.preload) {
        db.setPermissions(c.id, Object.fromEntries(PERMISSION_KEYS.map((k) => [k, true])) as Permissions);
        if (c.defaultGoal) db.createGoal(c.id, c.defaultGoal);
      }
      db.audit("system", "demo.session_started", `${c.id}${req.body.preload ? " (preloaded)" : ""}`);
      return { token: issueToken(c.id, "customer"), customer_id: c.id };
    },
  );

  app.post<{ Body: { role: "admin" } }>(
    "/api/v1/auth/demo-login",
    {
      schema: {
        tags: ["Demo & auth"],
        summary: "Get a bank-admin token (demo)",
        body: { type: "object", required: ["role"], additionalProperties: false, properties: { role: { type: "string", enum: ["admin"] } } },
      },
    },
    async () => ({ token: issueToken("zenith-admin", "admin") }),
  );

  app.get("/api/v1/demo/customers", { schema: { tags: ["Demo & auth"], summary: "List synthetic demo customers" } }, async () =>
    db.listCustomers().map((c) => ({ id: c.id, name: c.name, age: c.age, persona: c.persona, expected_outcome: c.expectedOutcome, transactions: db.getTransactions(c.id).length })),
  );

  app.post("/api/v1/demo/reset", { preHandler: adminOnly, schema: { tags: ["Demo & auth"], summary: "Reset all demo data", ...secured } }, async () => {
    db.resetAll();
    return { status: "reset" };
  });

  // ---------------- Customer ----------------
  app.get("/api/v1/customer/profile", { preHandler: customerOnly, schema: { tags: ["Customer"], summary: "Customer profile (consent-filtered)", ...secured } }, async (req) => {
    const id = req.session!.sub;
    return publicProfile(db.getCustomer(id)!, db.getPermissions(id));
  });

  app.get(
    "/api/v1/customer/financial-context",
    {
      preHandler: customerOnly,
      schema: { tags: ["Customer"], summary: "Financial context, signals and needs — built only from permitted data", ...secured },
    },
    async (req) => {
      const r = evaluate(req.session!.sub);
      return { context: r.context, needs: r.needs };
    },
  );

  app.get<{ Querystring: { requested_more?: "true" | "false" } }>(
    "/api/v1/customer/moneymap",
    {
      preHandler: customerOnly,
      schema: {
        tags: ["Customer"],
        summary: "The MoneyMap screen: where you are, your next move, your goal",
        description: "Runs the engine as a preview. It does not issue or store a recommendation — use POST /recommendations for that.",
        querystring: { type: "object", additionalProperties: false, properties: { requested_more: { type: "string", enum: ["true", "false"] } } },
        ...secured,
      },
    },
    async (req) => evaluate(req.session!.sub, req.query.requested_more === "true"),
  );

  app.get<{ Querystring: { limit?: string } }>(
    "/api/v1/customer/transactions",
    {
      preHandler: customerOnly,
      schema: {
        tags: ["Customer"],
        summary: "The customer's statement, as MoneyMap reads it",
        description:
          "Each line keeps the bank's raw narration plus the category and readable description MoneyMap derived from it. " +
          "Money in needs income_patterns; money out needs account_activity.",
        querystring: { type: "object", additionalProperties: false, properties: { limit: { type: "string", pattern: "^[0-9]{1,4}$" } } },
        ...secured,
      },
    },
    async (req) => {
      const id = req.session!.sub;
      const p = db.getPermissions(id);
      const rows = db
        .getTransactions(id)
        .filter((t) => (t.direction === "credit" ? p.income_patterns : p.account_activity))
        .reverse()
        .slice(0, Number(req.query.limit ?? 100))
        .map((t) => ({ ...t, category: categorise(t), description: describe(t) }));
      return { as_of: DEMO_TODAY, count: rows.length, transactions: rows };
    },
  );

  app.get(
    "/api/v1/customer/signals",
    {
      preHandler: customerOnly,
      schema: { tags: ["Customer"], summary: "Stored financial profile and transaction signals (only from permitted data)", ...secured },
    },
    async (req) => {
      const id = req.session!.sub;
      evaluate(id);
      return { financial_profile: db.getFinancialProfile(id), signals: db.getSignals(id) };
    },
  );

  // ---------------- Consent ----------------
  app.get("/api/v1/consent", { preHandler: customerOnly, schema: { tags: ["Consent"], summary: "Current permissions and history", ...secured } }, async (req) => {
    const id = req.session!.sub;
    return { permissions: db.getPermissions(id), history: db.consentHistory(id) };
  });

  app.post<{ Body: Partial<Permissions> }>(
    "/api/v1/consent",
    {
      preHandler: customerOnly,
      schema: {
        tags: ["Consent"],
        summary: "Grant or withdraw permissions",
        description: "Withdrawn data stops being used for personalisation immediately. Every change is logged.",
        body: permissionsSchema,
        ...secured,
      },
    },
    async (req) => ({ permissions: db.setPermissions(req.session!.sub, req.body) }),
  );

  // ---------------- Goals ----------------
  app.get("/api/v1/goals", { preHandler: customerOnly, schema: { tags: ["Goals"], summary: "List goals", ...secured } }, async (req) =>
    db.listGoals(req.session!.sub).map(goalOut),
  );

  app.post<{ Body: GoalBody }>(
    "/api/v1/goals",
    { preHandler: customerOnly, schema: { tags: ["Goals"], summary: "Create a goal (becomes active)", body: goalBody, ...secured } },
    async (req, reply) => {
      const b = req.body;
      if (["save_more", "major_expense"].includes(b.type) && (b.amount ?? 0) < GOAL_LIMITS.minAmount) {
        return fail(reply, 400, "invalid_goal", `This goal needs an amount of at least ₦${GOAL_LIMITS.minAmount.toLocaleString()}.`);
      }
      const g = db.createGoal(req.session!.sub, {
        type: b.type,
        label: b.label,
        amount: b.amount ?? 0,
        timelineMonths: b.timeline_months,
        saved: b.saved ?? 0,
        expenseKind: b.type === "major_expense" ? (b.expense_kind ?? "other") : undefined,
      }, b.active ?? true);
      return reply.code(201).send(goalOut(g));
    },
  );

  app.patch<{ Params: { id: string }; Body: Partial<GoalBody> }>(
    "/api/v1/goals/:id",
    {
      preHandler: customerOnly,
      schema: { tags: ["Goals"], summary: "Update a goal", body: { ...goalBody, required: [] }, ...secured },
    },
    async (req, reply) => {
      const b = req.body;
      const g = db.updateGoal(req.session!.sub, req.params.id, {
        ...(b.type && { type: b.type }),
        ...(b.label && { label: b.label }),
        ...(b.amount !== undefined && { amount: b.amount }),
        ...(b.timeline_months !== undefined && { timelineMonths: b.timeline_months }),
        ...(b.saved !== undefined && { saved: b.saved }),
        ...(b.expense_kind && { expenseKind: b.expense_kind }),
        ...(b.active !== undefined && { active: b.active }),
      });
      return g ? goalOut(g) : fail(reply, 404, "not_found", "Goal not found.");
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/api/v1/goals/:id",
    { preHandler: customerOnly, schema: { tags: ["Goals"], summary: "Delete a goal", ...secured } },
    async (req, reply) => (db.deleteGoal(req.session!.sub, req.params.id) ? reply.code(204).send() : fail(reply, 404, "not_found", "Goal not found.")),
  );

  // ---------------- Events (step 3) ----------------
  /**
   * A new statement line arrives. Store it; if it is a trigger (income landing, a windfall), run the engine
   * again with that context and decide whether it deserves a message. Every trigger is logged with its outcome.
   */
  function ingest(customerId: string, t: Omit<RawTransaction, "id">) {
    const before = db.getCustomer(customerId)!;
    const transaction = db.addTransaction(customerId, t);
    const trigger = detectTrigger(transaction, before);
    if (!trigger) {
      db.audit("system", "transaction.received", `${customerId}: ${describe(transaction)} ${transaction.amount} (no trigger)`);
      return { transaction, trigger: null, event: null, notification: null };
    }
    const history = db.listRecommendations(customerId);
    const result = evaluate(customerId, false, trigger);
    const decision = decideOnTrigger({
      trigger,
      permissions: db.getPermissions(customerId),
      result,
      history,
      notifications: db.listNotifications(customerId),
      now: new Date(),
    });
    let draft: Omit<AppNotification, "id" | "customer_id" | "event_id" | "created_at"> | null = null;
    if (decision.outcome === "notified" && result.top) {
      const open = history.find((h) => h.product_id === result.top!.product.product_id && !h.feedback && h.status !== "applied");
      const record = open ?? db.insertRecommendation(toRecord(result, customerId)!, { explanation: result.explanation!, trace: result.trace, factors: result.top.factors });
      draft = {
        kind: decision.kind,
        title: decision.title,
        body: decision.body,
        product_id: result.top.product.product_id,
        product_name: result.top.product.name,
        recommendation_id: record.id,
      };
    }
    const saved = db.recordTrigger(customerId, transaction.id, trigger, decision, draft);
    return { transaction, trigger, event: saved.event, notification: saved.notification };
  }

  const CHANNELS: Channel[] = ["transfer", "pos", "web", "bill_payment", "atm", "standing_order"];
  app.post<{ Body: { customer_id: string; date?: string; narration: string; amount: number; direction: "credit" | "debit"; channel: Channel } }>(
    "/api/v1/events/transactions",
    {
      preHandler: adminOnly,
      schema: {
        tags: ["Events"],
        summary: "Core-banking feed: a new transaction for a customer",
        description:
          "In production a core-banking adapter would post each new statement line here. " +
          "Money landing (salary, allowance) or a one-off credit of at least half the usual monthly income is a trigger: " +
          "the engine runs again, and the customer gets a message only if there is a strong match, they share income data, and no message was sent in the last 7 days.",
        body: {
          type: "object",
          required: ["customer_id", "narration", "amount", "direction", "channel"],
          additionalProperties: false,
          properties: {
            customer_id: { type: "string" },
            date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
            narration: { type: "string", minLength: 3, maxLength: 140 },
            amount: { type: "integer", minimum: 1, maximum: 1000000000 },
            direction: { type: "string", enum: ["credit", "debit"] },
            channel: { type: "string", enum: CHANNELS },
          },
        },
        ...secured,
      },
    },
    async (req, reply) => {
      const { customer_id, date, ...rest } = req.body;
      if (!db.getCustomer(customer_id)) return fail(reply, 404, "not_found", "No such customer.");
      return reply.code(201).send(ingest(customer_id, { ...rest, date: date ?? DEMO_TODAY }));
    },
  );

  app.post<{ Body: { type: "income" | "windfall" } }>(
    "/api/v1/demo/events",
    {
      preHandler: customerOnly,
      schema: {
        tags: ["Events"],
        summary: "Demo Mode: simulate money arriving for the signed-in customer",
        description: "income = the customer's usual salary or allowance lands; windfall = a one-off bonus of about twice their usual monthly income.",
        body: { type: "object", required: ["type"], additionalProperties: false, properties: { type: { type: "string", enum: ["income", "windfall"] } } },
        ...secured,
      },
    },
    async (req, reply) => {
      const id = req.session!.sub;
      // The id is replaced when the line is stored.
      return reply.code(201).send(ingest(id, simulatedCredit(req.body.type, db.getCustomer(id)!, DEMO_TODAY, "pending")));
    },
  );

  app.get("/api/v1/events", { preHandler: customerOnly, schema: { tags: ["Events"], summary: "What MoneyMap noticed on the account, and what it decided", ...secured } }, async (req) =>
    db.listTriggerEvents(req.session!.sub),
  );

  app.get("/api/v1/notifications", { preHandler: customerOnly, schema: { tags: ["Events"], summary: "Messages MoneyMap sent the customer", ...secured } }, async (req) =>
    db.listNotifications(req.session!.sub),
  );

  app.post<{ Params: { id: string } }>(
    "/api/v1/notifications/:id/read",
    { preHandler: customerOnly, schema: { tags: ["Events"], summary: "Mark a message as read", ...secured } },
    async (req, reply) => (db.markNotificationRead(req.session!.sub, req.params.id) ? reply.code(204).send() : fail(reply, 404, "not_found", "Message not found.")),
  );

  // ---------------- Recommendations ----------------
  app.post<{ Body: { requested_more?: boolean } }>(
    "/api/v1/recommendations",
    {
      preHandler: customerOnly,
      schema: {
        tags: ["Recommendations"],
        summary: "Run the decision engine and return the most relevant recommendation — or none",
        description:
          "Evaluates every active product against the customer's permitted context, goal, eligibility, timing and preferences. " +
          "Issues at most one recommendation; returns status no_match, window_cap or paused when nothing should be shown. " +
          "Repeated calls don't create duplicate recommendations.",
        body: { type: "object", additionalProperties: false, properties: { requested_more: { type: "boolean" } } },
        ...secured,
      },
    },
    async (req) => {
      const id = req.session!.sub;
      const result = evaluate(id, req.body?.requested_more ?? false);
      const rec = toRecord(result, id);
      let record = null;
      if (rec && result.top) {
        const open = db.listRecommendations(id).find((r) => r.product_id === rec.product_id && !r.feedback && r.status !== "applied");
        record = open ?? db.insertRecommendation(rec, { explanation: result.explanation!, trace: result.trace, factors: result.top.factors });
      }
      return {
        recommendation: record,
        decision: toApiResponse(result, record?.id ?? "", id),
        engine: result,
      };
    },
  );

  app.get("/api/v1/recommendations", { preHandler: customerOnly, schema: { tags: ["Recommendations"], summary: "Recommendation history", ...secured } }, async (req) =>
    db.listRecommendations(req.session!.sub),
  );

  const ownRec = (req: FastifyRequest<{ Params: { id: string } }>) => {
    const r = db.getRecommendation(req.params.id);
    return r && r.record.customer_id === req.session!.sub ? r : null;
  };

  app.get<{ Params: { id: string } }>(
    "/api/v1/recommendations/:id",
    { preHandler: customerOnly, schema: { tags: ["Recommendations"], summary: "One stored recommendation", ...secured } },
    async (req, reply) => {
      const r = ownRec(req);
      if (!r) return fail(reply, 404, "not_found", "Recommendation not found.");
      return { ...r.record, reason_details: db.recommendationReasons(r.record.id), feedback_history: db.feedbackHistory(r.record.id) };
    },
  );

  app.get<{ Params: { id: string } }>(
    "/api/v1/recommendations/:id/explanation",
    {
      preHandler: customerOnly,
      schema: {
        tags: ["Recommendations"],
        summary: "The explanation exactly as it was shown",
        description: "Stored with the recommendation, so it can be audited later even if data or rules change.",
        ...secured,
      },
    },
    async (req, reply) => {
      const r = ownRec(req);
      return r ? { recommendation_id: r.record.id, explanation: r.explanation, trace: r.trace, factors: r.factors } : fail(reply, 404, "not_found", "Recommendation not found.");
    },
  );

  app.post<{ Params: { id: string }; Body: { feedback: FeedbackType } }>(
    "/api/v1/recommendations/:id/feedback",
    {
      preHandler: customerOnly,
      schema: {
        tags: ["Recommendations"],
        summary: "Record customer feedback",
        body: { type: "object", required: ["feedback"], additionalProperties: false, properties: { feedback: { type: "string", enum: FEEDBACK } } },
        ...secured,
      },
    },
    async (req, reply) => {
      if (!ownRec(req)) return fail(reply, 404, "not_found", "Recommendation not found.");
      return db.recordFeedback(req.params.id, req.body.feedback, REMIND_LATER_DAYS);
    },
  );

  app.post<{ Params: { id: string } }>(
    "/api/v1/recommendations/:id/explored",
    { preHandler: customerOnly, schema: { tags: ["Recommendations"], summary: "Mark that the customer opened the product", ...secured } },
    async (req, reply) => {
      if (!ownRec(req)) return fail(reply, 404, "not_found", "Recommendation not found.");
      db.setRecommendationStatus(req.params.id, "explored");
      db.recordInteraction(req.session!.sub, ownRec(req)!.record.product_id, "explored", req.params.id);
      return { status: "explored" };
    },
  );

  // ---------------- Products ----------------
  app.get("/api/v1/products", { schema: { tags: ["Products"], summary: "Product catalogue with published facts and sources" } }, async () => db.listProducts());

  app.get<{ Params: { id: string } }>(
    "/api/v1/products/:id",
    { schema: { tags: ["Products"], summary: "One product, with its eligibility conditions (records a view when signed in)" } },
    async (req, reply) => {
      const p = db.getProduct(req.params.id);
      if (!p) return fail(reply, 404, "not_found", "Product not found.");
      if (req.session?.role === "customer" && db.getCustomer(req.session.sub)) db.recordInteraction(req.session.sub, p.product_id, "viewed");
      return { ...p, eligibility_conditions: db.productEligibility(p.product_id) };
    },
  );

  app.post<{ Params: { id: string } }>(
    "/api/v1/products/:id/eligibility-check",
    {
      preHandler: customerOnly,
      schema: {
        tags: ["Products"],
        summary: "Indicative eligibility and fit for this customer",
        description: "Checks published conditions and MoneyMap guardrails on permitted data. Final eligibility is always Zenith's decision.",
        ...secured,
      },
    },
    async (req, reply) => {
      const e = evaluate(req.session!.sub, true).ranked.find((x) => x.product.product_id === req.params.id);
      if (!e) return fail(reply, 404, "not_found", "Product not found.");
      db.recordInteraction(req.session!.sub, e.product.product_id, "eligibility_checked");
      return { product_id: e.product.product_id, eligibility: e.eligibility, match_score: e.score, band: e.band, exclusion: e.exclusion ?? null, why_not: e.whyNot ?? null };
    },
  );

  app.post<{ Params: { id: string } }>(
    "/api/v1/products/:id/apply",
    {
      preHandler: customerOnly,
      schema: {
        tags: ["Products"],
        summary: "Record the customer's request to open or apply",
        description: "Records intent only. MoneyMap never opens accounts, approves credit or moves money.",
        ...secured,
      },
    },
    async (req, reply) => {
      const p = db.getProduct(req.params.id);
      if (!p) return fail(reply, 404, "not_found", "Product not found.");
      if (p.status !== "active") return fail(reply, 409, "inactive", "This product isn't currently available.");
      return reply.code(201).send(db.createApplication(req.session!.sub, p));
    },
  );

  app.get("/api/v1/applications", { preHandler: customerOnly, schema: { tags: ["Products"], summary: "The customer's product requests", ...secured } }, async (req) =>
    db.listApplications(req.session!.sub),
  );

  // ---------------- Preferences ----------------
  app.get("/api/v1/preferences", { preHandler: customerOnly, schema: { tags: ["Preferences"], summary: "Recommendation preferences", ...secured } }, async (req) =>
    db.getPreferences(req.session!.sub),
  );

  app.patch<{ Body: Partial<Preferences> }>(
    "/api/v1/preferences",
    {
      preHandler: customerOnly,
      schema: {
        tags: ["Preferences"],
        summary: "Update categories and frequency",
        body: {
          type: "object",
          additionalProperties: false,
          properties: {
            frequency: { type: "string", enum: ["highly_relevant", "occasionally", "auto"] },
            categories: { type: "object", additionalProperties: false, properties: Object.fromEntries(CATEGORIES.map((c) => [c, { type: "boolean" }])) },
          },
        },
        ...secured,
      },
    },
    async (req) => {
      const cur = db.getPreferences(req.session!.sub);
      return db.setPreferences(req.session!.sub, {
        frequency: req.body.frequency ?? cur.frequency,
        categories: { ...DEFAULT_PREFERENCES.categories, ...cur.categories, ...req.body.categories },
      });
    },
  );

  // ---------------- Bank (admin) ----------------
  app.get(
    "/api/v1/admin/metrics",
    {
      preHandler: adminOnly,
      schema: { tags: ["Bank (admin)"], summary: "Live recommendation metrics plus the synthetic cohort simulation", ...secured },
    },
    async () => {
      const recs = db.listRecommendations();
      const count = (f: (r: (typeof recs)[number]) => boolean) => recs.filter(f).length;
      return {
        live: {
          generated: recs.length,
          accepted: count((r) => r.status === "applied"),
          rejected: count((r) => r.feedback === "not_wanted"),
          dismissed: count((r) => r.feedback === "not_relevant" || r.feedback === "remind_later"),
          useful: count((r) => r.feedback === "useful"),
          not_understood: count((r) => r.feedback === "not_understood"),
          by_product: Object.entries(
            recs.reduce<Record<string, Record<string, number>>>((acc, r) => {
              acc[r.product_name] ??= {};
              acc[r.product_name][r.need ?? "none"] = (acc[r.product_name][r.need ?? "none"] ?? 0) + 1;
              return acc;
            }, {}),
          ).map(([product, needs]) => ({ product, needs })),
        },
        interactions: db.interactionCounts(),
        cohort: simulateCohort(db.listProducts()),
      };
    },
  );

  app.get("/api/v1/admin/events", { preHandler: adminOnly, schema: { tags: ["Bank (admin)"], summary: "Recent triggers across customers and what MoneyMap decided", ...secured } }, async () =>
    db.listTriggerEvents(),
  );

  app.get("/api/v1/admin/model-versions", { preHandler: adminOnly, schema: { tags: ["Bank (admin)"], summary: "Decision model versions in use", ...secured } }, async () =>
    db.listModelVersions(),
  );

  app.get("/api/v1/admin/recommendations", { preHandler: adminOnly, schema: { tags: ["Bank (admin)"], summary: "All issued recommendations", ...secured } }, async () =>
    db.listRecommendations(),
  );

  app.get("/api/v1/admin/audit", { preHandler: adminOnly, schema: { tags: ["Bank (admin)"], summary: "Hash-chained audit log and integrity check", ...secured } }, async () => ({
    integrity: db.verifyAudit(),
    entries: db.auditLog(),
  }));

  app.patch<{ Params: { id: string }; Body: { status: "active" | "inactive" } }>(
    "/api/v1/admin/products/:id",
    {
      preHandler: adminOnly,
      schema: {
        tags: ["Bank (admin)"],
        summary: "Activate or deactivate a product (versioned and audited)",
        body: { type: "object", required: ["status"], additionalProperties: false, properties: { status: { type: "string", enum: ["active", "inactive"] } } },
        ...secured,
      },
    },
    async (req, reply) => db.setProductStatus(req.params.id, req.body.status) ?? fail(reply, 404, "not_found", "Product not found."),
  );

  app.setErrorHandler((err: Error & { validation?: unknown }, _req, reply) => {
    if (err.validation) return fail(reply, 400, "invalid_request", err.message);
    app.log.error(err);
    return fail(reply, 500, "server_error", "Something went wrong. Your information is safe — try again.");
  });

  return app;
}
