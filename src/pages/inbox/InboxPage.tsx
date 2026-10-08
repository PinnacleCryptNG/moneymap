import { BellRing, CheckCircle2, EyeOff } from "lucide-react";
import { useStore } from "../../app/providers/store";
import { Badge } from "../../components/shared/Badge";
import { ButtonLink } from "../../components/shared/Button";
import { EmptyState } from "../../components/shared/States";
import { formatDateTime, formatNaira } from "../../utils/format";

/** Step 3: messages MoneyMap sent, and everything it noticed — including when it chose to stay quiet. */
export function InboxPage() {
  const { state, dispatch } = useStore();
  const { notifications, triggerEvents } = state;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1>Messages</h1>
        <p className="max-w-2xl text-navy-500">
          MoneyMap takes a fresh look when money lands in your account. It only messages you when something would genuinely help — at most once a week.
        </p>
      </header>

      <section aria-labelledby="msgs-title" className="flex flex-col gap-3">
        <h2 id="msgs-title" className="sr-only">Messages</h2>
        {notifications.length === 0 ? (
          <EmptyState icon={BellRing} title="No messages yet" body="When MoneyMap has something worth your attention, it will show up here." />
        ) : (
          notifications.map((n) => (
            <article key={n.id} className={`rounded-[16px] border p-4 md:p-5 ${n.read_at ? "border-mist bg-white" : "border-blue bg-blue-50/50"}`}>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <BellRing size={18} className="text-blue-600" aria-hidden />
                <Badge tone={n.kind === "reminder" ? "neutral" : "blue"}>{n.kind === "reminder" ? "Reminder" : "New suggestion"}</Badge>
                {!n.read_at && <Badge tone="blue">Unread</Badge>}
                <span className="text-caption text-navy-500">{formatDateTime(n.created_at)}</span>
              </div>
              <h3 className="mb-1">{n.title}</h3>
              <p className="mb-4 max-w-2xl text-navy-700">{n.body}</p>
              <div className="flex flex-wrap gap-3">
                <ButtonLink size="sm" to="/app/recommendation" onClick={() => dispatch({ type: "read_notification", id: n.id })}>
                  See why
                </ButtonLink>
                {!n.read_at && (
                  <button type="button" className="min-h-11 px-2 text-small font-semibold text-blue-600 hover:underline" onClick={() => dispatch({ type: "read_notification", id: n.id })}>
                    Mark as read
                  </button>
                )}
              </div>
            </article>
          ))
        )}
      </section>

      <section aria-labelledby="noticed-title" className="card p-4 md:p-6">
        <h2 id="noticed-title" className="mb-1">What MoneyMap noticed</h2>
        <p className="mb-4 text-small text-navy-500">Every time money arrived, and what MoneyMap decided — including when it chose not to message you.</p>
        {triggerEvents.length === 0 ? (
          <p className="text-small text-navy-500">Nothing yet. MoneyMap looks again when your salary or another sizeable payment lands.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-mist">
            {triggerEvents.map((e) => (
              <li key={e.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="min-w-0">
                  <p className="font-medium">
                    {e.description} · {formatNaira(e.amount)}
                  </p>
                  <p className="text-small text-navy-500">{e.reason}</p>
                </div>
                <div className="shrink-0">
                  {e.outcome === "notified" ? (
                    <Badge tone="green" icon={<CheckCircle2 size={14} aria-hidden />}>Message sent</Badge>
                  ) : (
                    <Badge icon={<EyeOff size={14} aria-hidden />}>Checked — nothing sent</Badge>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
