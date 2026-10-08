import { BellRing, HelpCircle, ThumbsDown, ThumbsUp, XCircle } from "lucide-react";
import type { FeedbackType } from "../../types";
import { FEEDBACK_LABELS } from "../../utils/labels";

const ICONS = {
  useful: ThumbsUp,
  not_relevant: ThumbsDown,
  not_understood: HelpCircle,
  not_wanted: XCircle,
  remind_later: BellRing,
} as const;

export function FeedbackControl({ value, onSelect }: { value?: FeedbackType; onSelect: (f: FeedbackType) => void }) {
  return (
    <fieldset>
      <legend className="mb-3 text-small font-medium text-navy-500">How did this recommendation land?</legend>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(FEEDBACK_LABELS) as FeedbackType[]).map((k) => {
          const Icon = ICONS[k];
          const active = value === k;
          return (
            <button
              key={k}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(k)}
              className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-small font-medium transition-colors ${
                active ? "border-blue bg-blue-50 text-blue-600" : "border-mist bg-white text-navy-700 hover:bg-cloud"
              }`}
            >
              <Icon size={16} aria-hidden />
              {FEEDBACK_LABELS[k]}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
