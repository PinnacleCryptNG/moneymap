# MoneyMap

**Know where you are. Know where to go.**

MoneyMap is an intelligent financial decision layer. It helps Zenith understand what a customer needs, identify the product that best fits that need, decide whether the timing is right, and explain the recommendation before the customer chooses to act.

> Customer Goal + Financial Context + Product Fit + Timing = Relevant Recommendation.
> If the match isn't strong enough, MoneyMap recommends nothing.

Built for **Zenith Bank Zecathon 6.0 — Challenge #9: Intelligent Customer Product Matching**. Phase 2 build. See [`docs/PHASE2_AUDIT.md`](docs/PHASE2_AUDIT.md) for the KEEP / IMPROVE / BUILD / REMOVE audit.

## Run it

**With the API server (recommended):**

```bash
npm install
npm run build:server-app   # builds the app in API mode
npm start                  # http://localhost:8080 — app on /, API on /api/v1, docs on /docs
```

To put it online, see [`docs/DEPLOY.md`](docs/DEPLOY.md) (Render, using `render.yaml`). Or with Docker: `docker build -t moneymap . && docker run -p 8080:8080 -e MONEYMAP_SECRET=change-me moneymap`.

**Other commands:**

```bash
npm run dev                # front end only, local mode — http://localhost:5173
npm run dev:server         # API with auto-restart (pair with VITE_API_MODE=http npm run dev)
npm test                   # engine + API tests (vitest)
npm run build              # local-mode build to dist/
npm run qa                 # browser QA against dist/ (local mode)
QA_SERVER=1 npm run qa     # browser QA against the real server (after build:server-app)
QA_URL=https://… npm run qa  # browser QA against a deployed site
npm run build:embed        # single-page build for embedded viewers → dist-embed/moneymap.html
```

The API is described in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and is browsable at `/docs` on the running server.

`npm run qa` drives every core path at phone and desktop sizes: onboarding with invalid input, recommendation, Why?, product action, feedback, dismissal, all three personas, a goal change, consent withdrawal, "skip for now", the error and empty states, and the bank view. It fails on any broken screen, JavaScript error or sideways scroll. If Playwright can't find a browser, set `PW_CHROMIUM` to a Chromium executable.

## Demo Mode

Every screen has a small **Demo** button (bottom left). It is for the presenting team, not customers. It loads any persona's full financial context instantly, or walks through their onboarding.

| Persona | Situation | MoneyMap outcome |
|---|---|---|
| **Sarah, 24** — Saver | ₦450,000 salary, ₦280,000 spending, ₦170,000 left monthly. Goal: ₦1,000,000 in 12 months. Savings sit in her everyday account. | **SAVE4ME**, 95% match. Suggested ₦83,333/month. EazySave is ruled out (its reported balance cap is below her goal) and Aspire too (student-only). |
| **Daniel, 21** — Student | 300-level student at UNILAG, monthly allowance plus gigs, almost fully cashless, on a basic savings account. | **Aspire**, 95% match. Personal Loan fails its published salary-account condition. |
| **Tolu, 35** — No match | Senior accountant already saving through SAVE4ME, already has a credit card, no new goal. | **No recommendation.** "Nothing needs your attention." |

Live demo extra: give Tolu a new goal ("Buy a car", ₦6,000,000 in 12 months) and the answer changes to **Asset Finance**. Give Sarah "Pay my rent", ₦1,800,000 in 3 months, and it changes to **Personal Loan**, with SAVE4ME locked out because she needs the money soon.

## Product catalogue (Phase 2 §10)

SAVE4ME · Aspire · EazySave · Personal Loan · Asset Finance · Credit Card (`src/data/products.ts`).

- **Published information** contains only facts found in public sources, each linked to its source. Zenith's own website was not reachable during the build, so the sources are press and comparison sites. **Confirm every fact against Zenith's approved product information before a pilot.**
- **No interest rates, fees, limits, approval guarantees or processing times are invented.** Anything unpublished reads "Terms and eligibility are subject to Zenith Bank's current requirements."
- **Published eligibility** (for example, Aspire for students aged 16–25, and Personal Loan requiring a salary account) is kept separate from **MoneyMap guardrails**: prototype suitability rules such as "principal repayment ≤ 33% of income" or "goal must fit the reported balance cap".
- Loan estimates show the **principal only**, over an example 12-month period. Interest and charges are left to Zenith.
- The brief lists "Aspire / Aspire Lite". Only Aspire was found in public sources.

## How it decides (`src/engine`)

Pure TypeScript with no UI dependencies, unit-tested, and visible in the app as **How MoneyMap reached this**:

```
Customer → Permitted data → Financial context → Goal → Need detection → Product fit → Eligibility → Timing → Recommendation → Explanation → Action
```

- `context.ts`, **Understand**: signals come only from permitted data, each with plain-language evidence and its source.
- `needs.ts`, **Detect**: goal plus signals become scored needs.
- `index.ts`, **Match / Decide / Explain**:
  - Weights: need 30%, goal 20%, behaviour 15%, eligibility 15%, timing 10%, preference 10%, minus penalties.
  - Thresholds: 80+ is strong, 65–79 is potential (shown only on request), below 65 is not recommended.
  - Hard rules: inactive, opted out, declined or recently dismissed, already held, published condition fails, guardrail fails, conflict with need, snoozed.
  - Exposure control: at most 1 new suggestion per 7 days, a fatigue pause after 3 dismissals, and never the same product again after "Not relevant".
- Each stored recommendation records `customer_id, product_id, need, match_score, reasons, timing_reason, eligibility_status, created_at, status`. Feedback values are `useful, not_relevant, not_understood, not_wanted, remind_later`.

The server (`server/`) runs the same engine behind a REST API, with consent enforcement before the engine, an SQLite database (Postgres-ready schema), stored recommendations and explanations, and a hash-chained audit log. `src/services/analytics.ts` runs the real engine over 240 synthetic customers for 4 weekly decision rounds with simulated responses, to power the bank view.

## Trust and boundaries

- All customers are **synthetic**; no real customer data is used.
- MoneyMap **never decides for the customer**, approves credit, opens accounts or moves money. "Request to open" only records intent.
- Data is used only within granted permissions. Withdrawing a permission takes effect immediately and is logged.
- Weights and thresholds are prototype values. They must be validated with approved data under model governance before production.
- Demo state lives in the browser (`localStorage`). Use **Demo → Reset everything** to start over.

## Stack

React 19, TypeScript, Tailwind CSS v4, Vite, React Router, Lucide icons, Vitest and Playwright. Inter typeface, with the MoneyMap colour tokens.
