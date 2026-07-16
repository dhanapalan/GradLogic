import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  BookOpen,
  Search,
  Play,
  Layers,
  ArrowRight,
} from "lucide-react";
import api from "../../lib/api";

interface Topic {
  topic: string;
  total_questions: number;
  easy: number;
  medium: number;
  hard: number;
}

const DIFFS = [
  { key: "easy", label: "Easy", cls: "bg-emerald-50 text-emerald-600 border-emerald-100" },
  { key: "medium", label: "Medium", cls: "bg-amber-50 text-amber-600 border-amber-100" },
  { key: "hard", label: "Hard", cls: "bg-rose-50 text-rose-600 border-rose-100" },
] as const;

function practiceHref(topic: string, difficulty?: string) {
  const params = new URLSearchParams({ topic });
  if (difficulty) params.set("difficulty", difficulty);
  return `/app/student-portal/practice?${params.toString()}`;
}

export default function QuestionBankPage() {
  const [q, setQ] = useState("");

  const { data: topics = [], isLoading, isError } = useQuery({
    queryKey: ["student-qb-topics"],
    queryFn: async () => (await api.get("/practice/topics")).data.data as Topic[],
    staleTime: 60_000,
  });

  const filtered = useMemo(
    () => topics.filter((t) => t.topic.toLowerCase().includes(q.toLowerCase())),
    [topics, q]
  );

  const totalQuestions = topics.reduce((sum, t) => sum + t.total_questions, 0);

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500 pb-20 px-2">
      {/* Header */}
      <div className="flex items-center justify-between bg-white rounded-2xl px-6 py-4 border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Practice Hub</p>
            <h1 className="text-lg font-black text-slate-900 tracking-tight leading-tight">Question Library</h1>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              {topics.length} topics · {totalQuestions} questions — pick a topic to practise
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/app/student-portal/practice"
            className="hidden items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50 sm:inline-flex"
          >
            ← Practice Hub
          </Link>
          <Link
            to="/app/student-portal/practice"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-sm font-bold text-white transition-all active:scale-95 shadow-sm"
          >
            <Play className="h-4 w-4" />
            <span className="hidden sm:inline">Quick Practice</span>
          </Link>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search topics…"
          className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
        />
      </div>

      {isError && (
        <div className="rounded-2xl border border-rose-100 bg-rose-50 px-5 py-4 text-sm font-bold text-rose-600">
          Could not load the question bank. Please refresh or try again later.
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-2xl bg-slate-50 border border-slate-100" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center">
          <Layers className="h-10 w-10 text-slate-200 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-400">No topics found</p>
          <p className="text-xs text-slate-300 mt-1">Try a different search.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((t) => (
            <div
              key={t.topic}
              className="group bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-lg hover:border-indigo-100 transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-base font-black text-slate-900 capitalize truncate">
                    {t.topic.replace(/_/g, " ")}
                  </h3>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                    {t.total_questions} questions
                  </p>
                </div>
                <Link
                  to={practiceHref(t.topic)}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-black hover:bg-indigo-600 transition-all active:scale-95"
                >
                  <Play className="h-3 w-3" /> Practise
                </Link>
              </div>

              {/* Difficulty breakdown → each deep-links into a filtered practice run */}
              <div className="mt-4 flex flex-wrap gap-2">
                {DIFFS.map((d) => {
                  const count = t[d.key] as number;
                  if (!count) return null;
                  return (
                    <Link
                      key={d.key}
                      to={practiceHref(t.topic, d.key)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold transition-transform hover:-translate-y-0.5 ${d.cls}`}
                    >
                      {d.label}
                      <span className="opacity-70">{count}</span>
                    </Link>
                  );
                })}
              </div>

              <Link
                to={practiceHref(t.topic)}
                className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-indigo-500 group-hover:text-indigo-700 transition-colors"
              >
                Start a mixed set <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
