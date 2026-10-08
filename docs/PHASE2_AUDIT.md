# MoneyMap — Phase 2 audit (Phase A)

This audit compares the Phase 1 prototype, screen by screen, against the PRD and the Phase 2 build plan.
The test for every line: *does this make MoneyMap clearer, more useful, more credible, or more impressive to a judge?*

## KEEP — works and communicates the product

| Area | Why it stays |
|---|---|
| Decision engine (`src/engine`): context → needs → match → decide → explain | Real, transparent rules plus weighted scoring (PRD §28). The logic is real and demonstrable, as Phase 2 §5 requires. |
| Hard rules, thresholds (80 / 65) and the no-match decision | This is the core differentiator (PRD §14, Phase 2 §8 and §22). |
| Over-marketing controls: 1 recommendation per 7 days, fatigue pause, no repeats after dismissal | Phase 2 §11, "exposure control". |
| Permission toggles with "What we use it for / Why it helps" | Consent and control are visible (PRD §41, Phase 2 §17). |
| Score breakdown and "why not something else?" | Shows that alternatives were really evaluated. |
| Consent record, activity history, audit log | Auditability (Phase 2 §17). |
| Error, empty and loading states | Phase 2 Phase E. |
| Design tokens, Inter typeface, navy/blue/green palette | Already matches Phase 2 §13. |
| In-memory navigation and error fallback for embedded hosting | Keeps the hosted demo working. |

## IMPROVE — right idea, needs refinement

| Area | Change |
|---|---|
| MoneyMap home screen | "Where you are" must also show **savings, cash-flow pattern and relevant existing products** (Phase 2 §4). |
| Recommendation screen | Restructure to **We found a strong match → Why it fits → Why now → What influenced this → Your choice** (Phase 2 §6). |
| "Why this?" screen | Sections become **Your goal / Your financial context / The product fit / The timing / Your data** (Phase 2 §7). |
| Visibility of the engine | Show the pipeline (Customer → Permitted data → Context → Goal → Need → Fit → Eligibility → Timing → Recommendation) with each step's actual result, so nothing looks hard-coded (Phase 2 §5). |
| No-match copy | Use the Phase 2 §8 wording, including "We'll let you know when something genuinely relevant comes up." |
| Customer data | Add realistic Nigerian transaction descriptions and cash-flow patterns (Phase 2 §12). |
| Recommendation record | Store the Phase 2 §14 fields: customer_id, product_id, need, match_score, reasons, timing_reason, eligibility_status, created_at, status. |
| Feedback values | Rename to useful / not_relevant / not_understood / not_wanted / remind_later (Phase 2 §14). |
| Admin overview | Refocus on the four Phase 2 §16 questions: performance, product-to-need matching, relevance, fatigue. |
| Consent screen | Add data minimisation and "MoneyMap never decides for you" (Phase 2 §17). |
| Goal input | Validate amounts and timelines, and say what an expense is for (a car or equipment points to Asset Finance). |

## BUILD — required but missing

| Area | Detail |
|---|---|
| Zenith product catalogue | SAVE4ME, Aspire, EazySave, Personal Loan, Asset Finance, Credit Card. Only publicly documented facts, each with a source. No invented rates, fees, limits, approval guarantees or processing times (Phase 2 §10). |
| Verified vs. assumption labelling | Every product separates **published information** from **MoneyMap suitability rules (prototype)**. |
| Daniel — student persona | Student profile → Aspire (Phase 2 §9). |
| No-match customer | A customer whose existing setup already fits, so no recommendation is made. |
| Demo Mode | Team-only switcher that loads Sarah, Daniel or the no-match customer instantly (Phase 2 §15). |
| QA script | Automated walk through every path at phone and desktop sizes, invalid inputs, consent states and feedback (Phase 2 Phase H). |

## REMOVE — doesn't strengthen the proposition

| Area | Reason |
|---|---|
| Invented products (Goal Savings Plan, Fixed Term Deposit, Managed Investment Fund, SME Business Account, Protection Cover, Travel Card) | Phase 2 §10: stop behaving like an imaginary catalogue. Investment management is explicitly out of scope (§21). |
| Personas Tunde, Amaka and Chidi | Replaced by the three Phase 2 personas. Financing is still demonstrable live: change any persona's goal to a car purchase and the recommendation changes. |
| Illustrative interest rate in loan estimates | Must not invent rates. Estimates now show principal only, clearly labelled. |
| Full admin product editor | Not in the Phase 2 admin scope and adds risk to the demo. Replaced by a read-only, sourced catalogue with an activate/deactivate control (governance). |
| Large marketing landing sections | The demo starts from the problem and the customer, not from a website. The landing page is trimmed to what supports the story. |
