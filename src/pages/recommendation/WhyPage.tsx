import { ArrowLeft, BadgeCheck, CalendarClock, CircleAlert, CircleCheck, CircleHelp, Database, ExternalLink, Flag, Lock, Package, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { consideredAlternatives, WhyNotList } from "../../components/recommendations/WhyNotList";
import { Badge } from "../../components/shared/Badge";
import { ButtonLink } from "../../components/shared/Button";
import { WEIGHTS } from "../../engine";
import { PERMISSION_COPY, PERMISSION_ORDER } from "../../services/consent";
import { useEngineResult } from "../../services/recommendation";

const FACTOR_LABELS: { key: keyof typeof WEIGHTS; label: string; hint: string }[] = [
  { key: "needFit", label: "Need fit", hint: "How strongly your situation shows the need this product meets" },
  { key: "goalFit", label: "Goal fit", hint: "How directly it serves the goal you set" },
  { key: "behaviourFit", label: "Behaviour fit", hint: "How many of the product's signals appear in your activity" },
  { key: "eligibilityFit", label: "Eligibility", hint: "Published conditions and MoneyMap's checks" },
  { key: "timingFit", label: "Timing", hint: "Whether now is the right moment" },
  { key: "preferenceFit", label: "Your preferences", hint: "Whether you've asked for this kind of help" },
];

function Section({ icon, title, children, tone = "blue" }: { icon: ReactNode; title: string; children: ReactNode; tone?: "blue" | "green" }) {
  return (
    <div className="flex gap-4 p-5 md:p-6">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${tone === "green" ? "bg-green-50 text-green-700" : "bg-blue-50 text-blue"}`}>{icon}</span>
      <div className="min-w-0 flex-1">
        <h2 className="mb-1 !text-[18px] !leading-7">{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function WhyPage() {
  const [params] = useSearchParams();
  const more = params.get("more") === "1";
  const result = useEngineResult(more);
  if (!result.top || !result.explanation) return <Navigate to="/app/recommendation" replace />;
  const { top, explanation: ex, context: ctx } = result;
  const alternatives = consideredAlternatives(result.ranked, top.product.product_id);
  const penalties = top.factors.irrelevancePenalty + top.factors.overexposurePenalty;

  return (
    <div className="flex flex-col gap-6">
      <Link to={`/app/recommendation${more ? "?more=1" : ""}`} className="inline-flex min-h-11 w-fit items-center gap-1 font-medium text-blue-600 hover:underline">
        <ArrowLeft size={18} aria-hidden /> Back to recommendation
      </Link>
      <header>
        <p className="eyebrow mb-1">Why this?</p>
        <h1>Why did MoneyMap recommend {top.product.name}?</h1>
        <p className="mt-2 max-w-2xl text-navy-500">Every recommendation is built from your goal, the information you allowed, the product's purpose and the timing. Here's exactly what was used.</p>
      </header>

      <section className="card divide-y divide-mist" aria-label="Explanation">
        <Section icon={<Flag size={20} aria-hidden />} title="Your goal">
          <p className="text-navy-700">{ex.goal ?? "You haven't shared a goal, so MoneyMap worked from your financial activity."}</p>
        </Section>
        <Section icon={<Wallet size={20} aria-hidden />} title="Your financial context">
          <ul className="flex list-disc flex-col gap-1 pl-5 text-navy-700">
            {ex.context.map((c) => <li key={c}>{c}</li>)}
          </ul>
        </Section>
        <Section icon={<Package size={20} aria-hidden />} title="The product fit">
          <p className="text-navy-700">{ex.productFit}</p>
        </Section>
        <Section icon={<CalendarClock size={20} aria-hidden />} title="The timing">
          <p className="text-navy-700">{ex.timing}</p>
        </Section>
        <Section icon={<Database size={20} aria-hidden />} title="Your data">
          <p className="mb-3 text-navy-700">Only the categories you allowed. You can change these any time in Settings.</p>
          <div className="flex flex-wrap gap-2">
            {PERMISSION_ORDER.map((k) =>
              ex.dataUsed.includes(k) ? (
                <Badge key={k} tone="green" icon={<CircleCheck size={14} aria-hidden />}>{PERMISSION_COPY[k].title} — used</Badge>
              ) : (
                <Badge key={k} icon={<Lock size={12} aria-hidden />}>{PERMISSION_COPY[k].title} — {ctx.permissions[k] ? "not needed" : "not shared"}</Badge>
              ),
            )}
          </div>
        </Section>
        <Section icon={<BadgeCheck size={20} aria-hidden />} title="Eligibility" tone="green">
          <p className="mb-3 text-navy-700">{ex.eligibility}</p>
          {top.eligibility.checks.length > 0 && (
            <ul className="flex flex-col gap-2">
              {top.eligibility.checks.map((c) => (
                <li key={c.label} className="flex items-start gap-2 text-small">
                  {c.status === "pass" ? <CircleCheck size={18} className="mt-0.5 shrink-0 text-green-700" aria-label="Met" /> : c.status === "fail" ? <CircleAlert size={18} className="mt-0.5 shrink-0 text-red" aria-label="Not met" /> : <CircleHelp size={18} className="mt-0.5 shrink-0 text-amber-700" aria-label="To confirm" />}
                  <span className="min-w-0">
                    <span className="font-medium">{c.label}</span> — {c.detail}{" "}
                    <span className="text-navy-500">({c.basis === "published" ? "published condition" : "MoneyMap check"})</span>
                    {c.source && (
                      <a href={c.source} target="_blank" rel="noreferrer" className="ml-1 inline-flex items-center gap-0.5 text-blue-600 hover:underline">
                        source <ExternalLink size={12} aria-hidden />
                      </a>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
        <div className="p-5 md:p-6">
          <h2 className="mb-2 !text-[18px] !leading-7">What you can do next</h2>
          <ol className="mb-4 list-inside list-decimal text-navy-700">{ex.nextSteps.map((s) => <li key={s}>{s}</li>)}</ol>
          <ButtonLink to={`/app/products/${top.product.product_id}`}>View product</ButtonLink>
        </div>
      </section>

      <section className="card overflow-x-auto p-5 md:p-6" aria-labelledby="score-title">
        <h2 id="score-title" className="mb-1 !text-[18px] !leading-7">How the {top.score}% match was calculated</h2>
        <p className="mb-4 text-small text-navy-500">Not a mysterious AI percentage — a weighted score you can check. Prototype weights; production weights would be validated and governed.</p>
        <table className="w-full min-w-[480px] text-small">
          <caption className="sr-only">Score breakdown by factor</caption>
          <thead>
            <tr className="text-left text-navy-500">
              <th scope="col" className="pb-2 font-medium">Factor</th>
              <th scope="col" className="pb-2 font-medium">Weight</th>
              <th scope="col" className="w-2/5 pb-2 font-medium">Your fit</th>
              <th scope="col" className="pb-2 text-right font-medium">Points</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-mist">
            {FACTOR_LABELS.map(({ key, label, hint }) => {
              const v = top.factors[key];
              return (
                <tr key={key}>
                  <th scope="row" className="py-2.5 pr-2 text-left font-medium">
                    {label}
                    <span className="block text-caption !font-normal text-navy-500">{hint}</span>
                  </th>
                  <td className="py-2.5 tabular-nums">{Math.round(WEIGHTS[key] * 100)}%</td>
                  <td className="py-2.5 pr-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-mist"><div className="h-full rounded-full bg-blue" style={{ width: `${v}%` }} /></div>
                      <span className="w-9 text-right tabular-nums">{v}</span>
                    </div>
                  </td>
                  <td className="py-2.5 text-right font-semibold tabular-nums">{(v * WEIGHTS[key]).toFixed(1)}</td>
                </tr>
              );
            })}
            {penalties > 0 && (
              <tr>
                <th scope="row" className="py-2.5 text-left font-medium">Penalties</th>
                <td colSpan={2} className="py-2.5 text-navy-500">Irrelevance / overexposure</td>
                <td className="py-2.5 text-right font-semibold tabular-nums text-red">−{penalties}</td>
              </tr>
            )}
            <tr>
              <th scope="row" className="pt-3 text-left font-semibold">Match score</th>
              <td colSpan={2} className="pt-3 text-navy-500">Strong ≥ 80 · Potential 65–79 · Below 65 not recommended</td>
              <td className="pt-3 text-right text-[18px] font-bold tabular-nums">{top.score}</td>
            </tr>
          </tbody>
        </table>
      </section>

      {alternatives.length > 0 && (
        <section className="card p-5 md:p-6" aria-labelledby="else-title">
          <h2 id="else-title" className="mb-1 !text-[18px] !leading-7">Why not something else?</h2>
          <p className="mb-4 text-small text-navy-500">Other Zenith products MoneyMap considered, and why they weren't chosen.</p>
          <WhyNotList items={alternatives} />
        </section>
      )}
    </div>
  );
}
