import { BellRing, Building2, FileInput, KeyRound, Landmark, RefreshCw, Webhook } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "../../components/shared/Badge";
import { Button } from "../../components/shared/Button";
import { PageHeader } from "../../components/shared/PageHeader";
import { API_MODE, http, type IntegrationStatus } from "../../services/http";
import { formatDateTime } from "../../utils/format";

const ADAPTERS: Record<IntegrationStatus["adapters"][number]["name"], { title: string; icon: typeof KeyRound; what: string; production: string }> = {
  identity: {
    title: "Sign-in",
    icon: KeyRound,
    what: "Who the customer is.",
    production: "Zenith app's OpenID Connect token, verified against the bank's published keys. MoneyMap never sees a password.",
  },
  core_banking: {
    title: "Core banking",
    icon: Landmark,
    what: "The statement MoneyMap reads.",
    production: "Statement fetched from core banking at sign-in; new lines arrive by signed webhook. If the bank is unreachable, MoneyMap keeps using the last good copy.",
  },
  notifications: {
    title: "Messaging",
    icon: BellRing,
    what: "Delivering MoneyMap's messages.",
    production: "Handed to Zenith's messaging platform with an idempotency key, so a retry never sends twice. Failures are retried automatically.",
  },
  applications: {
    title: "Product requests",
    icon: FileInput,
    what: "Passing on “I'd like this”.",
    production: "Sent to Zenith's existing onboarding or credit process, which returns a reference. MoneyMap never opens accounts or approves credit.",
  },
};

/** Step 4: the adapters that connect MoneyMap to Zenith's systems, and their health. */
export function AdminIntegrationsPage() {
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!API_MODE) return;
    http.adminIntegrations().then(setStatus).catch((e: Error) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const rows: IntegrationStatus["adapters"] =
    status?.adapters ??
    (Object.keys(ADAPTERS) as IntegrationStatus["adapters"][number]["name"][]).map((name) => ({
      name, mode: "demo", target: null, calls: 0, failures: 0, lastOkAt: null, lastError: null,
    }));

  return (
    <div>
      <PageHeader
        eyebrow="Integration"
        title="Connections to Zenith"
        body="MoneyMap sits beside the bank's systems. Each one is behind a small adapter: in this demo they are simulated; in production each points at a Zenith endpoint, with no change to the decision engine."
      />
      {!API_MODE && (
        <p className="mb-4 rounded-[12px] border border-line bg-canvas p-3 text-small text-ink-2">
          This copy runs entirely in your browser, so every connection is simulated. The hosted server version shows live call counts and health.
        </p>
      )}
      {error && <p role="alert" className="mb-4 text-small text-red">Couldn't load integration status: {error}</p>}

      <ul className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        {rows.map((a) => {
          const meta = ADAPTERS[a.name];
          const Icon = meta.icon;
          const failing = Boolean(a.lastError && (!a.lastOkAt || a.lastError.at > a.lastOkAt));
          return (
            <li key={a.name} className="card p-5">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue" aria-hidden><Icon size={18} /></span>
                <h2 className="!text-[18px]">{meta.title}</h2>
                <Badge tone={a.mode === "http" ? "navy" : "neutral"}>{a.mode === "http" ? `Live · ${a.target}` : "Simulated"}</Badge>
                {API_MODE && (failing ? <Badge tone="red">Failing</Badge> : <Badge tone="green">Healthy</Badge>)}
              </div>
              <p className="mb-1 text-small font-medium">{meta.what}</p>
              <p className="mb-3 text-small text-ink-3">{meta.production}</p>
              {API_MODE && (
                <p className="text-caption text-ink-3">
                  {a.calls} calls · {a.failures} failed{a.lastOkAt ? ` · last OK ${formatDateTime(a.lastOkAt)}` : ""}
                  {failing && a.lastError ? ` · last error: ${a.lastError.message}` : ""}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <section className="card mb-6 p-5 md:p-6" aria-labelledby="feed-title">
        <h2 id="feed-title" className="mb-2 flex items-center gap-2 !text-[20px]"><Webhook size={20} aria-hidden /> Incoming transactions</h2>
        <p className="text-small text-ink-2">
          Core banking posts each new statement line to <code className="font-mono">POST /api/v1/events/transactions</code>, signed with a shared secret
          (HMAC-SHA256 over timestamp and body, rejected if more than 5 minutes old). The bank's own transaction id makes a repeated delivery harmless.
        </p>
        {status && (
          <p className="mt-2 text-small">
            Signed webhooks: <Badge tone={status.inbound_feed.signed_webhooks ? "green" : "neutral"}>{status.inbound_feed.signed_webhooks ? "Enabled" : "Not configured (admin token only)"}</Badge>
          </p>
        )}
      </section>

      {API_MODE && status && (
        <section tabIndex={0} className="card overflow-x-auto p-5 md:p-6 focus:outline-none focus-visible:ring-3 focus-visible:ring-blue/40" aria-labelledby="deliveries-title">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 id="deliveries-title" className="flex items-center gap-2 !text-[20px]"><Building2 size={20} aria-hidden /> Message deliveries</h2>
            <Button
              size="sm"
              variant="secondary"
              icon={<RefreshCw size={16} aria-hidden />}
              disabled={retrying}
              onClick={async () => {
                setRetrying(true);
                try {
                  const r = await http.adminRetry();
                  setNote(`Retried: ${r.delivered} message(s) delivered, ${r.handed_off} request(s) handed to Zenith.`);
                  load();
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setRetrying(false);
                }
              }}
            >
              Retry failed now
            </Button>
          </div>
          {note && <p className="mb-3 text-small text-green-700">{note}</p>}
          <p className="mb-3 text-small text-ink-3">{status.pending_handoffs} product request(s) waiting to reach Zenith.</p>
          {status.deliveries.length === 0 ? (
            <p className="text-small text-ink-3">No messages sent yet. Use Demo Mode → “Salary lands” to trigger one.</p>
          ) : (
            <table className="w-full min-w-[560px] text-small">
              <thead>
                <tr className="text-left text-ink-3">
                  <th scope="col" className="pb-2 font-medium">Time</th>
                  <th scope="col" className="pb-2 font-medium">Customer</th>
                  <th scope="col" className="pb-2 font-medium">Message</th>
                  <th scope="col" className="pb-2 font-medium">Status</th>
                  <th scope="col" className="pb-2 font-medium">Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {status.deliveries.map((d) => (
                  <tr key={d.notification_id}>
                    <td className="whitespace-nowrap py-2.5 pr-3 text-ink-3">{formatDateTime(d.updated_at)}</td>
                    <td className="py-2.5 pr-3">{d.customer_id}</td>
                    <td className="py-2.5 pr-3">{d.title}</td>
                    <td className="py-2.5 pr-3">
                      <Badge tone={d.status === "delivered" ? "green" : "red"}>{d.status === "delivered" ? `Delivered (${d.channel})` : `Failed × ${d.attempts}`}</Badge>
                    </td>
                    <td className="py-2.5 font-mono text-[12px]">{d.reference ?? d.last_error ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
    </div>
  );
}
