# Connecting MoneyMap to Zenith (step 4)

MoneyMap is a decision layer. It reads, decides and explains, and leaves accounts, credit and money movement to Zenith's existing systems. Each system it touches sits behind one small adapter in `server/adapters/`:

| Adapter | What MoneyMap needs | Demo mode (default) | Live mode |
|---|---|---|---|
| **Identity** (`identity.ts`) | Who the customer is | MoneyMap's own signed demo tokens | The Zenith app's OpenID Connect token (RS256 JWT), checked against the issuer's published keys (JWKS) |
| **Core banking** (`coreBanking.ts`) | The customer's statement | The seeded six-month statement | Statement fetched at sign-in and merged into MoneyMap's consented working copy |
| **Messaging** (`notifications.ts`) | Deliver a message MoneyMap decided to send | MoneyMap's in-app inbox only | Handed to the bank's messaging platform |
| **Product requests** (`applications.ts`) | Pass on "I'd like this" | Demo reference `DEMO-…` | Sent to the bank's onboarding or credit process, which returns its reference |

Switching from demo to live is configuration only. The decision engine, consent enforcement and audit log don't change.

> **About the contract below.** Zenith's internal APIs aren't public. The endpoints below are the contract **MoneyMap asks for**. In practice Zenith's integration team would expose them directly, or a thin translation service would map them to the bank's real interfaces. The stand-in server `server/mockZenith.ts` implements this contract, and the tests in `server/__tests__/integrations.test.ts` run MoneyMap against it.

## Configuration

Any adapter without configuration stays in demo mode.

| Variable | Purpose |
|---|---|
| `ZENITH_OIDC_ISSUER`, `ZENITH_OIDC_AUDIENCE`, `ZENITH_OIDC_JWKS_URL` | Accept Zenith app sign-in tokens. Optional `ZENITH_OIDC_CUSTOMER_CLAIM` (default `sub`) names the claim holding the customer id. |
| `ZENITH_CORE_BANKING_URL`, `ZENITH_CORE_BANKING_API_KEY` | Statement endpoint |
| `ZENITH_NOTIFICATIONS_URL`, `ZENITH_NOTIFICATIONS_API_KEY` | Messaging endpoint |
| `ZENITH_APPLICATIONS_URL`, `ZENITH_APPLICATIONS_API_KEY` | Product-request endpoint |
| `ZENITH_FEED_SECRET` | Shared secret for signed transaction webhooks |
| `ZENITH_TIMEOUT_MS` | Per-call timeout (default 4000) |

API keys are sent as `Authorization: Bearer …`. In production this would be a client-credentials token or mutual TLS.

## Contract MoneyMap calls (outbound)

### Statement: `GET {CORE_BANKING_URL}/customers/{customer_id}/transactions?from=YYYY-MM-DD`

```json
{ "transactions": [
  { "id": "ZB-1", "date": "2026-10-02", "narration": "POS/SPAR IKEJA/LA NG", "amount": 18500, "direction": "debit", "channel": "pos" }
] }
```

- `amount` is a positive whole number in naira. `direction` is `credit` or `debit`.
- `channel` is one of `transfer`, `pos`, `web`, `bill_payment`, `atm`, `standing_order`.
- `narration` is the raw bank narration. MoneyMap's categoriser works from it.
- Lines that don't match the contract are dropped, not passed to the engine.
- Lines are merged by `id`, so fetching the same line again is harmless.

### Message: `POST {NOTIFICATIONS_URL}/messages`

Header `Idempotency-Key: <MoneyMap notification id>`:

```json
{ "customer_id": "CUST_SARAH", "title": "…", "body": "…", "deep_link": "moneymap://recommendation", "category": "product_suggestion" }
```

Response: `{ "reference": "MSG-00001", "channel": "push" }`. The same key must return the same reference and must not send twice.

### Product request: `POST {APPLICATIONS_URL}/product-requests`

Header `Idempotency-Key: <MoneyMap application id>`:

```json
{ "customer_id": "CUST_SARAH", "product_id": "ZEN_SAVE4ME", "product_name": "SAVE4ME", "source": "moneymap", "recommendation_id": "REC_…" }
```

Response: `{ "reference": "ZEN-REQ-00001" }`. This records intent only. The bank's own process decides eligibility and opens anything.

### Sign-in keys: `GET {ZENITH_OIDC_JWKS_URL}`

A standard JWKS document. Only `RS256` tokens are accepted, which rules out `alg: none` and HMAC algorithm-confusion tokens. A token is rejected unless:

- its issuer and audience match;
- it hasn't expired (60 seconds of clock skew allowed);
- its customer claim names an existing MoneyMap customer.

Keys are cached for 10 minutes and refetched when an unknown key id appears, which covers key rotation.

## Contract Zenith calls (inbound)

### New transaction: `POST /api/v1/events/transactions`

```json
{ "customer_id": "CUST_SARAH", "external_id": "TXN-778", "date": "2026-10-08",
  "narration": "NIP/BRIGHTPATH LOGISTICS LTD/SALARY OCT 2026", "amount": 450000, "direction": "credit", "channel": "transfer" }
```

Signed with `ZENITH_FEED_SECRET`:

```
x-moneymap-timestamp: <unix seconds>
x-moneymap-signature: sha256=<hex HMAC-SHA256(secret, timestamp + "." + raw body)>
```

- Requests more than 5 minutes old are rejected, which prevents replays.
- A repeated `external_id` returns `200 {"duplicate": true}` and does nothing.
- An admin token also works, for testing.
- The response says whether the line was a trigger and what MoneyMap decided (see step 3 in `ARCHITECTURE.md`).

Example signer:

```js
const ts = Math.floor(Date.now() / 1000);
const sig = "sha256=" + crypto.createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex");
```

## When a Zenith system is down

MoneyMap degrades without blocking the customer:

| System down | What MoneyMap does |
|---|---|
| Core banking | Keeps deciding on the last good copy of the statement. `GET /customer/statement-sync` reports `failed` with the error. |
| Messaging | The message is still in the customer's MoneyMap inbox. The delivery is marked `failed` and retried every minute, up to 5 attempts. The idempotency key prevents duplicates. |
| Product requests | The request is recorded as "Sending to Zenith" (`pending`) and retried until the bank returns a reference. |
| Sign-in keys | Keys already fetched keep working until they're replaced. |

Every outbound call has a timeout and up to two retries with backoff. Retries happen on network errors, timeouts, `429` and `5xx`, never on other `4xx`. Health per adapter (calls, failures, last success, last error) is at `GET /api/v1/admin/integrations` and on the bank view's **Integrations** page. `POST /api/v1/admin/integrations/retry` retries straight away.

## Try live mode locally

```bash
npm run mock:zenith        # stand-in Zenith on :9090; prints the variables and a sample sign-in token
# in another terminal, paste the printed ZENITH_* variables in front of:
npm run build:server-app && npm start
```

The bank view's Integrations page then shows each adapter as **Live · 127.0.0.1:9090**.

## Not yet covered

- **Product catalogue sync.** The catalogue is maintained in MoneyMap, with sources and versioning. A CMS adapter would follow the same pattern.
- **Credit decisioning.** MoneyMap shows published eligibility only and never pre-approves.
- **Production transport.** Mutual TLS and secret rotation belong to the deployment (step 5).
