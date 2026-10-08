# MoneyMap — Architecture

MoneyMap is a decision layer that sits beside Zenith's existing systems. It doesn't replace core banking, credit decisioning or KYC.

```
 ┌─────────────────────────────┐        ┌──────────────────────────────────────────────┐
 │ Customer app (React + TS)   │  HTTPS │ MoneyMap API (Node + Fastify)                │
 │ consent · goals · MoneyMap  │ ─────► │  auth ─► consent enforcement ─► routes       │
 │ recommendation · Why?       │ Bearer │                  │                           │
 │ feedback · Demo Mode        │ token  │                  ▼                           │
 └─────────────────────────────┘        │  Decision engine (pure TypeScript)           │
 ┌─────────────────────────────┐        │  Understand → Detect → Match → Decide →      │
 │ Bank view                   │ ─────► │  Explain                                     │
 │ metrics · catalogue · audit │ admin  │                  │                           │
 └─────────────────────────────┘ token  │                  ▼                           │
                                        │  SQLite (Postgres-ready schema)              │
                                        │  customers · transactions · consents ·       │
                                        │  consent_events · goals · preferences ·      │
                                        │  products · product_versions ·               │
                                        │  recommendations · applications · audit_log  │
                                        └──────────────────────────────────────────────┘
                     Future adapters: core banking (transactions) · product catalogue CMS ·
                     credit decisioning · notifications · Zenith app sign-in (OIDC)
```

## From transactions to signals (`src/engine/ledger.ts`)

The engine never sees typed-in monthly totals. Each customer's figures are derived from their raw statement lines:

1. **Categorise.** Every line is labelled from its narration and channel alone — e.g. `NIP/BRIGHTPATH LOGISTICS LTD/SALARY SEP 2026` → salary, `REMITA/UNILAG/HOSTEL 2025-26` → education, `SAVE4ME/AUTO-SAVE/…` → savings, `ATM WDL …` → cash. Unit tests use narrations the categoriser has never seen.
2. **Aggregate.** Over the six complete months before today: income per month (income categories), spending per month (all debits except transfers into savings), average end-of-day balance, and the usual day the main income lands.
3. **Commitments.** A bill-like category (rent, utilities, subscriptions, airtime, school, debt repayment, transport) that appears in at least 5 of 6 months with steady amounts counts as a fixed commitment. Food and shopping never do.
4. **Behaviour.** A month counts as a saving month if money moved into savings or at least 15% of income was left unspent. Card and cash share come from payment channels.
5. **Evidence.** Signals quote what was found — "We found 6 salary payments from Brightpath Logistics Ltd…", "worked out from 142 transactions" — and the Map screen shows *How MoneyMap read your account*.

Consent applies to the statement as well: money-in lines need `income_patterns`, everything else needs `account_activity`, and the derived summaries are dropped per permission.

In production, step 1's input would come from a core-banking adapter instead of the `transactions` table seeded from `src/data/ledgers.ts`.

## Request flow: `POST /api/v1/recommendations`

1. **Auth.** A signed bearer token identifies the customer. In production this would be the Zenith app's OAuth 2.0 / OpenID Connect session.
2. **Consent enforcement.** `server/consent.ts` removes every data category the customer hasn't permitted *before* the engine sees it. The engine also gates each signal on permissions, giving two independent layers.
3. **Engine.** The customer's context, active goal, preferences, the active catalogue and their recommendation history go in. Out come a ranked evaluation of every product, the decision (recommended / no_match / window_cap / paused), an explanation and a step-by-step trace.
4. **Record.** If a product is recommended, a record is stored with `customer_id, product_id, need, match_score, reasons, timing_reason, eligibility_status, model_version, created_at, status`. The explanation, trace and score factors are stored with it, so `GET /recommendations/:id/explanation` returns exactly what the customer saw. Repeated calls reuse the open recommendation instead of creating duplicates.
5. **Audit.** The issue is written to the audit log. Each entry includes a SHA-256 hash of the previous one; `GET /admin/audit` re-verifies the whole chain and reports the first altered entry.

## Data model (PRD §39)

