import { Download, RotateCcw, ShieldOff, Trash2, UserRound } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../../app/providers/store";
import { PermissionToggle } from "../../components/forms/PermissionToggle";
import { PreferenceSelector } from "../../components/forms/PreferenceSelector";
import { Button, ButtonLink } from "../../components/shared/Button";
import { Modal } from "../../components/shared/Modal";
import { PageHeader } from "../../components/shared/PageHeader";
import { useToast } from "../../components/shared/Toast";
import { PERMISSION_COPY, PERMISSION_ORDER } from "../../services/consent";
import { API_MODE, http } from "../../services/http";

/** Save a JSON document to the customer's device. */
function download(filename: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function SettingsPage() {
  const { state, dispatch, customer } = useStore();
  const toast = useToast();
  const navigate = useNavigate();
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const [confirmErase, setConfirmErase] = useState(false);
  const [exporting, setExporting] = useState(false);

  const exportData = async () => {
    setExporting(true);
    try {
      const data = API_MODE
        ? await http.exportMyData()
        : {
            exported_at: new Date().toISOString(),
            customer: { id: customer.id, name: customer.name },
            consent: { current: state.permissions, history: state.consentLog },
            goals: state.goals,
            preferences: state.preferences,
            recommendations: state.recommendations,
            messages: state.notifications,
            events_noticed: state.triggerEvents,
            product_requests: state.applications,
            your_answers: state.selfReport,
          };
      download(`moneymap-data-${customer.id}.json`, data);
      toast("Your MoneyMap data has been downloaded.", "success");
    } catch (e) {
      toast(`Couldn't export your data: ${(e as Error).message}`, "info");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Profile & settings" title="Your data. Your permission. Your map." body="You decide what MoneyMap can use to personalise your experience — and what kind of help you want." />

      <section className="card flex flex-wrap items-center gap-4 p-5 md:p-6">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-night text-[20px] font-semibold text-white" aria-hidden>{customer.firstName[0]}</span>
        <div className="flex-1">
          <p className="font-semibold">{customer.name}</p>
          <p className="text-small text-ink-3">Demo customer · {customer.persona} · synthetic data</p>
        </div>
        <ButtonLink to="/" variant="secondary" size="sm" icon={<UserRound size={18} aria-hidden />}>Switch demo customer</ButtonLink>
      </section>

      <section aria-labelledby="perm-title">
        <h2 id="perm-title" className="mb-1">Permissions</h2>
        <p className="mb-4 text-ink-3">Changes apply immediately. Withdrawn data stops being used for personalisation straight away.</p>
        <div className="flex flex-col gap-3">
          {PERMISSION_ORDER.map((k) => (
            <PermissionToggle
              key={k}
              {...PERMISSION_COPY[k]}
              checked={state.permissions[k]}
              onChange={(v) => {
                dispatch({ type: "set_permission", key: k, granted: v });
                toast(v ? `${PERMISSION_COPY[k].title} allowed.` : `${PERMISSION_COPY[k].title} withdrawn — no longer used.`, "info");
              }}
            />
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button variant="danger" icon={<ShieldOff size={18} aria-hidden />} onClick={() => setConfirmWithdraw(true)}>Withdraw all consent</Button>
          <ButtonLink to="/app/goals" variant="ghost">Manage or delete saved goals</ButtonLink>
        </div>
      </section>

      <section className="card p-5 md:p-6" aria-labelledby="pref-title">
        <h2 id="pref-title" className="mb-4">Recommendation preferences</h2>
        <PreferenceSelector
          value={state.preferences}
          onChange={(p) => dispatch({ type: "set_preferences", preferences: p })}
        />
      </section>

      <section className="card p-5 md:p-6" aria-labelledby="rights-title">
        <h2 id="rights-title" className="mb-1 !text-[20px]">Your data rights</h2>
        <p className="mb-4 text-small text-ink-3">
          Under the Nigeria Data Protection Act you can get a copy of the data MoneyMap holds about you, or ask for it to be erased. Your bank records stay with Zenith Bank.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" icon={<Download size={18} aria-hidden />} disabled={exporting} onClick={exportData}>Download my data</Button>
          <Button variant="danger" icon={<Trash2 size={18} aria-hidden />} onClick={() => setConfirmErase(true)}>Delete my MoneyMap data</Button>
        </div>
      </section>

      <section className="card p-5 md:p-6" aria-labelledby="demo-title">
        <h2 id="demo-title" className="mb-1 !text-[20px]">Prototype controls</h2>
        <p className="mb-4 text-small text-ink-3">For demonstrations only.</p>
        <label className="mb-4 flex min-h-11 cursor-pointer items-center gap-3">
          <input type="checkbox" className="h-5 w-5 accent-green-700" checked={state.simulateError} onChange={(e) => dispatch({ type: "set_simulate_error", value: e.target.checked })} />
          <span>Simulate a connection error on the recommendation screen</span>
        </label>
        <Button variant="ghost" icon={<RotateCcw size={18} aria-hidden />} onClick={() => { dispatch({ type: "reset" }); navigate("/"); }}>Reset all demo data</Button>
      </section>

      <Modal open={confirmWithdraw} onClose={() => setConfirmWithdraw(false)} title="Withdraw all consent?">
        <p className="mb-6 text-ink-2">MoneyMap will stop using all your banking information for personalisation. You'll still be able to explore products yourself, and you can allow access again any time.</p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setConfirmWithdraw(false)}>Cancel</Button>
          <Button variant="danger" onClick={() => { dispatch({ type: "withdraw_all" }); setConfirmWithdraw(false); toast("All consent withdrawn.", "info"); }}>Withdraw all</Button>
        </div>
      </Modal>
      <Modal open={confirmErase} onClose={() => setConfirmErase(false)} title="Delete your MoneyMap data?">
        <p className="mb-6 text-ink-2">
          This removes your permissions, goals, preferences, recommendations, feedback, messages and product requests from MoneyMap. It can't be undone. Your Zenith accounts and statements aren't affected.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setConfirmErase(false)}>Cancel</Button>
          <Button
            variant="danger"
            onClick={() => {
              dispatch({ type: "erase_my_data" });
              setConfirmErase(false);
              toast("Your MoneyMap data has been deleted.", "info");
              navigate("/");
            }}
          >
            Delete everything
          </Button>
        </div>
      </Modal>
    </div>
  );
}
