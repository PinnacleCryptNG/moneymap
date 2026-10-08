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
                                        │  customers · consents · consent_events ·     │
                                        │  goals · preferences · products ·            │
                                        │  product_versions · recommendations ·        │
                                        │  applications · audit_log (hash-chained)     │
                                        └──────────────────────────────────────────────┘
                     Future adapters: core banking (transactions) · product catalogue CMS ·
                     credit decisioning · notifications · Zenith app sign-in (OIDC)
```

## Request flow: `POST /api/v1/recommendations`

1. **Auth.** A signed bearer token identifies the customer. In production this would be the Zenith app's OAuth 2.0 / OpenID Connect session.
2. **Consent enforcement.** `server/consent.ts` removes every data category the customer hasn't permitted *before* the engine sees it. The engine also gates each signal on permissions, giving two independent layers.
3. **Engine.** The customer's context, active goal, preferences, the active catalogue and their recommendation history go in. Out come a ranked evaluation of every product, the decision (recommended / no_match / window_cap / paused), an explanation and a step-by-step trace.
4. **Record.** If a product is recommended, a record is stored with `customer_id, product_id, need, match_score, reasons, timing_reason, eligibility_status, model_version, created_at, status`. The explanation, trace and score factors are stored with it, so `GET /recommendations/:id/explanation` returns exactly what the customer saw. Repeated calls reuse the open recommendation instead of creating duplicates.
5. **Audit.** The issue is written to the audit log. Each entry includes a SHA-256 hash of the previous one; `GET /admin/audit` re-verifies the whole chain and reports the first altered entry.

## Endpoints

Interactive docs (OpenAPI / Swagger) are at **`/docs`** on the running server.

| Area | Endpoints |
|---|---|
| Demo & auth | `POST /demo/session` (customer, optional preload), `POST /auth/demo-login` (bank admin), `GET /demo/customers`, `POST /demo/reset` |
| Customer | `GET /customer/profile`, `GET /customer/financial-context` |
| Consent | `GET /consent`, `POST /consent` |
| Goals | `GET /goals`, `POST /goals`, `PATCH /goals/:id`, `DELETE /goals/:id` |
| Recommendations | `POST /recommendations`, `GET /recommendations`, `GET /recommendations/:id`, `GET /recommendations/:id/explanation`, `POST /recommendations/:id/feedback`, `POST /recommendations/:id/explored` |
| Products | `GET /products`, `GET /products/:id`, `POST /products/:id/eligibility-check`, `POST /products/:id/apply`, `GET /applications` |
| Preferences | `GET /preferences`, `PATCH /preferences` |
| Bank (admin) | `GET /admin/metrics`, `GET /admin/recommendations`, `GET /admin/audit`, `PATCH /admin/products/:id` |

All paths are under `/api/v1`. Request bodies are schema-validated and unknown fields are rejected. Errors come back as `{ "error", "message" }`.

## Two run modes for the same app

| Mode | Build | Where the engine runs | Used for |
|---|---|---|---|
| **API mode** | `npm run build:server-app` then `npm start` | Server. The app syncs every change to the API and reloads from it. | Real deployment; judges can call the API at `/docs` |
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
