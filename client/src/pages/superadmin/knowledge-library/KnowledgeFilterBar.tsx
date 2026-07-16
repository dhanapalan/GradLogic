// =============================================================================
// Shared search + filter bar for Knowledge Library Sprint 1
// =============================================================================

import { Search } from "lucide-react";
import { CATEGORY_OPTIONS, DIFFICULTY_OPTIONS } from "../../../services/knowledgeLibraryService";

export interface KnowledgeFilters {
  search: string;
  category: string;
  difficulty: string;
  status: string;
  type: string;
  tag: string;
  bloom: string;
}

interface Props {
  value: KnowledgeFilters;
  onChange: (next: KnowledgeFilters) => void;
  showType?: boolean;
  showStatus?: boolean;
  showTag?: boolean;
  searchPlaceholder?: string;
}

export const EMPTY_FILTERS: KnowledgeFilters = {
  search: "",
  category: "",
  difficulty: "",
  status: "",
  type: "",
  tag: "",
  bloom: "",
};

export default function KnowledgeFilterBar({
  value,
  onChange,
  showType = true,
  showStatus = true,
  showTag = false,
  searchPlaceholder = "Search knowledge…",
}: Props) {
  const set = (patch: Partial<KnowledgeFilters>) => onChange({ ...value, ...patch });

  return (
    <div className="flex flex-wrap gap-2">
      <div className="relative flex-1 min-w-[14rem]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={value.search}
          onChange={(e) => set({ search: e.target.value })}
          placeholder={searchPlaceholder}
          className="w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 py-2 text-sm"
        />
      </div>
      <select
        value={value.category}
        onChange={(e) => set({ category: e.target.value })}
        className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
      >
        <option value="">All subjects</option>
        {CATEGORY_OPTIONS.map((c) => (
          <option key={c} value={c}>
            {c.replace(/_/g, " ")}
          </option>
        ))}
      </select>
      <select
        value={value.difficulty}
        onChange={(e) => set({ difficulty: e.target.value })}
        className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
      >
        <option value="">All difficulties</option>
        {DIFFICULTY_OPTIONS.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>
      {showType && (
        <select
          value={value.type}
          onChange={(e) => set({ type: e.target.value })}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
        >
          <option value="">All types</option>
          <option value="multiple_choice">MCQ</option>
          <option value="coding_challenge">Coding</option>
        </select>
      )}
      {showStatus && (
        <select
          value={value.status}
          onChange={(e) => set({ status: e.target.value })}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          <option value="published">Published</option>
          <option value="pending">Pending</option>
          <option value="draft">Draft</option>
          <option value="rejected">Rejected</option>
        </select>
      )}
      {showTag && value.tag ? (
        <button
          type="button"
          onClick={() => set({ tag: "" })}
          className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
        >
          Topic: {value.tag} ×
        </button>
      ) : null}
      {value.bloom ? (
        <button
          type="button"
          onClick={() => set({ bloom: "" })}
          className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-800"
        >
          Skill: {value.bloom} ×
        </button>
      ) : null}
    </div>
  );
}
