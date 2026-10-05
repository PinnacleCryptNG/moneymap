# MoneyMap

**Know where you are. Know where to go.**

MoneyMap is an intelligent financial decision and product-matching layer. It uses customer-permitted information, financial behaviour, goals and product eligibility to identify the most relevant financial product or action at the right time. When nothing is relevant enough, it doesn't recommend anything.

Built for **Zenith Bank Zecathon 6.0 — Challenge #9: Intelligent Customer Product Matching**. This is a Phase 1 prototype on synthetic data.

```
Customer → Consent → Context → Need → Product → Eligibility → Score → Timing → Recommendation → Explanation → Action → Feedback
```

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # decision-engine tests (vitest)
npm run build      # typecheck + production build to dist/
```

The build is a static site with hash routing, so `dist/` can be hosted anywhere (GitHub Pages, Netlify, S3).

## Demo script (spec §69–70)

1. On the welcome page, pick **Sarah — The Saver**.
2. Goal: *Save more* → ₦1,000,000 in 12 months → **Allow all** permissions.
3. "Your financial map is ready" → **See my recommendation** → *Goal Savings Plan, 95% match*.
4. **Why this?** shows the goal, behaviour, pattern, product fit, timing, eligibility, the data used, the full score breakdown, and why the other options weren't chosen.
5. Back → **Not interested** → *Not relevant* → **Check my map again**. MoneyMap holds back on purpose instead of pushing another product (over-marketing control).
6. Open **Bank admin** to see the feedback land, along with cohort metrics, the catalogue editor and the audit log.

The other demo customers each show a different decision:

| Customer | Persona | Engine outcome |
|---|---|---|
| Sarah | The Saver | Goal Savings Plan. The Investment Fund is excluded on income eligibility. |
| Tunde | The Borrower | Personal Purpose Loan, after the affordability check passes. Savings products are excluded because his rent is due in 3 months. |
| Amaka | The Growing Professional | Managed Investment Fund. The Fixed Deposit loses on horizon fit for her 24-month goal. |
| Chidi | The Growing Business | SME Business Account, triggered by business inflows growing about 90%. |
| Bola | No match | **No recommendation**. Her setup already fits, so MoneyMap doesn't invent a need. |

Try withdrawing permissions in **Settings**: recommendations degrade, and with no permissions there is no personalised match at all.

## What's in the prototype

**Customer app**: welcome, onboarding (goal → plain-language consent → map ready), dashboard (NOW → NEXT → GOAL route plus Where you are / Where you're going / Your next move), Insights map (detected signals with evidence and source, needs, and the decision funnel), recommendation, *Why this?*, product catalogue and detail (indicative eligibility check, application intent), goals (create, edit, delete, log progress, estimates), activity (recommendation history, feedback, consent record), settings (granular permissions, withdraw all, category and frequency preferences). Also included: empty, no-match, paused and error states (the error state can be simulated from Settings).

**Bank admin**: monitoring dashboard (North Star useful-recommendation rate, volume, acceptance, conversion, rejection, no-match rate, product performance, emerging needs, segments, quality and guardrails, live session feedback). It also has a versioned product catalogue editor (eligibility, needs, recommended-when and exclusion rules, status), an engine and rules page with the live API response, and an audit log.

## Decision engine (`src/engine`)

Pure TypeScript with no UI dependencies, so it can move to a Node backend unchanged.

- `context.ts`, **Understand**: builds financial context from permitted data only. Each signal carries a strength, plain-language evidence and its source permission.
- `needs.ts`, **Detect**: turns the goal and signals into scored needs.
- `index.ts`, **Match / Decide / Explain**:
  - MVP weights (spec §28): need 30%, goal 20%, behaviour 15%, eligibility 15%, timing 10%, preference 10%, minus irrelevance and overexposure penalties.
  - Hard rules: inactive, category opt-out, declined or recently dismissed, already held, wrong segment, ineligible (age, income, balance, repayment ≤ 33% of income), conflict with the stated need, snoozed.
  - Thresholds: ≥ 80 strong. 65–79 potential, shown only on request or when frequency isn't "only when highly relevant". Below 65, not recommended.
  - Over-marketing controls: 1 proactive recommendation per 7-day window, a fatigue pause after 3 dismissals in 30 days, and a category pause after 2.
  - Every recommendation carries reasons, why now, eligibility checks, next steps, why-not for alternatives, the data used, and the model version.
- `plan.ts` holds transparent, clearly labelled estimates (monthly contribution, illustrative loan repayment).

`src/services/api.ts` mirrors the REST endpoints in spec §38 as a mock client with latency. It is the integration seam for a real Node/PostgreSQL backend. `src/services/analytics.ts` runs the real engine over a deterministic synthetic cohort of 250 customers to power the admin metrics.

## Important prototype boundaries

- All customers are **synthetic**. No real customer data is used.
- Product names, terms, fees and eligibility are **illustrative prototype assumptions, not actual Zenith product terms**. They must be replaced with Zenith-approved catalogue data.
- MoneyMap does **not** approve credit, open accounts or move money. "Apply" records intent only.
- Weights and thresholds are prototype values. They must be validated with historical data and controlled testing, under model governance, before production.
- State persists in the browser's `localStorage` for the demo. **Reset all demo data** is in Settings.

## Stack

React 19, TypeScript, Tailwind CSS v4, Vite, React Router, Lucide icons, Vitest. Inter typeface, with design tokens from the spec (§46–50, §80).
