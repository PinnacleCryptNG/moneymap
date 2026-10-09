import {
  ArrowRight,
  BellRing,
  Building2,
  Check,
  CircleSlash,
  FileSearch,
  Lightbulb,
  LockKeyhole,
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
import { SiteFooter } from "../legal/LegalLayout";

export function LandingPage() {
  const { state, customer, dispatch } = useStore();
  const navigate = useNavigate();

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
    <div className="min-h-screen bg-canvas">
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
              <h1 className="mb-6 !text-[42px] !leading-[1.04] text-white sm:!text-[56px] lg:!text-[64px]">
                Your money, mapped.
                <span className="text-gradient block">One right move.</span>
              </h1>
              <p className="mb-8 max-w-xl text-[18px] leading-[1.6] text-white/75 sm:text-[19px]">
                MoneyMap reads your account — only what you allow — and finds the <strong className="font-semibold text-white">one Zenith product that genuinely helps</strong>. If nothing would, it says so. Every time, it shows you why.
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
            <HeroPreview />
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
            <li key={n} className="card card-hover flex gap-4 p-5 md:p-6">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-green-50 text-green-700"><Icon size={22} aria-hidden /></span>
              <div>
                <p className="mb-1 text-caption font-bold text-ink-3">STEP {n}</p>
                <h3 className="mb-1 !text-[18px]">{title}</h3>
                <p className="text-small text-ink-2">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* ---------- See it decide ---------- */}
      <section className="mx-auto max-w-6xl px-4 pb-6 pt-20 md:px-6" aria-labelledby="demo-title">
        <div className="mb-8 max-w-2xl">
          <p className="eyebrow mb-3 !text-green-700">See it decide</p>
          <h2 id="demo-title" className="mb-3 !text-[30px] sm:!text-[36px]">Two customers. Two honest answers.</h2>
          <p className="text-[17px] text-ink-2">Real-looking Nigerian accounts, synthetic data. Open either one and watch MoneyMap work.</p>
        </div>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {CUSTOMERS.map((c) => {
            const match = c.id === "CUST_SARAH";
            return (
              <article key={c.id} className="card card-hover flex flex-col overflow-hidden">
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
                        <p className="font-display text-[20px] font-bold">SAVE4ME</p>
                        <p className="text-small text-ink-3">₦170,000 left monthly · goal ₦1,000,000</p>
                      </div>
                      <ScoreRing value={95} />
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-canvas text-ink-2"><CircleSlash size={20} aria-hidden /></span>
                      <div>
                        <p className="text-caption font-bold uppercase tracking-wider text-ink-3">Next move</p>
                        <p className="font-display text-[20px] font-bold">Nothing needed</p>
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
        <div className="mb-8 max-w-2xl">
          <p className="eyebrow mb-3 !text-green-700">Why it's different</p>
          <h2 id="why-title" className="!text-[30px] sm:!text-[36px]">The right product, for the right reason.</h2>
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
        <div className="midnight relative mx-auto max-w-6xl overflow-hidden rounded-[28px] px-6 py-14 text-center md:px-12">
          <div className="grid-bg pointer-events-none absolute inset-0" aria-hidden />
          <div className="relative">
            <h2 className="mb-3 !text-[30px] text-white sm:!text-[40px]">Know where you are. Know where to go.</h2>
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
    <div className={`card card-hover p-5 md:p-6 ${className}`}>
      <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-[12px] bg-blue-50 text-blue-600">{icon}</span>
      <h3 className="mb-1.5 !text-[18px]">{title}</h3>
      <p className="text-small text-ink-2">{body}</p>
      {children}
    </div>
  );
}

/** The hero's live preview: statement lines become an insight, then one recommendation. */
function HeroPreview() {
  return (
    <div className="relative mx-auto w-full max-w-[460px] lg:mx-0 lg:ml-auto" aria-hidden="true">
      <div className="float rounded-[28px] border border-white/10 bg-white/[.06] p-4 shadow-[0_40px_80px_-30px_rgb(0_0_0/0.7)] backdrop-blur-md sm:p-5">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-caption font-bold uppercase tracking-wider text-white/55">Reading Sarah's account</p>
          <span className="flex items-center gap-1.5 text-caption text-[#2ee6a8]"><span className="h-1.5 w-1.5 rounded-full bg-[#2ee6a8]" /> live</span>
        </div>
        <div className="flex flex-col gap-2">
          {[
            ["NIP/BRIGHTPATH LTD/SALARY", "+₦450,000", "Salary"],
            ["POS/SHOPRITE LEKKI", "−₦23,400", "Food"],
            ["NIP TRF TO A. NWOSU/RENT", "−₦60,000", "Rent"],
          ].map(([n, a, c], i) => (
            <div key={n} className="slide-in flex items-center justify-between gap-3 rounded-[12px] bg-white/[.06] px-3 py-2.5" style={{ animationDelay: `${300 + i * 260}ms` }}>
              <div className="min-w-0">
                <p className="truncate font-mono text-[12px] text-white/70">{n}</p>
                <p className="text-caption font-semibold text-white/50">{c}</p>
              </div>
              <span className={`shrink-0 font-display text-[14px] font-bold ${a.startsWith("+") ? "text-[#2ee6a8]" : "text-white/85"}`}>{a}</span>
            </div>
          ))}
        </div>

        <div className="fade-up my-4 flex items-center gap-3 rounded-[14px] border border-[#2ee6a8]/25 bg-[#2ee6a8]/10 px-4 py-3" style={{ animationDelay: "1250ms" }}>
          <Sparkles size={18} className="shrink-0 text-[#2ee6a8]" />
          <p className="text-small text-white/90"><strong className="font-semibold text-white">₦170,000</strong> left each month — sitting in her everyday account.</p>
        </div>

        <div className="fade-up rounded-[18px] bg-white p-4 text-[#0a1628] sm:p-5" style={{ animationDelay: "1650ms" }}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-caption font-bold uppercase tracking-wider text-[#047857]">Your next move</p>
              <p className="font-display text-[24px] font-extrabold leading-tight">SAVE4ME</p>
              <p className="text-small text-[#56657c]">≈ ₦83,333 a month → ₦1,000,000 in 12 months</p>
            </div>
            <ScoreRingStatic value={95} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {["Why it fits", "Why now", "What we used"].map((t) => (
              <span key={t} className="rounded-full bg-[#eef2f7] px-3 py-1 text-caption font-semibold text-[#334159]">{t}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Ring with fixed light colours, for the always-white preview card. */
function ScoreRingStatic({ value }: { value: number }) {
  const size = 68;
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="6" stroke="#e2e8f0" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="6" strokeLinecap="round" stroke="#10b981" className="route-draw" style={{ ["--len" as string]: c, strokeDasharray: `${(c * value) / 100} ${c}`, animationDelay: "1900ms" }} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-display text-[16px] font-extrabold">{value}%</span>
    </div>
  );
}
