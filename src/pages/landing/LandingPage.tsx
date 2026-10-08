import { ArrowRight, Check, Eye, Filter, Lightbulb, MessageSquareText, Search, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useStore } from "../../app/providers/store";
import { DemoPersonaList } from "../../components/navigation/DemoMode";
import { Button, ButtonLink } from "../../components/shared/Button";
import { Logo } from "../../components/shared/Logo";
import { Modal } from "../../components/shared/Modal";

const STAGES = [
  { icon: Search, title: "Understand", body: "Builds your financial picture from only the data you allow." },
  { icon: Lightbulb, title: "Detect", body: "Spots the need behind your situation — before any product." },
  { icon: Filter, title: "Match", body: "Checks Zenith products against that need and rules out any you don't qualify for." },
  { icon: Check, title: "Decide", body: "Weighs fit, eligibility, timing and your preferences. If nothing is strong enough, it says so." },
  { icon: MessageSquareText, title: "Explain", body: "Tells you why this, why you, why now — and you decide." },
];

export function LandingPage() {
  const { state, customer, dispatch } = useStore();
  const [howOpen, setHowOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white">
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-6">
        <Logo />
        <nav className="flex items-center gap-1" aria-label="Site">
          <Link to="/admin" className="inline-flex min-h-11 items-center rounded-[10px] px-3 text-small font-medium text-navy-500 hover:bg-cloud hover:text-navy">
            Bank view
          </Link>
          {state.onboarded && <ButtonLink to="/app" size="sm" variant="secondary">Open {customer.firstName}'s MoneyMap</ButtonLink>}
        </nav>
      </header>

      <main id="main">
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-14 pt-8 md:grid-cols-[1.1fr_1fr] md:px-6 md:pt-14">
          <div className="fade-up">
            <p className="eyebrow mb-4 !text-green-700">MoneyMap for Zenith Bank</p>
            <h1 className="mb-5 !text-[38px] !leading-[46px] md:!text-[44px] md:!leading-[52px]">
              Know where you are.<br />Know where to go.
            </h1>
            <p className="text-body-lg mb-8 max-w-xl text-navy-700">
              Money comes in, money goes out, you have a goal — and the bank has many products. MoneyMap works out which one actually makes sense for you right now, explains why, and leaves the decision to you.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={() => {
                  // Starts a fresh MoneyMap (and, in API mode, a server session) for the current demo customer.
                  dispatch({ type: "select_customer", customerId: state.customerId });
                  navigate("/onboarding");
                }}
                iconRight={<ArrowRight size={20} aria-hidden />}
              >
                Build my MoneyMap
              </Button>
              <Button variant="secondary" onClick={() => setHowOpen(true)}>How it works</Button>
            </div>
            <p className="mt-6 flex items-center gap-2 text-small text-navy-500">
              <ShieldCheck size={18} className="text-green-700" aria-hidden /> Your data. Your permission. Your map.
            </p>
          </div>
          <HeroRoute />
        </section>

        <section className="border-y border-mist bg-cloud">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-2 md:px-6">
            <div>
              <p className="eyebrow mb-2">The problem</p>
              <h2 className="mb-3">Zenith doesn't lack products. Customers lack a way to know which one fits.</h2>
              <p className="text-navy-700">Nobody wakes up needing “Product X”. They wake up wanting to save for rent, finish school, or buy a car. The need comes before the product.</p>
            </div>
            <div className="flex flex-col justify-center gap-4">
              <Flow label="Traditional banking" steps={["Product", "Customer"]} muted />
              <Flow label="MoneyMap" steps={["Customer", "Context", "Need", "Fit", "Timing", "Product"]} />
              <p className="rounded-[12px] border border-mist bg-white p-3 text-small text-navy-700">
                <span className="font-semibold">Goal + Context + Fit + Timing = a relevant recommendation.</span> If the match isn't strong enough, MoneyMap recommends nothing.
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-4 py-12 md:px-6" aria-labelledby="demo-title">
          <p className="eyebrow mb-2">See it decide</p>
          <h2 id="demo-title" className="mb-2">Three customers, three different answers</h2>
          <p className="mb-6 text-navy-500">
            Synthetic Nigerian customers — no real data. One gets a savings plan, one gets a student account, and one gets nothing, because nothing would genuinely help.
          </p>
          <DemoPersonaList />
        </section>

        <section className="bg-navy text-white">
          <div className="mx-auto max-w-6xl px-4 py-12 md:px-6">
            <p className="text-body-lg max-w-3xl text-white/90">
              MoneyMap doesn't put more products in front of customers. It puts the right one in front of the right person, at the right moment, for the right reason.
            </p>
            <p className="mt-6 text-small text-white/70">
              Zenith Bank Zecathon 6.0 · Challenge #9 — Intelligent Customer Product Matching. Prototype on synthetic data. Product information comes from public sources and is subject to Zenith Bank's current requirements.
            </p>
          </div>
        </section>
      </main>

      <Modal open={howOpen} onClose={() => setHowOpen(false)} title="How MoneyMap decides">
        <ol className="flex flex-col gap-4">
          {STAGES.map(({ icon: Icon, title, body }, i) => (
            <li key={title} className="flex gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue"><Icon size={20} aria-hidden /></span>
              <div>
                <p className="font-semibold">{i + 1}. {title}</p>
                <p className="text-small text-navy-500">{body}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-5 flex items-start gap-2 rounded-[12px] bg-cloud p-3 text-small text-navy-700">
          <Eye size={18} className="mt-0.5 shrink-0" aria-hidden /> No recommendation is a valid recommendation — if nothing would meaningfully help, MoneyMap tells you that instead.
        </p>
      </Modal>
    </div>
  );
}

function Flow({ label, steps, muted = false }: { label: string; steps: string[]; muted?: boolean }) {
  return (
    <div>
      <p className={`mb-2 text-small font-semibold ${muted ? "text-navy-500" : "text-navy"}`}>{label}</p>
      <ol className="flex flex-wrap items-center gap-1.5">
        {steps.map((s, i) => (
          <li key={s} className="flex items-center gap-1.5">
            <span className={`rounded-full px-3 py-1 text-small font-medium ${muted ? "border border-mist bg-white text-navy-500" : i === steps.length - 1 ? "bg-green text-white" : "bg-blue-50 text-blue-600"}`}>{s}</span>
            {i < steps.length - 1 && <ArrowRight size={14} className="text-navy-500" aria-hidden />}
          </li>
        ))}
      </ol>
    </div>
  );
}

function HeroRoute() {
  return (
    <div className="relative mx-auto w-full max-w-md" aria-hidden="true">
      <svg viewBox="0 0 400 360" className="w-full">
        <defs>
          <pattern id="hero-grid" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#E4EAF1" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="400" height="360" rx="24" fill="url(#hero-grid)" />
        <path d="M 70 300 C 150 300, 140 190, 210 180 S 300 70, 330 60" fill="none" stroke="#E4EAF1" strokeWidth="14" strokeLinecap="round" />
        <path d="M 70 300 C 150 300, 140 190, 210 180 S 300 70, 330 60" fill="none" stroke="#1677FF" strokeWidth="5" strokeLinecap="round" className="route-draw" style={{ ["--len" as string]: 420 }} />
        <circle cx="70" cy="300" r="14" fill="#fff" stroke="#1677FF" strokeWidth="5" />
        <circle cx="210" cy="180" r="12" fill="#fff" stroke="#0B1F33" strokeWidth="5" />
        <circle cx="330" cy="60" r="16" fill="#18A874" />
        <circle cx="330" cy="60" r="6" fill="#fff" />
      </svg>
      <Tag style={{ left: "4%", bottom: "4%" }} title="You are here" body="₦170,000 left each month" />
      <Tag style={{ left: "40%", top: "52%" }} title="Next move" body="SAVE4ME" />
      <Tag style={{ right: "0%", top: "24%" }} title="Your goal" body="Save ₦1,000,000" green />
    </div>
  );
}

function Tag({ style, title, body, green = false }: { style: React.CSSProperties; title: string; body: string; green?: boolean }) {
  return (
    <div className="absolute rounded-[12px] border border-mist bg-white px-3 py-2 shadow-sm" style={style}>
      <p className={`text-caption uppercase tracking-wide ${green ? "text-green-700" : "text-navy-500"}`}>{title}</p>
      <p className="text-small font-semibold">{body}</p>
    </div>
  );
}
