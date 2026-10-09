import { ArrowRight, Banknote, Gift, MonitorPlay, RotateCcw, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useStore } from "../../app/providers/store";
import { CUSTOMERS } from "../../data/customers";
import { Badge } from "../shared/Badge";
import { Button } from "../shared/Button";
import { BottomSheet } from "../shared/Modal";
import { useToast } from "../shared/Toast";

/**
 * Demo Mode (Phase 2 §15) — a presentation tool for the team, not a customer feature.
 * Loads a persona's full financial context instantly, or starts their onboarding.
 */
export function DemoPersonaList({ onDone }: { onDone?: () => void }) {
  const { state, dispatch } = useStore();
  const navigate = useNavigate();
  const toast = useToast();
  return (
    <ul className="flex flex-col gap-3">
      {CUSTOMERS.map((c) => {
        const current = c.id === state.customerId && state.onboarded;
        return (
          <li key={c.id} className={`rounded-[16px] border p-4 ${current ? "border-blue bg-blue-50/50" : "border-line bg-surface"}`}>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-night text-small font-semibold text-white" aria-hidden>{c.firstName[0]}</span>
              <span className="font-semibold">{c.firstName}, {c.age}</span>
              <span className="text-small text-ink-3">· {c.persona}</span>
              {current && <Badge tone="blue">Loaded</Badge>}
            </div>
            <p className="mb-2 text-small text-ink-2">{c.occupation}, {c.city}. {c.story}</p>
            <p className="mb-3 text-small"><span className="text-ink-3">Expected outcome: </span><span className="font-medium">{c.expectedOutcome}</span></p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                icon={<Zap size={16} aria-hidden />}
                onClick={() => {
                  dispatch({ type: "demo_load", customerId: c.id });
                  toast(`${c.firstName}'s financial context loaded.`, "info");
                  onDone?.();
                  navigate("/app");
                }}
              >
                Load instantly
              </Button>
              <Button
                size="sm"
                variant="secondary"
                iconRight={<ArrowRight size={16} aria-hidden />}
                onClick={() => {
                  dispatch({ type: "select_customer", customerId: c.id });
                  onDone?.();
                  navigate("/onboarding");
                }}
              >
                Walk through onboarding
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Step 3: make money arrive on the loaded customer's account, as a core-banking feed would. */
function SimulateActivity({ onSimulate }: { onSimulate: (event: "income" | "windfall") => void }) {
  const { state, customer } = useStore();
  if (!state.onboarded) return null;
  const income = customer.incomeSource === "allowance" ? "Allowance lands" : "Salary lands";
  return (
    <div className="mb-4 rounded-[16px] border border-line bg-canvas p-4">
      <p className="mb-1 font-semibold">Simulate account activity — {customer.firstName}</p>
      <p className="mb-3 text-small text-ink-3">
        Money arrives on today's statement. MoneyMap takes a fresh look and decides whether it's worth a message.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" icon={<Banknote size={16} aria-hidden />} onClick={() => onSimulate("income")}>{income}</Button>
        <Button size="sm" variant="secondary" icon={<Gift size={16} aria-hidden />} onClick={() => onSimulate("windfall")}>Bonus arrives</Button>
      </div>
    </div>
  );
}

export function DemoModeButton() {
  const [open, setOpen] = useState(false);
  const { dispatch, state } = useStore();
  const toast = useToast();
  // Tell the presenter what MoneyMap decided once the event has been processed (locally or by the server).
  const pending = useRef(false);
  const latest = state.triggerEvents[0];
  useEffect(() => {
    if (!pending.current || !latest) return;
    pending.current = false;
    toast(latest.outcome === "notified" ? `Message sent: ${latest.reason}` : `Checked — nothing sent. ${latest.reason}`, latest.outcome === "notified" ? "success" : "info");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latest?.id]);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const inApp = pathname.startsWith("/app");
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`glass fixed left-4 z-40 inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line px-3.5 text-small font-semibold text-ink shadow-[var(--shadow-lift)] hover:border-mint ${
          inApp ? "bottom-20 md:bottom-5" : "bottom-5"
        }`}
        aria-label="Open Demo Mode"
      >
        <MonitorPlay size={18} className="text-green-700" aria-hidden /> Demo
      </button>
      <BottomSheet open={open} onClose={() => setOpen(false)} title="Demo Mode">
        <p className="mb-4 text-small text-ink-3">
          For the presenting team. Load a synthetic customer's full financial context instantly, so judges can see MoneyMap decide without waiting.
        </p>
        <div className="max-h-[60vh] overflow-y-auto pr-1">
          <SimulateActivity
            onSimulate={(event) => {
              pending.current = true;
              dispatch({ type: "simulate_event", event });
              setOpen(false);
            }}
          />
          <DemoPersonaList onDone={() => setOpen(false)} />
        </div>
        <div className="mt-4 flex justify-between gap-3 border-t border-line pt-4">
          <Button
            size="sm"
            variant="ghost"
            icon={<RotateCcw size={16} aria-hidden />}
            onClick={() => {
              dispatch({ type: "reset" });
              setOpen(false);
              navigate("/");
            }}
          >
            Reset everything
          </Button>
          <Button size="sm" variant="tertiary" onClick={() => { setOpen(false); navigate("/admin"); }}>Bank view</Button>
        </div>
      </BottomSheet>
    </>
  );
}
