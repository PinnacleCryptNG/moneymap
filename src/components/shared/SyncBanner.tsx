import { CloudOff } from "../icons";
import { useStore } from "../../app/providers/store";

/** API mode: tells the user when the server couldn't be reached. */
export function SyncBanner() {
  const { state, dispatch } = useStore();
  if (!state.syncError) return null;
  return (
    <div role="alert" className="mb-5 flex items-start gap-3 rounded-[12px] border border-red/30 bg-red-50 p-3 text-small text-red">
      <CloudOff size={18} className="mt-0.5 shrink-0" aria-hidden />
      <p className="flex-1">{state.syncError}</p>
      <button type="button" className="min-h-6 font-semibold underline" onClick={() => dispatch({ type: "sync_error", message: null })}>
        Dismiss
      </button>
    </div>
  );
}
