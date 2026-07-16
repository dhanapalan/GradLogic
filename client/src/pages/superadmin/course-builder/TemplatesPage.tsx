// =============================================================================
// Phase-1 Course Templates — skeletons that assemble KL assets into drafts
// =============================================================================

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, LayoutTemplate } from "lucide-react";
import toast from "react-hot-toast";
import courseBuilderService, {
  COURSE_BUILDER_BASE as BASE,
  PHASE1_DOMAINS,
  type Phase1Template,
} from "../../../services/courseBuilderService";

export default function TemplatesPage() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<Phase1Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingId, setCreatingId] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState("beginner");

  useEffect(() => {
    courseBuilderService
      .listTemplates()
      .then(setTemplates)
      .catch(() => toast.error("Failed to load templates"))
      .finally(() => setLoading(false));
  }, []);

  const create = async (t: Phase1Template) => {
    setCreatingId(t.id);
    try {
      const result = await courseBuilderService.createFromTemplate(t.id, {
        difficulty,
        title: `${t.title.replace(/ — .*/, "")} — ${difficulty}`,
      });
      toast.success(
        `Draft ready · ${result.modulesCreated} modules · ${result.assetsAttached} KL assets`
      );
      navigate(`${BASE}/${result.courseId}`);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        "Failed to create from template";
      toast.error(msg);
    } finally {
      setCreatingId(null);
    }
  };

  const label = (category: string) =>
    PHASE1_DOMAINS.find((d) => d.value === category)?.label || category;

  if (loading) {
    return (
      <div className="flex justify-center py-20 text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <LayoutTemplate className="w-5 h-5 text-navy-900" />
            Course Templates
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Phase-1 placement skeletons. Creating a template enriches modules with Knowledge Library
            suggestions and saves a <strong>draft</strong> — not published.
          </p>
        </div>
        <label className="text-xs text-gray-600">
          Difficulty
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
            className="ml-2 rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm"
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {templates.map((t) => (
          <div
            key={t.id}
            className="rounded-xl border border-gray-200/70 bg-white p-5 shadow-admin-card flex flex-col"
          >
            <p className="text-[11px] uppercase tracking-wider text-gray-400">
              {label(t.category)}
            </p>
            <h3 className="mt-1 font-semibold text-gray-900">{t.title}</h3>
            <p className="mt-1 text-sm text-gray-500 flex-1">{t.description}</p>
            <p className="mt-3 text-xs text-gray-400">
              ~{t.estimated_hours}h · {t.module_titles.length} modules
            </p>
            <ol className="mt-2 flex flex-wrap gap-1.5">
              {t.module_titles.map((m) => (
                <li
                  key={m}
                  className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] text-gray-600"
                >
                  {m}
                </li>
              ))}
            </ol>
            <button
              type="button"
              disabled={creatingId === t.id}
              onClick={() => void create(t)}
              className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg bg-navy-900 px-3 py-2 text-sm font-medium text-white hover:bg-navy-800 disabled:opacity-40"
            >
              {creatingId === t.id ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : null}
              Create draft from template
            </button>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-400">
        Prefer a custom prompt? Use{" "}
        <Link to={`${BASE}/ai`} className="text-admin-accent hover:underline">
          AI Course Builder
        </Link>
        .
      </p>
    </div>
  );
}
