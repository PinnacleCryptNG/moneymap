import { Save } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../../app/providers/store";
import { draftFrom, MoneyQuestions, readDraft, saveMoneyAnswers } from "../../components/forms/MoneyQuestions";
import { Button } from "../../components/shared/Button";
import { PageHeader } from "../../components/shared/PageHeader";
import { useToast } from "../../components/shared/Toast";

/** The "Your money" questions, any time after onboarding. */
export function MyMoneyPage() {
  const { state, dispatch, activeGoal } = useStore();
  const toast = useToast();
  const navigate = useNavigate();
  const [draft, setDraft] = useState(() => draftFrom(state.selfReport));
  const [errors, setErrors] = useState<string[]>([]);
  const read = useMemo(() => readDraft(draft), [draft]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Your money"
        title="Tell us about your money"
        body="Answer what you can — ranges and “I'm not sure” are fine. MoneyMap uses these answers wherever you haven't shared your Zenith account, and always says when a figure came from you."
      />
      <MoneyQuestions draft={draft} onChange={setDraft} existingGoals={state.goals} />
      {errors.length > 0 && (
        <ul role="alert" className="flex list-disc flex-col gap-1 rounded-[12px] border border-[#f4cccc] bg-red-50 p-4 pl-8 text-small text-red">
          {errors.map((e) => <li key={e}>{e}</li>)}
        </ul>
      )}
      <div className="flex flex-wrap justify-end gap-3">
        <Button variant="secondary" onClick={() => navigate(-1)}>Cancel</Button>
        <Button
          icon={<Save size={18} aria-hidden />}
          onClick={() => {
            setErrors(read.errors);
            if (read.errors.length) return;
            saveMoneyAnswers(dispatch, read, Boolean(activeGoal));
            setDraft((d) => ({ ...d, newGoals: [] }));
            toast("Your answers are saved. Your MoneyMap has been updated.", "success");
            navigate("/app/map");
          }}
        >
          Save my answers
        </Button>
      </div>
    </div>
  );
}
