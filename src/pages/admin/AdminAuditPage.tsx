import { useStore } from "../../app/providers/store";
import { Badge } from "../../components/shared/Badge";
import { PageHeader } from "../../components/shared/PageHeader";
import { formatDateTime } from "../../utils/format";

export function AdminAuditPage() {
  const { state } = useStore();
  return (
    <div>
      <PageHeader eyebrow="Governance" title="Audit log" body="Consent changes, recommendations issued, customer feedback and catalogue changes. No sensitive financial values are logged." />
      <section className="card overflow-x-auto p-5 md:p-6">
        {state.audit.length === 0 ? (
          <p className="text-navy-500">No events yet.</p>
        ) : (
          <table className="w-full min-w-[560px] text-small">
            <thead><tr className="text-left text-navy-500"><th scope="col" className="pb-2 font-medium">Time</th><th scope="col" className="pb-2 font-medium">Actor</th><th scope="col" className="pb-2 font-medium">Event</th><th scope="col" className="pb-2 font-medium">Detail</th></tr></thead>
            <tbody className="divide-y divide-mist">
              {state.audit.map((a) => (
                <tr key={a.id}>
                  <td className="whitespace-nowrap py-2.5 pr-3 text-navy-500">{formatDateTime(a.at)}</td>
                  <td className="py-2.5 pr-3"><Badge tone={a.actor === "admin" ? "navy" : a.actor === "customer" ? "blue" : "neutral"}>{a.actor}</Badge></td>
                  <td className="py-2.5 pr-3 font-mono text-[13px]">{a.action}</td>
                  <td className="py-2.5">{a.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
