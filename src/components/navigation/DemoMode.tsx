import { ArrowRight, MonitorPlay, RotateCcw, Zap } from "lucide-react";
import { useState } from "react";
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
          <li key={c.id} className={`rounded-[16px] border p-4 ${current ? "border-blue bg-blue-50/50" : "border-mist bg-white"}`}>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-navy text-small font-semibold text-white" aria-hidden>{c.firstName[0]}</span>
              <span className="font-semibold">{c.firstName}, {c.age}</span>
              <span className="text-small text-navy-500">· {c.persona}</span>
              {current && <Badge tone="blue">Loaded</Badge>}
            </div>
            <p className="mb-2 text-small text-navy-700">{c.occupation}, {c.city}. {c.story}</p>
            <p className="mb-3 text-small"><span className="text-navy-500">Expected outcome: </span><span className="font-medium">{c.expectedOutcome}</span></p>
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

export function DemoModeButton() {
  const [open, setOpen] = useState(false);
  const { dispatch } = useStore();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const inApp = pathname.startsWith("/app");
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`fixed left-4 z-40 inline-flex min-h-11 items-center gap-1.5 rounded-full border border-mist bg-white/95 px-3.5 text-small font-semibold text-navy-700 shadow-md backdrop-blur hover:bg-white ${
          inApp ? "bottom-20 md:bottom-5" : "bottom-5"
        }`}
        aria-label="Open Demo Mode"
      >
        <MonitorPlay size={18} aria-hidden /> Demo
      </button>
      <BottomSheet open={open} onClose={() => setOpen(false)} title="Demo Mode">
        <p className="mb-4 text-small text-navy-500">
          For the presenting team. Load a synthetic customer's full financial context instantly, so judges can see MoneyMap decide without waiting.
        </p>
        <div className="max-h-[60vh] overflow-y-auto pr-1">
          <DemoPersonaList onDone={() => setOpen(false)} />
        </div>
        <div className="mt-4 flex justify-between gap-3 border-t border-mist pt-4">
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
