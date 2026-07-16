/**
 * Module 06 — UI-only question renderer. No scoring or validation logic.
 */
import { cn } from "../../../../lib/utils";
import type { AttemptQuestion } from "../../../../services/studentAssessmentsService";

type Props = {
  question: AttemptQuestion;
  index: number;
  disabled?: boolean;
  onSelectOption: (label: string) => void;
  onTextAnswer: (text: string) => void;
  onReorder?: (orderedLabels: string[]) => void;
};

const CHOICE_TYPES = new Set([
  "mcq",
  "single_choice",
  "mcq_single",
  "true_false",
  "boolean",
]);
const MULTI_TYPES = new Set(["mcq_multiple", "multi_select", "msq"]);
const TEXT_TYPES = new Set([
  "short_answer",
  "fill_blank",
  "fill_in_the_blank",
  "numerical",
  "numeric",
  "essay",
  "long_answer",
]);
const ORDER_TYPES = new Set(["ordering", "sequence", "matching"]);
const FUTURE_TYPES = new Set(["coding", "sql", "file_upload", "matrix", "grid", "case_study", "reading_comprehension"]);

export default function QuestionRenderer({
  question,
  index,
  disabled,
  onSelectOption,
  onTextAnswer,
}: Props) {
  const type = (question.question_type || "").toLowerCase();

  if (FUTURE_TYPES.has(type)) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        This question type ({type.replace(/_/g, " ")}) is not yet interactive in the Assessment
        Workspace. Skip it or contact your college administrator.
      </div>
    );
  }

  if (TEXT_TYPES.has(type) || (question.options.length === 0 && !CHOICE_TYPES.has(type) && !MULTI_TYPES.has(type))) {
    const multiline = type === "essay" || type === "long_answer";
    const numeric = type === "numerical" || type === "numeric";
    return (
      <div className="space-y-2">
        {multiline ? (
          <textarea
            className="min-h-[140px] w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="Type your answer…"
            aria-label={`Answer for question ${index + 1}`}
            disabled={disabled}
            value={question.selected[0] || ""}
            onChange={(e) => onTextAnswer(e.target.value)}
          />
        ) : (
          <input
            type={numeric ? "number" : "text"}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder={numeric ? "Enter a number…" : "Type your answer…"}
            aria-label={`Answer for question ${index + 1}`}
            disabled={disabled}
            value={question.selected[0] || ""}
            onChange={(e) => onTextAnswer(e.target.value)}
          />
        )}
      </div>
    );
  }

  if (ORDER_TYPES.has(type) && question.options.length > 0) {
    return (
      <div className="space-y-2" role="list" aria-label="Ordering options">
        <p className="text-xs text-slate-500">
          Select options in your preferred order. Selected order is saved as your response.
        </p>
        {question.options.map((opt) => {
          const rank = question.selected.indexOf(opt.label);
          const checked = rank >= 0;
          return (
            <button
              key={opt.label}
              type="button"
              disabled={disabled}
              onClick={() => onSelectOption(opt.label)}
              aria-pressed={checked}
              className={cn(
                "flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors",
                checked ? "border-slate-800 bg-slate-50" : "border-slate-200 hover:bg-slate-50/80"
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[10px] font-bold",
                  checked ? "border-slate-800 bg-slate-800 text-white" : "border-slate-300 text-slate-500"
                )}
              >
                {checked ? rank + 1 : opt.label}
              </span>
              <span className="text-slate-800">{opt.text}</span>
            </button>
          );
        })}
      </div>
    );
  }

  // Choice / multi / true-false with options
  if (question.options.length === 0) {
    return <p className="text-sm text-slate-500">No options available for this question.</p>;
  }

  const multi = MULTI_TYPES.has(type);
  return (
    <div className="space-y-2" role="group" aria-label="Answer options">
      {question.options.map((opt) => {
        const checked = question.selected.includes(opt.label);
        return (
          <button
            key={opt.label}
            type="button"
            disabled={disabled}
            onClick={() => onSelectOption(opt.label)}
            aria-pressed={checked}
            className={cn(
              "flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors",
              checked ? "border-slate-800 bg-slate-50" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/80",
              disabled && "opacity-60"
            )}
          >
            <span
              className={cn(
                "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border text-[10px] font-bold",
                multi ? "rounded" : "rounded-full",
                checked ? "border-slate-800 bg-slate-800 text-white" : "border-slate-300 text-slate-500"
              )}
            >
              {opt.label}
            </span>
            <span className="text-slate-800">{opt.text}</span>
          </button>
        );
      })}
    </div>
  );
}
