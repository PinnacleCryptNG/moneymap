import { ArrowLeft, ArrowRight, Check, ShieldCheck, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useStore } from "../../app/providers/store";
import { summaryTiles } from "../../components/cards/FinancialSnapshot";
import { answeredAnything, draftFrom, MoneyQuestions, readDraft, saveMoneyAnswers } from "../../components/forms/MoneyQuestions";
import { PermissionToggle } from "../../components/forms/PermissionToggle";
import { Button } from "../../components/shared/Button";
import { Input, Select } from "../../components/shared/Field";
import { Logo } from "../../components/shared/Logo";
import { runEngine } from "../../engine";
import { goalPlan } from "../../engine/plan";
import { PERMISSION_COPY, PERMISSION_ORDER } from "../../services/consent";
import type { ExpenseKind, GoalDraft, GoalType, Permissions } from "../../types";
import { formatNaira } from "../../utils/format";
import { EXPENSE_KINDS, GOAL_META, GOAL_ORDER, goalInputError } from "../../utils/labels";

const STEPS = ["Your goal", "Your money", "Permissions", "Your map"];

export function OnboardingPage() {
  const { state, customer, dispatch } = useStore();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  const def = customer.defaultGoal;
  const [goalType, setGoalType] = useState<GoalType | null>(def?.type ?? null);
  const [amount, setAmount] = useState(def?.amount ? String(def.amount) : "");
  const [months, setMonths] = useState(String(def?.timelineMonths ?? 12));
  const [expenseKind, setExpenseKind] = useState<ExpenseKind>(def?.expenseKind ?? "rent");
  const [attempted, setAttempted] = useState(false);
  const [money, setMoney] = useState(() => draftFrom(state.selfReport));
  const [moneyErrors, setMoneyErrors] = useState<string[]>([]);
  const answers = useMemo(() => readDraft(money), [money]);
  const [permissions, setPermissions] = useState<Permissions>({
    account_activity: false,
    income_patterns: false,
    spending_patterns: false,
    existing_products: false,
    financial_goals: false,
  });

  const goal: GoalDraft | null = useMemo(() => {
    if (!goalType) return null;
    const meta = GOAL_META[goalType];
    const amt = meta.needsAmount ? Number(amount) || 0 : 0;
    const kind = goalType === "major_expense" ? expenseKind : undefined;
    const label =
      goalType === "save_more" && amt
        ? `Save ${formatNaira(amt)}`
        : kind
          ? EXPENSE_KINDS.find((k) => k.value === kind)!.goalLabel
          : goalType === def?.type
            ? def.label
            : meta.label;
    return { type: goalType, label, amount: amt, timelineMonths: Math.max(1, Number(months) || 12), saved: 0, expenseKind: kind };
  }, [goalType, amount, months, def, expenseKind]);

  const preview = useMemo(
    () =>
      runEngine({
        customer,
        permissions,
        goal: goal ? { ...goal, id: "draft", saved: 0, createdAt: new Date().toISOString() } : null,
        preferences: state.preferences,
        products: state.products,
        history: [],
        selfReport: answeredAnything(answers.report, answers.goals) ? { ...answers.report, updatedAt: "" } : null,
      }),
    [customer, permissions, goal, state.preferences, state.products, answers],
  );

  const finish = (to: string) => {
    dispatch({ type: "complete_onboarding", permissions, goal });
    if (answeredAnything(answers.report, answers.goals)) saveMoneyAnswers(dispatch, answers, Boolean(goal));
    navigate(to);
  };

  const goalError = goalType ? goalInputError(Number(amount), Number(months), GOAL_META[goalType].needsAmount) : "Choose what you're working towards.";
  const allOn = PERMISSION_ORDER.every((k) => permissions[k]);

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
          <Link to="/" aria-label="Back to welcome"><Logo /></Link>
          <span className="text-small text-ink-3">Building {customer.firstName}'s MoneyMap</span>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-3xl px-4 pb-16 pt-8">
        <ol className="mb-8 flex items-center gap-2" aria-label="Progress">
          {STEPS.map((s, i) => (
            <li key={s} className="flex flex-1 items-center gap-2" aria-current={i === step ? "step" : undefined}>
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-small font-semibold ${i < step ? "bg-mint text-night" : i === step ? "bg-mint text-night" : "bg-surface text-ink-3 border border-line"}`}>
                {i < step ? <Check size={16} aria-label="done" /> : i + 1}
              </span>
              <span className={`hidden text-small font-medium sm:inline ${i === step ? "text-ink" : "text-ink-3"}`}>{s}</span>
              {i < STEPS.length - 1 && <span className={`h-0.5 flex-1 rounded ${i < step ? "bg-green" : "bg-line"}`} />}
            </li>
          ))}
        </ol>

        {step === 0 && (
          <section className="fade-up" aria-labelledby="goal-title">
            <h1 id="goal-title" className="mb-2">What are you working towards?</h1>
            <p className="mb-6 text-ink-3">Start with what you want to achieve. Products come after the need.</p>
            <fieldset>
              <legend className="sr-only">Choose your goal</legend>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {GOAL_ORDER.map((t) => {
                  const m = GOAL_META[t];
                  const Icon = m.icon;
                  const on = goalType === t;
                  return (
                    <label key={t} className={`card flex min-h-16 cursor-pointer items-center gap-3 p-4 transition-colors ${on ? "!border-blue bg-blue-50" : "hover:bg-surface/60"}`}>
                      <input type="radio" name="goal" className="sr-only peer" checked={on} onChange={() => setGoalType(t)} />
                      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] peer-focus-visible:outline peer-focus-visible:outline-3 peer-focus-visible:outline-blue ${on ? "bg-mint text-night" : "bg-canvas text-ink-2"}`}>
                        <Icon size={24} aria-hidden />
                      </span>
                      <span className="flex-1">
                        <span className="block font-semibold">{m.label}</span>
                        <span className="text-small text-ink-3">{m.hint}</span>
                      </span>
                      {on && <Check size={20} className="text-blue" aria-hidden />}
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {goalType && GOAL_META[goalType].needsAmount && (
              <div className="card fade-up mt-4 grid gap-4 p-5 sm:grid-cols-2">
                {goalType === "major_expense" && (
                  <div className="sm:col-span-2">
                    <Select label="What's the expense for?" value={expenseKind} onChange={(e) => setExpenseKind(e.target.value as ExpenseKind)}>
                      {EXPENSE_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
                    </Select>
                  </div>
                )}
                <Input label="Target amount" prefix="₦" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))} hint={Number(amount) ? formatNaira(Number(amount)) : "e.g. 1,000,000"} />
                <Input label="Timeline (months)" inputMode="numeric" value={months} onChange={(e) => setMonths(e.target.value.replace(/[^\d]/g, ""))} hint="When do you need it by?" />
                {attempted && goalError && (
                  <p role="alert" className="text-small font-medium text-red sm:col-span-2">{goalError}</p>
                )}
                {goal && goal.amount > 0 && !goalError && (
                  <p className="text-small text-ink-3 sm:col-span-2">
                    Estimate: about <strong className="text-ink">{formatNaira(goalPlan(goal, null).monthlyContribution)}</strong> a month for {goal.timelineMonths} months.
                  </p>
                )}
              </div>
            )}

            <div className="mt-8 flex justify-end">
              <Button
                disabled={!goalType}
                onClick={() => {
                  setAttempted(true);
                  if (!goalError) setStep(1);
                }}
                iconRight={<ArrowRight size={20} aria-hidden />}
              >
                Continue
              </Button>
            </div>
          </section>
        )}

        {step === 1 && (
          <section className="fade-up" aria-labelledby="money-title">
            <h1 id="money-title" className="mb-2">Tell us about your money</h1>
            <p className="mb-6 text-ink-3">
              Optional. Answer what you can — ranges and “I'm not sure” are fine. MoneyMap uses your answers wherever you don't share your Zenith account, and always says when a figure came from you.
            </p>
            <MoneyQuestions draft={money} onChange={setMoney} existingGoals={goal ? [{ label: goal.label }] : []} />
            {moneyErrors.length > 0 && (
              <ul role="alert" className="mt-4 flex list-disc flex-col gap-1 rounded-[12px] border border-red/30 bg-red-50 p-4 pl-8 text-small text-red">
                {moneyErrors.map((e) => <li key={e}>{e}</li>)}
              </ul>
            )}
            <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
              <Button variant="tertiary" onClick={() => setStep(0)} icon={<ArrowLeft size={20} aria-hidden />}>Back</Button>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setMoney(draftFrom(null));
                    setMoneyErrors([]);
                    setStep(2);
                  }}
                >
                  Skip this
                </Button>
                <Button
                  onClick={() => {
                    setMoneyErrors(answers.errors);
                    if (!answers.errors.length) setStep(2);
                  }}
                  iconRight={<ArrowRight size={20} aria-hidden />}
                >
                  Continue
                </Button>
              </div>
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="fade-up" aria-labelledby="consent-title">
            <h1 id="consent-title" className="mb-2">Choose what MoneyMap can use</h1>
            <p className="mb-2 text-body-lg text-ink-2">Let MoneyMap understand your financial habits.</p>
            <p className="mb-6 text-ink-3">
              MoneyMap can use selected information from your banking activity to make more relevant recommendations. The more context you give, the more relevant your recommendations can become. You can change this any time.
            </p>
            <div className="mb-3 flex justify-end">
              <Button
                size="sm"
                variant="tertiary"
                onClick={() => setPermissions(Object.fromEntries(PERMISSION_ORDER.map((k) => [k, !allOn])) as Permissions)}
              >
                {allOn ? "Turn all off" : "Allow all"}
              </Button>
            </div>
            <div className="flex flex-col gap-3">
              {PERMISSION_ORDER.map((k) => (
                <PermissionToggle
                  key={k}
                  {...PERMISSION_COPY[k]}
                  checked={permissions[k]}
                  onChange={(v) => setPermissions((p) => ({ ...p, [k]: v }))}
                />
              ))}
            </div>
            <div className="mt-5 rounded-[16px] border border-line bg-surface p-4">
              <p className="mb-2 flex items-center gap-2 font-semibold"><ShieldCheck size={18} className="text-green-700" aria-hidden /> Our promise</p>
              <ul className="flex list-disc flex-col gap-1 pl-5 text-small text-ink-2">
                <li>We never use data you haven't allowed. Withdrawing a permission stops its use straight away.</li>
                <li>We work from monthly patterns. We never see your PIN, passwords or full card details.</li>
                <li>MoneyMap never moves your money, never decides for you, and never guarantees a financial outcome.</li>
                <li>Every recommendation is explained, recorded and can be turned down.</li>
              </ul>
            </div>
            <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
              <Button variant="tertiary" onClick={() => setStep(1)} icon={<ArrowLeft size={20} aria-hidden />}>Back</Button>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setPermissions({ account_activity: false, income_patterns: false, spending_patterns: false, existing_products: false, financial_goals: false });
                    setStep(3);
                  }}
                >
                  Skip for now
                </Button>
                <Button onClick={() => setStep(3)} iconRight={<ArrowRight size={20} aria-hidden />}>Continue</Button>
              </div>
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="fade-up" aria-labelledby="ready-title">
            <h1 id="ready-title" className="mb-6">Your financial map is ready</h1>
            {(() => {
              const tiles = summaryTiles(preview.context);
              const items = [
                { label: "Income", value: tiles.income },
                { label: "Spending", value: tiles.spending },
                { label: "Savings", value: tiles.savings },
                {
                  label: "Goal",
                  value: preview.context.goal
                    ? preview.context.goal.amount > 0
                      ? formatNaira(preview.context.goal.amount)
                      : GOAL_META[preview.context.goal.type].label
                    : "Not shared",
                },
              ];
              return (
                <dl className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
                  {items.map((t) => (
                    <div key={t.label} className="card p-4">
                      <dt className="text-small text-ink-3">{t.label}</dt>
                      <dd className={`text-[18px] font-semibold ${t.value === "Not shared" ? "text-ink-3" : ""}`}>{t.value}</dd>
                    </div>
                  ))}
                </dl>
              );
            })()}

            {preview.status === "recommended" && preview.top ? (
              <div className="rounded-[24px] bg-night p-6 text-white md:p-8">
                <p className="mb-2 flex items-center gap-2 text-caption uppercase tracking-wider text-white/70">
                  <Sparkles size={16} aria-hidden /> Your next opportunity
                </p>
                <p className="mb-6 text-body-lg">{nextOpportunityCopy(preview.top.product.category, preview.top.product.name)}</p>
                <Button onClick={() => finish("/app/recommendation")} iconRight={<ArrowRight size={20} aria-hidden />}>See my recommendation</Button>
              </div>
            ) : (
              <div className="card p-6 md:p-8">
                <p className="eyebrow mb-2">Your next opportunity</p>
                <h2 className="mb-2">Nothing needs your attention.</h2>
                <p className="mb-6 text-ink-3">{preview.message}</p>
                <Button onClick={() => finish("/app/map")}>Review my financial map</Button>
              </div>
            )}

            <div className="mt-6 flex flex-wrap justify-between gap-3">
              <Button variant="tertiary" onClick={() => setStep(2)} icon={<ArrowLeft size={20} aria-hidden />}>Back</Button>
              <Button variant="ghost" onClick={() => finish("/app")}>Go to my MoneyMap</Button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function nextOpportunityCopy(category: string, name: string): string {
  switch (category) {
    case "savings":
      return "You may benefit from keeping your goal money separate from your everyday spending.";
    case "accounts":
      return "Your banking setup may not fit the stage of life you're in right now.";
    case "financing":
      return "You may have a financing option that fits the expense you're planning.";
    default:
      return `${name} may fit your current situation.`;
  }
}

export { nextOpportunityCopy };
