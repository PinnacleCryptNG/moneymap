import { MessageSquareText, Pencil } from "lucide-react";
import type { Amount, SelfReport } from "../../types";
import { formatNaira } from "../../utils/format";
import { ButtonLink } from "../shared/Button";
import { ACCOUNT_KINDS } from "../forms/MoneyQuestions";

export function amountText(a: Amount): string {
  return a.kind === "exact" ? formatNaira(a.value) : a.kind === "range" ? `${formatNaira(a.min)}–${formatNaira(a.max)}` : "Not sure";
}

/** The customer's own answers, shown back to them on the Map with a way to change them. */
export function YourAnswers({ report, used }: { report: SelfReport | null; used: boolean }) {
  if (!report) {
    return (
      <section className="card flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between md:p-6" aria-labelledby="answers-title">
        <div>
          <h2 id="answers-title" className="!text-[20px]">Prefer to tell us yourself?</h2>
          <p className="text-small text-ink-3">Add your other accounts, side income or expenses — exact amounts, ranges or “I'm not sure”.</p>
        </div>
        <ButtonLink to="/app/my-money" variant="secondary" size="sm">Answer a few questions</ButtonLink>
      </section>
    );
  }
  const rows: [string, string][] = [
    ...report.accounts.map((a): [string, string] => [ACCOUNT_KINDS.find((k) => k.kind === a.kind)!.label, amountText(a.amount)]),
    ["Fixed monthly income", report.fixedIncome ? amountText(report.fixedIncome) : "None"],
    ...report.variableIncome.map((v): [string, string] => [v.title, `${amountText(v.amount)} a month`]),
    ...(report.expenses.mode === "total"
      ? [["Monthly expenses", amountText(report.expenses.total)] as [string, string]]
      : report.expenses.mode === "itemised"
        ? report.expenses.items.map((i): [string, string] => [i.category, amountText(i.amount)])
        : [["Monthly expenses", "Not sure"] as [string, string]]),
  ];
  return (
    <section className="card p-5 md:p-6" aria-labelledby="answers-title">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 id="answers-title" className="flex items-center gap-2 !text-[20px]"><MessageSquareText size={20} className="text-blue" aria-hidden /> What you told us</h2>
        <ButtonLink to="/app/my-money" variant="tertiary" size="sm" icon={<Pencil size={16} aria-hidden />}>Edit answers</ButtonLink>
      </div>
      <p className="mb-3 text-small text-ink-3">
        {used
          ? "Some of the figures on your map come from these answers, because you haven't shared that part of your Zenith account."
          : "Your shared Zenith account covers these figures, so MoneyMap is using your statement instead. Your answers are kept for reference."}
      </p>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
        {rows.map(([k, v], i) => (
          <div key={`${k}-${i}`} className="flex justify-between gap-3 border-b border-line py-1.5 text-small">
            <dt className="text-ink-2">{k}</dt>
            <dd className="font-medium tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
