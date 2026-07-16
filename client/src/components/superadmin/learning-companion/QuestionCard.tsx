import { Code2, ListChecks, Pencil, Trash2, CheckSquare, Square } from "lucide-react";
import StatusBadge from "../StatusBadge";
import { Question } from "../../../services/questionBankService";

const DIFFICULTY_DOT: Record<string, string> = {
  easy: "bg-green-400",
  medium: "bg-amber-400",
  hard: "bg-rose-400",
};

interface QuestionCardProps {
  question: Question;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  onEdit?: (question: Question) => void;
  onDelete?: (id: string) => void;
}

export default function QuestionCard({
  question: q,
  selected = false,
  onToggleSelect,
  onEdit,
  onDelete,
}: QuestionCardProps) {
  const isCoding = q.type === "coding_challenge";

  return (
    <div
      className={`bg-white rounded-xl border shadow-admin-card p-5 flex flex-col gap-3 transition-colors ${
        selected ? "border-admin-accent ring-1 ring-admin-accent/30" : "border-gray-200/70"
      } ${q.is_active === false ? "opacity-60" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium capitalize ${
              isCoding ? "bg-purple-50 text-purple-700" : "bg-navy-900/[0.06] text-navy-900"
            }`}
          >
            {isCoding ? <Code2 className="w-3.5 h-3.5" /> : <ListChecks className="w-3.5 h-3.5" />}
            {q.category.replace(/_/g, " ")}
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 capitalize">
            <span className={`w-2 h-2 rounded-full ${DIFFICULTY_DOT[q.difficulty_level] || "bg-gray-300"}`} />
            {q.difficulty_level}
          </span>
          {q.bloom_level && (
            <span className="text-xs text-gray-400 capitalize">· {q.bloom_level}</span>
          )}
        </div>
        {onToggleSelect && (
          <button
            onClick={() => onToggleSelect(q.id)}
            className="text-gray-400 hover:text-admin-accent shrink-0"
            title={selected ? "Deselect" : "Select"}
          >
            {selected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
          </button>
        )}
      </div>

      <p className="text-sm text-gray-900 leading-relaxed line-clamp-3">{q.question_text}</p>

      {q.tags && q.tags.filter((t) => !["ai-generated", "manual"].includes(t)).length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {q.tags
            .filter((t) => !["ai-generated", "manual"].includes(t))
            .slice(0, 4)
            .map((t) => (
              <span key={t} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-[11px] font-medium">
                {t}
              </span>
            ))}
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-gray-100 mt-auto">
        <StatusBadge status={q.status} size="xs" />
        <div className="flex items-center gap-1">
          {onEdit && (
            <button
              onClick={() => onEdit(q)}
              className="p-1.5 text-gray-500 hover:text-admin-accent hover:bg-navy-900/[0.04] rounded-lg transition-colors"
              title="Edit"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(q.id)}
              className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Deactivate"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
