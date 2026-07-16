// =============================================================================
// Knowledge Library hub — "Netflix for Learning"
// Lessons · Questions · Flashcards as first-class collections.
// =============================================================================

import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { BookOpen, FileStack, Library, ListChecks, Loader2, Search, Sparkles } from "lucide-react";
import toast from "react-hot-toast";
import KnowledgeObjectCard from "../../../components/superadmin/learning-companion/KnowledgeObjectCard";
import questionBankService, { Question } from "../../../services/questionBankService";
import superadminFeaturesService, {
  type Flashcard,
  type PublishedLesson,
} from "../../../services/superadminFeaturesService";

type Tab = "lessons" | "questions" | "flashcards";

const PAGE_SIZE = 24;
const CATEGORIES = [
  "aptitude", "reasoning", "maths", "data_structures",
  "programming", "python_coding", "java_coding", "data_science",
];
const DIFFICULTIES = ["easy", "medium", "hard"];

export default function KnowledgeLibraryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const tab: Tab =
    tabParam === "lessons" || tabParam === "flashcards" || tabParam === "questions"
      ? tabParam
      : "questions";

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(searchParams.get("category") || "");
  const [type, setType] = useState(searchParams.get("type") || "");
  const [difficulty, setDifficulty] = useState("");
  const [page, setPage] = useState(1);

  const [questions, setQuestions] = useState<Question[]>([]);
  const [qTotal, setQTotal] = useState(0);
  const [lessons, setLessons] = useState<PublishedLesson[]>([]);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(true);

  const setTab = (next: Tab) => {
    const params = new URLSearchParams(searchParams);
    params.set("tab", next);
    if (next !== "questions") params.delete("type");
    setSearchParams(params);
    setPage(1);
  };

  // Keep URL aligned with default collection so sidebar leaf highlighting works.
  useEffect(() => {
    if (!tabParam) {
      const params = new URLSearchParams(searchParams);
      params.set("tab", "questions");
      setSearchParams(params, { replace: true });
    }
  }, [tabParam, searchParams, setSearchParams]);

  useEffect(() => {
    const t = searchParams.get("type") || "";
    setType(t);
  }, [searchParams]);

  useEffect(() => {
    setLoading(true);
    if (tab === "questions") {
      questionBankService
        .searchQuestions({
          search: query || undefined,
          category: category || undefined,
          type: type || undefined,
          difficulty: difficulty || undefined,
          page,
          limit: PAGE_SIZE,
        })
        .then((res) => {
          setQuestions(res.questions);
          setQTotal(res.total);
        })
        .catch(() => {
          toast.error("Failed to load questions");
          setQuestions([]);
          setQTotal(0);
        })
        .finally(() => setLoading(false));
      return;
    }

    if (tab === "lessons") {
      superadminFeaturesService
        .listLessons({ search: query || undefined })
        .then(setLessons)
        .catch(() => {
          toast.error("Failed to load lessons");
          setLessons([]);
        })
        .finally(() => setLoading(false));
      return;
    }

    superadminFeaturesService
      .listFlashcards({ search: query || undefined, category: category || undefined })
      .then(setFlashcards)
      .catch(() => {
        toast.error("Failed to load flashcards");
        setFlashcards([]);
      })
      .finally(() => setLoading(false));
  }, [tab, query, category, type, difficulty, page]);

  const tabs: { key: Tab; label: string; icon: typeof BookOpen; count?: number }[] = [
    { key: "lessons", label: "Lessons", icon: BookOpen, count: lessons.length },
    { key: "questions", label: "Questions", icon: ListChecks, count: qTotal },
    { key: "flashcards", label: "Flashcards", icon: FileStack, count: flashcards.length },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Knowledge Library</p>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 flex items-center gap-2 mt-1">
            <Library className="w-6 h-6 text-navy-900" />
            Netflix for Learning
          </h1>
          <p className="text-gray-500 mt-1 max-w-xl">
            Browse lessons, questions, and flashcards as collections — not a raw question bank.
          </p>
        </div>
        <Link
          to="/app/superadmin/learning-companion/studio"
          className="inline-flex items-center gap-2 rounded-lg bg-navy-900 px-4 py-2 text-sm font-medium text-white hover:bg-navy-800"
        >
          <Sparkles className="w-4 h-4" /> Generate content
        </Link>
      </div>

      {/* Collection switcher */}
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "border-navy-900 bg-navy-900 text-white"
                  : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
              {typeof t.count === "number" && tab === t.key ? (
                <span className={`text-xs ${active ? "text-white/70" : "text-gray-400"}`}>{t.count}</span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Search / filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[14rem]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && setPage(1)}
            placeholder={
              tab === "questions"
                ? "Search questions…"
                : tab === "lessons"
                  ? "Search lessons…"
                  : "Search flashcards…"
            }
            className="w-full rounded-lg border border-gray-200 pl-9 pr-3 py-2 text-sm"
          />
        </div>
        {tab !== "lessons" && (
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          >
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        )}
        {tab === "questions" && (
          <>
            <select
              value={type}
              onChange={(e) => {
                setType(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
            >
              <option value="">All types</option>
              <option value="multiple_choice">MCQ</option>
              <option value="coding_challenge">Coding</option>
            </select>
            <select
              value={difficulty}
              onChange={(e) => {
                setDifficulty(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
            >
              <option value="">All difficulties</option>
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
        </div>
      ) : tab === "questions" ? (
        questions.length === 0 ? (
          <p className="text-sm text-gray-500 py-12 text-center">No questions in this collection yet.</p>
        ) : (
          <>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {questions.map((q) => (
                <KnowledgeObjectCard key={q.id} question={q} />
              ))}
            </div>
            {qTotal > PAGE_SIZE && (
              <div className="flex justify-center gap-2 pt-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-500 self-center">
                  Page {page} · {qTotal} total
                </span>
                <button
                  type="button"
                  disabled={page * PAGE_SIZE >= qTotal}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )
      ) : tab === "lessons" ? (
        lessons.length === 0 ? (
          <p className="text-sm text-gray-500 py-12 text-center">No lessons published yet.</p>
        ) : (
          <div className="space-y-2">
            {lessons.map((l) => (
              <div key={l.id} className="rounded-xl border border-gray-200 bg-white p-4">
                <h3 className="font-medium text-gray-900">{l.title}</h3>
                <p className="text-xs text-gray-500 mt-1">
                  {l.course_title} · {l.module_title} · {l.content_type}
                </p>
                {l.content_text ? (
                  <p className="mt-2 text-sm text-gray-600 line-clamp-3 whitespace-pre-wrap">{l.content_text}</p>
                ) : null}
              </div>
            ))}
          </div>
        )
      ) : flashcards.length === 0 ? (
        <p className="text-sm text-gray-500 py-12 text-center">No flashcards published yet.</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {flashcards.map((f) => (
            <div key={f.id} className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs uppercase text-gray-400 mb-2">
                {f.category} · {f.difficulty}
              </p>
              <p className="font-medium text-gray-900">{f.front}</p>
              <p className="mt-2 text-sm text-gray-600 border-t border-gray-100 pt-2">{f.back}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
