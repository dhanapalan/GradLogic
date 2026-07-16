// =============================================================================
// AI Course Builder — prompt → outline review → commit draft (Inc 4)
// Assembles Knowledge Library suggestions; does not author content.
// =============================================================================

import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, Sparkles, Check } from "lucide-react";
import toast from "react-hot-toast";
import courseBuilderService, {
  COURSE_BUILDER_BASE as BASE,
  PHASE1_DOMAINS,
  type AiCourseOutline,
  type AiModuleOutline,
} from "../../../services/courseBuilderService";

const EXAMPLES = [
  "Create a Beginner Python course for campus placements",
  "Build an Aptitude crash course covering percentages and DI",
  "Intermediate Java programming with OOP and collections",
  "AI Fundamentals and Machine Learning basics for freshers",
];

export default function AiCourseBuilderPage() {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState(EXAMPLES[0]);
  const [category, setCategory] = useState<string>("");
  const [difficulty, setDifficulty] = useState<string>("beginner");
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [outline, setOutline] = useState<AiCourseOutline | null>(null);

  const assetStats = useMemo(() => {
    if (!outline) return { total: 0, selected: 0 };
    let total = 0;
    let selected = 0;
    for (const m of outline.modules) {
      for (const a of m.suggested_assets || []) {
        total += 1;
        if (a.selected !== false) selected += 1;
      }
    }
    return { total, selected };
  }, [outline]);

  const generate = async () => {
    if (prompt.trim().length < 8) {
      toast.error("Describe the course in a short sentence");
      return;
    }
    setLoading(true);
    setOutline(null);
    try {
      const data = await courseBuilderService.generateAiOutline({
        prompt: prompt.trim(),
        category: category || undefined,
        difficulty: difficulty || undefined,
      });
      setOutline(data);
      toast.success(
        data.source === "template"
          ? "Template outline ready (AI key unavailable or fallback)"
          : "AI outline ready — review before creating"
      );
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        "Failed to generate outline";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const toggleAsset = (modIdx: number, assetIdx: number) => {
    setOutline((prev) => {
      if (!prev) return prev;
      const modules = prev.modules.map((m, i) => {
        if (i !== modIdx) return m;
        const suggested_assets = m.suggested_assets.map((a, j) =>
          j === assetIdx ? { ...a, selected: !a.selected } : a
        );
        return { ...m, suggested_assets };
      });
      return { ...prev, modules };
    });
  };

  const removeModule = (modIdx: number) => {
    setOutline((prev) => {
      if (!prev || prev.modules.length <= 1) return prev;
      return { ...prev, modules: prev.modules.filter((_, i) => i !== modIdx) };
    });
  };

  const updateModuleTitle = (modIdx: number, title: string) => {
    setOutline((prev) => {
      if (!prev) return prev;
      const modules = prev.modules.map((m, i) => (i === modIdx ? { ...m, title } : m));
      return { ...prev, modules };
    });
  };

  const commit = async () => {
    if (!outline) return;
    setCommitting(true);
    try {
      const result = await courseBuilderService.commitAiOutline(outline);
      toast.success(
        `Draft created · ${result.modulesCreated} modules · ${result.assetsAttached} assets attached`
      );
      navigate(`${BASE}/${result.courseId}`);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        "Failed to create draft";
      toast.error(msg);
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <Link to={BASE} className="text-xs text-admin-accent hover:underline">
          ← Course Builder
        </Link>
        <h2 className="mt-2 text-xl font-semibold text-gray-900 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-navy-900" />
          AI Course Builder
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Describe a Phase-1 placement course. AI proposes modules and suggests Knowledge Library
          assets — you review, then create a <strong>draft</strong> (never silent publish).
        </p>
      </div>

      <div className="rounded-xl border border-gray-200/70 bg-white p-5 shadow-admin-card space-y-4">
        <label className="block">
          <span className="text-xs font-medium text-gray-600">Prompt</span>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            placeholder="Create a Beginner Python Course…"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setPrompt(ex)}
              className="text-left text-xs rounded-lg border border-gray-200 px-2.5 py-1.5 text-gray-600 hover:border-navy-900/40"
            >
              {ex}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Category (optional hint)</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            >
              <option value="">Auto-detect from prompt</option>
              {PHASE1_DOMAINS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Difficulty</span>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </label>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={() => void generate()}
          className="inline-flex items-center gap-2 rounded-lg bg-navy-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-navy-800 disabled:opacity-40"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          Generate outline
        </button>
      </div>

      {outline ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200/70 bg-white p-5 shadow-admin-card space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-gray-400">
                  Source · {outline.source || "ai"}
                </p>
                <h3 className="text-lg font-semibold text-gray-900">{outline.title}</h3>
                <p className="text-sm text-gray-500 mt-1">{outline.description}</p>
              </div>
              <span className="text-xs rounded-full bg-slate-100 px-2.5 py-1 capitalize text-gray-600">
                {outline.category.replace(/_/g, " ")} · {outline.difficulty}
              </span>
            </div>
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-gray-600">
              <div>
                <dt className="text-gray-400">Hours</dt>
                <dd className="font-medium">{outline.estimated_hours ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-gray-400">Pass %</dt>
                <dd className="font-medium">{outline.passing_percent}%</dd>
              </div>
              <div>
                <dt className="text-gray-400">Attempts</dt>
                <dd className="font-medium">{outline.attempts}</dd>
              </div>
              <div>
                <dt className="text-gray-400">KL suggestions</dt>
                <dd className="font-medium">
                  {assetStats.selected}/{assetStats.total} selected
                </dd>
              </div>
            </dl>
            {(outline.learning_objectives || []).length > 0 ? (
              <ul className="text-sm text-gray-600 list-disc pl-5 space-y-0.5">
                {outline.learning_objectives!.map((o) => (
                  <li key={o}>{o}</li>
                ))}
              </ul>
            ) : null}
          </div>

          {outline.modules.map((mod: AiModuleOutline, mi) => (
            <div
              key={`${mod.title}-${mi}`}
              className="rounded-xl border border-gray-200/70 bg-white p-4 shadow-admin-card space-y-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] text-gray-400">Module {mi + 1}</span>
                <input
                  value={mod.title}
                  onChange={(e) => updateModuleTitle(mi, e.target.value)}
                  className="flex-1 min-w-[12rem] rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm font-medium"
                />
                <button
                  type="button"
                  onClick={() => removeModule(mi)}
                  className="text-xs text-rose-600 hover:underline"
                >
                  Remove
                </button>
              </div>
              {mod.description ? (
                <p className="text-xs text-gray-500">{mod.description}</p>
              ) : null}
              {(mod.suggested_assets || []).length === 0 ? (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                  No Knowledge Library matches for this module — attach manually after create.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {mod.suggested_assets.map((a, ai) => (
                    <li key={`${a.asset_id}-${a.role}-${ai}`}>
                      <label className="flex items-start gap-2 rounded-lg border border-gray-100 bg-slate-50/80 px-3 py-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={a.selected !== false}
                          onChange={() => toggleAsset(mi, ai)}
                          className="mt-1 rounded border-gray-300"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="text-[10px] uppercase text-gray-400 mr-2">
                            {a.role} · {a.asset_type.replace(/_/g, " ")}
                          </span>
                          <span className="text-sm text-gray-800 line-clamp-2 block">{a.title}</span>
                        </span>
                        {a.selected !== false ? (
                          <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        ) : null}
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-gray-500">
              Creates a <strong>draft</strong> only. Use Review & Publish after validating practice
              gates.
            </p>
            <button
              type="button"
              disabled={committing || outline.modules.length === 0}
              onClick={() => void commit()}
              className="inline-flex items-center gap-2 rounded-lg bg-navy-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-navy-800 disabled:opacity-40"
            >
              {committing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Create draft course
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