| PRD entity | Table | Notes |
|---|---|---|
| Customer | `customers` | Synthetic identity, KYC and holdings — no financial figures |
| (statement) | `transactions` | Raw lines: date, narration, amount, direction, channel. All income and spending figures are derived from these |
| Consent | `consents`, `consent_events` | Current state plus full change history |
| FinancialProfile | `financial_profiles` | Recomputed on every engine run; values the customer hasn't permitted are stored as empty |
| TransactionSignal | `transaction_signals` | Replaced on every run, so a withdrawn permission removes its signals at once |
| FinancialGoal | `goals` | One active goal per customer |
| Product | `products`, `product_versions` | Every status change creates a new version |
| ProductEligibility | `product_eligibility` | Each condition marked `published` (with source) or `guardrail` (MoneyMap's own rule) |
| Recommendation | `recommendations` | Phase 2 record fields, plus the explanation, trace and score factors as shown |
| RecommendationReason | `recommendation_reasons` | The "what influenced this" items, in order |
| RecommendationFeedback | `recommendation_feedback` | Every feedback event, not just the latest |
| CustomerPreference | `preferences` | Categories and frequency |
| ProductInteraction | `product_interactions`, `applications` | viewed / explored / eligibility_checked / requested |
| ModelVersion | `model_versions` | Weights and thresholds for each engine version used |
| AuditLog | `audit_log` | Hash-chained |

## Endpoints

Interactive docs (OpenAPI / Swagger) are at **`/docs`** on the running server.

| Area | Endpoints |
|---|---|
| Demo & auth | `POST /demo/session` (customer, optional preload), `POST /auth/demo-login` (bank admin), `GET /demo/customers`, `POST /demo/reset` |
| Customer | `GET /customer/profile`, `GET /customer/financial-context`, `GET /customer/moneymap` (screen preview, issues nothing), `GET /customer/transactions` (categorised statement, consent-filtered), `GET /customer/signals` |
| Consent | `GET /consent`, `POST /consent` |
| Goals | `GET /goals`, `POST /goals`, `PATCH /goals/:id`, `DELETE /goals/:id` |
| Recommendations | `POST /recommendations`, `GET /recommendations`, `GET /recommendations/:id`, `GET /recommendations/:id/explanation`, `POST /recommendations/:id/feedback`, `POST /recommendations/:id/explored` |
| Products | `GET /products`, `GET /products/:id`, `POST /products/:id/eligibility-check`, `POST /products/:id/apply`, `GET /applications` |
| Preferences | `GET /preferences`, `PATCH /preferences` |
| Bank (admin) | `GET /admin/metrics`, `GET /admin/recommendations`, `GET /admin/audit`, `GET /admin/model-versions`, `PATCH /admin/products/:id` |

All paths are under `/api/v1`. Request bodies are schema-validated and unknown fields are rejected. Errors come back as `{ "error", "message" }`.

## Two run modes for the same app

| Mode | Build | Where the engine runs | Used for |
|---|---|---|---|
| **API mode** | `npm run build:server-app` then `npm start` | Server. Every change is written to the API; every screen reads its decision from it (`/customer/moneymap`, `/recommendations`, stored explanations). | Real deployment; judges can call the API at `/docs` |
| **Local mode** | `npm run build` / `npm run build:embed` | Browser, with data kept in the browser | The single-page hosted demo, and an offline fallback if venue internet fails |

The engine is the same code in both modes. That's why it's pure TypeScript with no UI or server dependencies.

## Security posture (prototype → production)

| Prototype | Production |
|---|---|
| HMAC-signed demo tokens; open demo sign-in | Zenith app session (OIDC), short-lived tokens, RBAC |
| Consent redaction before the engine; every consent change logged | Same, plus consent receipts under the Nigeria Data Protection Act 2023 and the CBN open banking framework |
| Hash-chained audit log in SQLite | Append-only store / WORM storage, SIEM export |
| Schema validation, unknown fields rejected | Add rate limiting, an API gateway, secrets management and pen testing |
| Synthetic data only | Approved, anonymised data for the pilot |

## Not built (by design)

- No real core-banking, KYC/BVN or credit integration. These become adapters behind the same API.
- No LLM in the decision path. Explanations are generated from the engine's own facts, so product terms can't be invented.
- No model training. Feedback is stored to support a governed Phase 2 model later.
