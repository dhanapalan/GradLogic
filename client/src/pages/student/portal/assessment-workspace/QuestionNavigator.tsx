import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "../../../../lib/utils";
import type { AttemptQuestion, QuestionNavStatus } from "../../../../services/studentAssessmentsService";

type Props = {
  questions: AttemptQuestion[];
  currentIndex: number;
  onJump: (index: number) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
};

function paletteClass(status: QuestionNavStatus, active: boolean) {
  return cn(
    "flex h-9 w-9 items-center justify-center rounded-md text-xs font-semibold border transition-colors",
    active && "ring-2 ring-offset-1 ring-slate-800",
    status === "not_visited" && "bg-white border-slate-200 text-slate-500",
    status === "visited" && "bg-slate-100 border-slate-300 text-slate-700",
    status === "answered" && "bg-emerald-100 border-emerald-300 text-emerald-800",
    status === "marked_for_review" && "bg-violet-100 border-violet-300 text-violet-800"
  );
}

export default function QuestionNavigator({
  questions,
  currentIndex,
  onJump,
  collapsed,
  onToggleCollapse,
}: Props) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  const sections = useMemo(() => {
    const map = new Map<string, Array<{ q: AttemptQuestion; index: number }>>();
    questions.forEach((q, index) => {
      const key = q.section || q.category || "General";
      const list = map.get(key) || [];
      list.push({ q, index });
      map.set(key, list);
    });
    return [...map.entries()];
  }, [questions]);

  const counts = useMemo(() => {
    let answered = 0;
    let review = 0;
    let visited = 0;
    let notVisited = 0;
    for (const q of questions) {
      if (q.status === "answered") answered += 1;
      else if (q.status === "marked_for_review") review += 1;
      else if (q.status === "visited") visited += 1;
      else notVisited += 1;
    }
    return { answered, review, visited, notVisited, total: questions.length };
  }, [questions]);

  if (collapsed) {
    return (
      <aside className="lg:w-12 lg:shrink-0">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
          aria-label="Expand question navigator"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </aside>
    );
  }

  return (
    <aside className="order-2 lg:order-1 lg:w-56 lg:shrink-0">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Question palette
          </h2>
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="rounded p-1 text-slate-400 hover:bg-slate-50"
              aria-label="Collapse question navigator"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          )}
        </div>

        <dl className="mt-3 grid grid-cols-2 gap-1 text-[11px] text-slate-600">
          <div>
            <dt className="text-slate-400">Answered</dt>
            <dd className="font-bold">{counts.answered}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Review</dt>
            <dd className="font-bold">{counts.review}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Visited</dt>
            <dd className="font-bold">{counts.visited}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Not visited</dt>
            <dd className="font-bold">{counts.notVisited}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-slate-400">Total</dt>
            <dd className="font-bold">{counts.total}</dd>
          </div>
        </dl>

        <div className="mt-3 -mx-1 overflow-x-auto pb-1 lg:hidden" aria-label="Question strip">
          <div className="flex w-max gap-2 px-1">
            {questions.map((q, index) => (
              <button
                key={`strip-${q.id}`}
                type="button"
                className={cn(paletteClass(q.status, index === currentIndex), "h-11 w-11 shrink-0")}
                onClick={() => onJump(index)}
                aria-label={`Question ${index + 1}`}
                aria-current={index === currentIndex ? "step" : undefined}
              >
                {index + 1}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 max-h-[50vh] space-y-3 overflow-y-auto">
          {sections.map(([section, items]) => {
            const open = openSections[section] !== false;
            const done = items.filter(
              (i) => i.q.status === "answered" || (i.q.status === "marked_for_review" && i.q.selected.length)
            ).length;
            return (
              <div key={section}>
                <button
                  type="button"
                  className="mb-1 flex w-full items-center justify-between text-left text-[11px] font-bold uppercase tracking-wide text-slate-500"
                  onClick={() =>
                    setOpenSections((prev) => ({ ...prev, [section]: !open }))
                  }
                  aria-expanded={open}
                >
                  <span>
                    {section}{" "}
                    <span className="font-normal normal-case text-slate-400">
                      ({done}/{items.length})
                    </span>
                  </span>
                  {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                </button>
                {open && (
                  <div
                    className="grid grid-cols-5 gap-2 sm:grid-cols-8 lg:grid-cols-4"
                    role="navigation"
                    aria-label={`${section} questions`}
                  >
                    {items.map(({ q, index }) => (
                      <button
                        key={q.id}
                        type="button"
                        className={paletteClass(q.status, index === currentIndex)}
                        onClick={() => onJump(index)}
                        title={`Q${index + 1}: ${q.status.replace(/_/g, " ")}`}
                        aria-label={`Question ${index + 1}, ${q.status.replace(/_/g, " ")}`}
                        aria-current={index === currentIndex ? "step" : undefined}
                      >
                        {index + 1}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <ul className="mt-4 space-y-1.5 text-[11px] text-slate-500">
          <li className="flex items-center gap-2">
            <span className={paletteClass("not_visited", false)} /> Not visited
          </li>
          <li className="flex items-center gap-2">
            <span className={paletteClass("visited", false)} /> Visited
          </li>
          <li className="flex items-center gap-2">
            <span className={paletteClass("answered", false)} /> Answered
          </li>
          <li className="flex items-center gap-2">
            <span className={paletteClass("marked_for_review", false)} /> Marked for review
          </li>
        </ul>
      </div>
    </aside>
  );
}
