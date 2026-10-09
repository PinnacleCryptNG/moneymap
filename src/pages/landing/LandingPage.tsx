import {
  ArrowRight,
  BellRing,
  Building2,
  Check,
  CircleSlash,
  FileSearch,
  Lightbulb,
  LockKeyhole,
  MousePointer2,
  MessageSquareText,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useStore } from "../../app/providers/store";
import { Button } from "../../components/shared/Button";
import { Logo } from "../../components/shared/Logo";
import { ThemeToggle } from "../../components/shared/ThemeToggle";
import { CUSTOMERS } from "../../data/customers";
import { ScoreRing } from "../../components/shared/ScoreRing";
import { RouteChart } from "../../components/charts/RouteChart";
import { useReveal } from "../../utils/motion";
import { SiteFooter } from "../legal/LegalLayout";

export function LandingPage() {
  const { state, customer, dispatch } = useStore();
  const navigate = useNavigate();
  const page = useReveal<HTMLDivElement>();

  const build = () => {
    // Starts a fresh MoneyMap (and, in API mode, a server session) for the current demo customer.
    dispatch({ type: "select_customer", customerId: state.customerId });
    navigate("/onboarding");
  };
  const tryLive = (customerId: string) => {
    dispatch({ type: "demo_load", customerId });
    navigate("/app");
  };

  return (
    <div ref={page} className="min-h-screen bg-canvas">
      {/* ---------- Hero: what it is, in one look ---------- */}
      <div className="midnight relative overflow-hidden">
        <div className="grid-bg pointer-events-none absolute inset-0" aria-hidden />
        <div className="drift pointer-events-none absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full bg-[#2ee6a8]/15 blur-3xl" aria-hidden />
        <div className="drift pointer-events-none absolute -bottom-48 -left-40 h-[520px] w-[520px] rounded-full bg-[#2f6bff]/20 blur-3xl [animation-delay:-8s]" aria-hidden />

        <header className="relative mx-auto flex h-18 max-w-6xl items-center justify-between px-4 py-3 md:px-6">
          <Link to="/" aria-label="MoneyMap home"><Logo inverted /></Link>
          <nav className="flex items-center gap-1" aria-label="Site">
            <a href="#how" onClick={(e) => { e.preventDefault(); document.getElementById("how")?.scrollIntoView({ behavior: "smooth" }); }} className="hidden min-h-11 items-center rounded-[10px] px-3 text-small font-medium text-white/75 hover:bg-white/10 hover:text-white sm:inline-flex">
              How it works
            </a>
            <Link to="/admin" className="inline-flex min-h-11 items-center rounded-[10px] px-3 text-small font-medium text-white/75 hover:bg-white/10 hover:text-white">
              Bank view
            </Link>
            <ThemeToggle onDark />
            {state.onboarded && (
              <Link to="/app" className="ml-1 hidden min-h-11 items-center rounded-[12px] bg-white/10 px-4 text-small font-semibold text-white hover:bg-white/15 sm:inline-flex">
                Open {customer.firstName}'s map
              </Link>
            )}
          </nav>
        </header>

        <main id="main" className="relative">
          <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-10 md:px-6 lg:grid-cols-[1.05fr_1fr] lg:pb-28 lg:pt-16">
            <div className="stagger">
              <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-small font-medium text-white/80">
                <span className="relative flex h-2 w-2" aria-hidden>
                  <span className="ping absolute inline-flex h-full w-full rounded-full bg-[#2ee6a8]" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#2ee6a8]" />
                </span>
                Smart product matching for Zenith Bank
              </p>
              <h1 className="mb-6 !text-[44px] !font-semibold !leading-[1.02] !tracking-[-0.045em] text-white sm:!text-[58px] lg:!text-[68px]">
                Your money, <span className="accent-serif text-mint">mapped.</span>
                <span className="block text-white/90">One right move.</span>
              </h1>
              <p className="mb-8 max-w-[34rem] text-[18px] leading-[1.6] text-white/70">
                MoneyMap reads only what you allow, then shows the <strong className="font-medium text-white">one Zenith product that genuinely helps</strong> — and why. If nothing would, it says so.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button onClick={build} iconRight={<ArrowRight size={20} aria-hidden />} className="!min-h-13 !px-6 !text-[17px]">
                  Build my MoneyMap
                </Button>
                <button
                  type="button"
                  onClick={() => tryLive("CUST_SARAH")}
                  className="inline-flex min-h-13 items-center gap-2 rounded-[12px] border border-white/20 bg-white/5 px-6 text-[17px] font-semibold text-white transition-colors hover:bg-white/10"
                >
                  <Zap size={18} className="text-[#2ee6a8]" aria-hidden /> Try a live account
                </button>
              </div>
              <ul className="mt-9 flex flex-wrap gap-x-6 gap-y-2 text-small text-white/70">
                {["You choose what's shared", "No invented rates or fees", "“Nothing needed” is an answer"].map((t) => (
                  <li key={t} className="flex items-center gap-2"><Check size={16} className="text-[#2ee6a8]" aria-hidden /> {t}</li>
                ))}
              </ul>
            </div>
            <div className="fade-up relative mx-auto w-full max-w-[560px] lg:mx-0 lg:ml-auto" style={{ animationDelay: "250ms" }}>
              <div className="rounded-[28px] border border-white/10 bg-white/[.03] p-1.5 shadow-[0_40px_80px_-30px_rgb(0_0_0/0.8)]">
                <RouteChart target={1_000_000} saved={0} surplus={170_000} timelineMonths={12} goalLabel="Sarah · ₦1,000,000 savings goal" nextMove="SAVE4ME" compact />
              </div>
              <p className="mt-3 flex items-center justify-center gap-2 text-small text-white/55 lg:justify-end">
                <MousePointer2 size={14} aria-hidden className="text-mint" /> Drag across the route, or move the slider
              </p>
            </div>
          </section>
        </main>
      </div>

      {/* ---------- Three steps ---------- */}
      <section id="how" className="relative mx-auto -mt-10 max-w-6xl scroll-mt-6 px-4 md:px-6" aria-labelledby="how-title">
        <h2 id="how-title" className="sr-only">How it works</h2>
        <ol className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[
            { icon: LockKeyhole, n: "1", title: "You choose what to share", body: "Five plain-language permissions — or simply tell us about your money in your own words." },
            { icon: ScanSearch, n: "2", title: "MoneyMap reads the pattern", body: "Salary, spending, savings habits and goals, worked out from your real statement lines." },
            { icon: Lightbulb, n: "3", title: "One clear next move", body: "The single product that fits, why it fits, and why now. Or an honest “nothing needed”." },
          ].map(({ icon: Icon, n, title, body }) => (
            <li key={n} className="reveal card card-hover flex gap-4 p-5 md:p-6" style={{ transitionDelay: `${Number(n) * 80}ms` }}>
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-green-50 text-green-700"><Icon size={22} aria-hidden /></span>
              <div>
                <p className="mb-1 font-mono text-[12px] text-ink-3">0{n}</p>
                <h3 className="mb-1 !text-[18px]">{title}</h3>
                <p className="text-small text-ink-2">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* ---------- See it decide ---------- */}
      <section className="mx-auto max-w-6xl px-4 pb-6 pt-20 md:px-6" aria-labelledby="demo-title">
        <div className="reveal mb-8 max-w-2xl">
          <p className="eyebrow mb-3 !text-green-700">See it decide</p>
          <h2 id="demo-title" className="mb-3 !text-[30px] sm:!text-[40px]">Two customers. Two <span className="accent-serif">honest</span> answers.</h2>
          <p className="text-[17px] text-ink-2">Real-looking Nigerian accounts, synthetic data. Open either one and watch MoneyMap work.</p>
        </div>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {CUSTOMERS.map((c) => {
            const match = c.id === "CUST_SARAH";
            return (
              <article key={c.id} className="reveal card card-hover flex flex-col overflow-hidden">
                <div className="flex items-center gap-3 p-5 md:p-6">
                  <span className={`flex h-12 w-12 items-center justify-center rounded-full font-display text-[18px] font-bold ${match ? "bg-mint text-night" : "bg-night text-white"}`} aria-hidden>{c.firstName[0]}</span>
                  <div>
                    <h3 className="!text-[18px]">{c.firstName}, {c.age}</h3>
                    <p className="text-small text-ink-3">{c.occupation} · {c.city}</p>
                  </div>
                </div>
                <p className="px-5 text-ink-2 md:px-6">{c.story}</p>
                <div className="m-5 mt-5 rounded-[16px] border border-line bg-surface-2 p-4 md:m-6">
                  {match ? (
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-caption font-bold uppercase tracking-wider text-green-700">Next move</p>
                        <p className="font-display text-[20px] font-semibold">SAVE4ME</p>
                        <p className="text-small text-ink-3">₦170,000 left monthly · goal ₦1,000,000</p>
                      </div>
                      <ScoreRing value={95} />
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-canvas text-ink-2"><CircleSlash size={20} aria-hidden /></span>
                      <div>
                        <p className="text-caption font-bold uppercase tracking-wider text-ink-3">Next move</p>
                        <p className="font-display text-[20px] font-semibold">Nothing needed</p>
                        <p className="text-small text-ink-3">Already well served — so MoneyMap stays quiet.</p>
                      </div>
                    </div>
                  )}
                </div>
                <div className="mt-auto flex flex-wrap gap-3 border-t border-line p-5 md:px-6">
                  <Button size="sm" onClick={() => tryLive(c.id)} iconRight={<ArrowRight size={16} aria-hidden />}>Open {c.firstName}'s account</Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      dispatch({ type: "select_customer", customerId: c.id });
                      navigate("/onboarding");
                    }}
                  >
                    Walk through sign-up
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* ---------- Why it's different ---------- */}
      <section className="mx-auto max-w-6xl px-4 py-20 md:px-6" aria-labelledby="why-title">
        <div className="reveal mb-8 max-w-2xl">
          <p className="eyebrow mb-3 !text-green-700">Why it's different</p>
          <h2 id="why-title" className="!text-[30px] sm:!text-[40px]">The right product, for the <span className="accent-serif">right reason.</span></h2>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
          <Feature className="md:col-span-4" icon={<FileSearch size={20} aria-hidden />} title="Reads real statements, not forms" body="A categoriser built for Nigerian bank narrations — NIP, POS, WEB, REMITA, ATM — turns raw lines into income, spending and habits.">
            <div className="mt-4 flex flex-col gap-2 font-mono text-[12.5px]">
              {[
                ["NIP/BRIGHTPATH LOGISTICS LTD/SALARY", "Salary"],
                ["POS/SHOPRITE LEKKI/LA NG", "Food"],
                ["IKEDC PREPAID/TOKEN 4512 8803 2210", "Electricity"],
              ].map(([n, c]) => (
                <div key={n} className="flex items-center justify-between gap-3 rounded-[10px] bg-canvas px-3 py-2">
                  <span className="truncate text-ink-2">{n}</span>
                  <span className="shrink-0 rounded-full bg-green-50 px-2 py-0.5 font-sans text-caption font-semibold text-green-700">{c}</span>
                </div>
              ))}
            </div>
          </Feature>
          <Feature className="md:col-span-2" icon={<CircleSlash size={20} aria-hidden />} title="Knows when to say nothing" body="If no product would meaningfully help, there's no recommendation. That's why the ones it makes are worth reading." />
          <Feature className="md:col-span-2" icon={<BellRing size={20} aria-hidden />} title="Speaks up at the right moment" body="Salary lands? It takes a fresh look — and messages at most once a week." />
          <Feature className="md:col-span-2" icon={<MessageSquareText size={20} aria-hidden />} title="Explains every answer" body="Why it fits, why now, what it used — and why the other products weren't picked." />
          <Feature className="md:col-span-2" icon={<ShieldCheck size={20} aria-hidden />} title="Your data, your rules" body="Switch any permission off instantly. Download or delete everything in one tap." />
          <Feature className="md:col-span-3" icon={<Sparkles size={20} aria-hidden />} title="No invented terms" body="Only Zenith's published product facts, each with its source. Anything else is “subject to Zenith Bank's current requirements”." />
          <Feature className="md:col-span-3" icon={<Building2 size={20} aria-hidden />} title="Built to plug into Zenith" body="Sign-in, statements, messaging and product requests each sit behind an adapter — demo to live is configuration." />
        </div>
      </section>

      {/* ---------- Closing call to action ---------- */}
      <section className="px-4 pb-20 md:px-6">
        <div className="reveal midnight relative mx-auto max-w-6xl overflow-hidden rounded-[28px] px-6 py-14 text-center md:px-12">
          <div className="grid-bg pointer-events-none absolute inset-0" aria-hidden />
          <div className="relative">
            <h2 className="mb-3 !text-[30px] text-white sm:!text-[44px]">Know where you are. <span className="accent-serif text-mint">Know where to go.</span></h2>
            <p className="mx-auto mb-8 max-w-xl text-[17px] text-white/75">It takes about a minute. Share only what you want, and see your map — and your one right move.</p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button onClick={build} iconRight={<ArrowRight size={20} aria-hidden />}>Start my MoneyMap</Button>
              <button type="button" onClick={() => tryLive("CUST_TOLU")} className="inline-flex min-h-12 items-center rounded-[12px] border border-white/20 bg-white/5 px-5 font-semibold text-white hover:bg-white/10">
                See an honest “no”
              </button>
            </div>
            <p className="mx-auto mt-10 max-w-2xl text-caption !font-normal text-white/55">
              Zenith Bank Zecathon 6.0 · Challenge #9 — Intelligent Customer Product Matching. Prototype on synthetic data. Product information comes from public sources and is subject to Zenith Bank's current requirements.
            </p>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

function Feature({ icon, title, body, className = "", children }: { icon: ReactNode; title: string; body: string; className?: string; children?: ReactNode }) {
  return (
    <div className={`reveal card card-hover p-5 md:p-6 ${className}`}>
      <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-[12px] bg-blue-50 text-blue-600">{icon}</span>
      <h3 className="mb-1.5 !text-[18px]">{title}</h3>
      <p className="text-small text-ink-2">{body}</p>
      {children}
    </div>
  );
}
