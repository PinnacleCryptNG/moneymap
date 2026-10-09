# MoneyMap security and data protection (step 5)

MoneyMap handles bank customers' transaction data, so it is built to be safe by default:

- It reads only what the customer permits.
- It never moves money, opens accounts or approves credit.
- It refuses to run in production with demo shortcuts switched on.

## Two run modes

| | `MONEYMAP_MODE=demo` (the hackathon build) | `MONEYMAP_MODE=production` |
|---|---|---|
| Demo sign-in, Demo Mode, demo events, reset-all | Available | **Not registered** (404) |
| Customer sign-in | Demo tokens, plus Zenith OIDC if configured | **Zenith OIDC only.** Demo tokens are rejected even if correctly signed |
| Bank view sign-in | Open demo login | **Staff OIDC token with the `moneymap_admin` role** (`roles` or `groups` claim; set with `ZENITH_OIDC_ADMIN_ROLE`) |
| CORS | Any origin (bearer tokens, no cookies) | Only origins in `MONEYMAP_CORS_ORIGINS`; none = same origin only |
| HSTS | — | `max-age=31536000; includeSubDomains` |
| Startup | Starts with defaults | **Refuses to start** without `MONEYMAP_SECRET` (32+ characters) and the Zenith OIDC settings |

The public Render demo runs in demo mode on purpose, so judges can switch customers and use the bank view. Tests check that each production rule holds.

## Controls

| Threat | Control | Where |
|---|---|---|
| Someone signs in as a customer or as staff | Zenith OpenID Connect: RS256 only (rejects `alg:none` and HMAC confusion), issuer, audience and expiry checks, JWKS with key rotation. Staff need an explicit role. | `server/adapters/identity.ts` |
| A customer reads another customer's data | Every customer route uses the signed-in customer id; ids in requests are checked for ownership (another customer's recommendation returns 404). | `server/app.ts` |
| Data used without permission | Consent enforced twice: data is removed before the engine sees it, and every signal checks its permission. Triggers ignore income without `income_patterns`. | `server/consent.ts`, `src/engine/context.ts` |
| Forged or replayed bank webhooks | HMAC-SHA256 over timestamp and raw body, compared in constant time; 5-minute window; `external_id` makes duplicates harmless. | `server/app.ts` |
| Malformed or malicious input | JSON Schema on every body and query; unknown fields rejected; no type coercion; 64 KB body limit; bank statement lines validated before use. | `server/app.ts`, `server/adapters/coreBanking.ts` |
| Brute force and floods | Per-IP limits: 60/min on sign-in, 1,200/min on everything else (`MONEYMAP_RATE_LIMIT_AUTH`, `MONEYMAP_RATE_LIMIT`). Returns `429` with `Retry-After`. Client IP is taken from the load balancer only when `MONEYMAP_TRUST_PROXY=1`. | `server/security.ts` |
| Script injection or clickjacking in the app | Content Security Policy (own scripts only, Google Fonts for type, `frame-ancestors 'none'`); `X-Frame-Options: DENY`; `nosniff`; `Referrer-Policy: no-referrer`; a strict `Permissions-Policy`. React escapes all rendered text. | `server/security.ts` |
| Financial data cached on shared devices or proxies | `Cache-Control: no-store` on every API response | `server/security.ts` |
| Error messages leak internals | Unexpected errors are logged on the server; the caller gets a generic message | `server/app.ts` |
| Audit log tampered with | Hash-chained entries, re-verified on every read and on `/health` | `server/db.ts` |
| Audit log becomes a data leak | It records decisions, not finances: no amounts, narrations or goal figures (a test checks this) | `server/db.ts` |
| Pressure selling / over-marketing | At most one recommendation per 7 days, one message per week, fatigue pause, "Not relevant" respected | `src/engine` |
| Outages at the bank | Timeouts and bounded retries; last good statement kept; message and request retries with idempotency keys | `server/adapters` |

## Data protection (Nigeria Data Protection Act 2023)

| Principle | How MoneyMap meets it |
|---|---|
| Lawful basis and consent | Five separate, plain-language permissions, each withdrawable at any time with immediate effect. Every change is logged with a timestamp. |
| Data minimisation | Only the statement window needed (six months) is read. Signals are computed and stored in summary form. Values the customer hasn't permitted are stored as empty. |
| Purpose limitation | Used only to suggest relevant Zenith products and explain why. No resale, no ad targeting, no credit decisions. |
| Right of access and portability | **Settings → Download my data** (`GET /customer/data-export`): one JSON document of everything MoneyMap holds. |
| Right to erasure | **Settings → Delete my MoneyMap data** (`DELETE /customer/data`): removes consents, goals, preferences, recommendations, feedback, messages, events, requests and MoneyMap's cached bank lines. The audit log keeps only that an erasure happened. Zenith's own bank records are untouched. |
| Transparency | Every recommendation shows its reasons, its data sources and how the engine reached it. Staying quiet is explained too. |
| Accountability | Model version, weights and thresholds are stored with every decision. The audit log is tamper-evident. |

## Production checklist (outside this codebase)

- TLS everywhere. Mutual TLS or client-credentials tokens to Zenith systems. Secrets in the bank's vault, rotated.
- PostgreSQL with encryption at rest, point-in-time recovery and row-level access by service role. The schema ports directly.
- A shared rate-limit and cache store (for example Redis) when running more than one instance.
- Retention schedule: delete derived data N months after the customer leaves, or when consent lapses.
- A Data Protection Impact Assessment and a model-risk review of the scoring weights before launch.
- Penetration test, dependency scanning in CI (`npm audit` is clean today), and alerting on the audit-chain check and adapter failures.
