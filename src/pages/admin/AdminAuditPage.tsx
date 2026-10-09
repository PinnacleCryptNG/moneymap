import { ShieldAlert, ShieldCheck } from "../../components/icons";
import { useEffect, useState } from "react";
import { useStore } from "../../app/providers/store";
import { Badge } from "../../components/shared/Badge";
import { PageHeader } from "../../components/shared/PageHeader";
import { API_MODE, http } from "../../services/http";
import { formatDateTime } from "../../utils/format";

interface Entry { id: string; at: string; actor: string; action: string; detail: string; hash?: string }

export function AdminAuditPage() {
  const { state } = useStore();
  const [server, setServer] = useState<{ integrity: { intact: boolean; entries: number }; entries: Entry[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!API_MODE) return;
    http
      .adminAudit()
      .then((r) => setServer({ integrity: r.integrity, entries: r.entries.map((e) => ({ ...e, id: String(e.seq) })) }))
      .catch((e: Error) => setError(e.message));
  }, []);

  const entries: Entry[] = API_MODE ? (server?.entries ?? []) : state.audit;

  return (
    <div>
      <PageHeader
        eyebrow="Governance"
        title="Audit log"
        body="Consent changes, recommendations issued, customer feedback and catalogue changes. No sensitive financial values are logged."
      />
      {API_MODE && server && (
        <p className={`mb-4 flex items-center gap-2 rounded-[12px] border p-3 text-small ${server.integrity.intact ? "border-green/40 bg-green-50 text-green-700" : "border-red/30 bg-red-50 text-red"}`}>
          {server.integrity.intact ? <ShieldCheck size={18} aria-hidden /> : <ShieldAlert size={18} aria-hidden />}
          {server.integrity.intact
            ? `Hash chain intact — all ${server.integrity.entries} entries verified. Each entry commits to the one before it, so history can't be edited unnoticed.`
            : "Hash chain broken — the audit log has been altered."}
        </p>
      )}
      {error && <p role="alert" className="mb-4 text-small text-red">Couldn't load the server audit log: {error}</p>}
      <section tabIndex={0} aria-label="Audit log entries" className="card overflow-x-auto p-5 md:p-6 focus:outline-none focus-visible:ring-3 focus-visible:ring-blue/40">
        {entries.length === 0 ? (
          <p className="text-ink-3">No events yet.</p>
        ) : (
          <table className="w-full min-w-[560px] text-small">
            <thead><tr className="text-left text-ink-3"><th scope="col" className="pb-2 font-medium">Time</th><th scope="col" className="pb-2 font-medium">Actor</th><th scope="col" className="pb-2 font-medium">Event</th><th scope="col" className="pb-2 font-medium">Detail</th>{API_MODE && <th scope="col" className="pb-2 font-medium">Hash</th>}</tr></thead>
            <tbody className="divide-y divide-line">
              {entries.map((a) => (
                <tr key={a.id}>
                  <td className="whitespace-nowrap py-2.5 pr-3 text-ink-3">{formatDateTime(a.at)}</td>
                  <td className="py-2.5 pr-3"><Badge tone={a.actor === "admin" ? "navy" : a.actor === "customer" ? "blue" : "neutral"}>{a.actor}</Badge></td>
                  <td className="py-2.5 pr-3 font-mono text-[13px]">{a.action}</td>
                  <td className="py-2.5 pr-3">{a.detail}</td>
                  {API_MODE && <td className="py-2.5 font-mono text-[12px] text-ink-3">{a.hash?.slice(0, 10)}…</td>}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
