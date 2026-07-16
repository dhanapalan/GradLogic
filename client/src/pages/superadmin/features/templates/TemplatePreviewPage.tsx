// =============================================================================
// Assessment Hub · Template Preview
// =============================================================================

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Loader2,
  Pencil,
  ClipboardList,
  BookOpen,
  FlaskConical,
  Copy,
} from "lucide-react";
import toast from "react-hot-toast";
import assessmentTemplatesService from "../../../../services/assessmentTemplatesService";
import questionCollectionsService, {
  type QuestionCollection,
} from "../../../../services/questionCollectionsService";
import {
  type AssessmentTemplate,
  assessmentTypeLabel,
  boundSections,
  canInstantiateTemplate,
  domainLabel,
  normalizeStatus,
  parseHubConfig,
  statusLabel,
} from "./templateConstants";

const BASE = "/app/superadmin/assessment-templates";

export default function TemplatePreviewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [template, setTemplate] = useState<AssessmentTemplate | null>(null);
  const [collections, setCollections] = useState<QuestionCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      assessmentTemplatesService.get(id),
      questionCollectionsService.list().catch(() => [] as QuestionCollection[]),
    ])
      .then(([t, cols]) => {
        setTemplate(t);
        setCollections(cols);
      })
      .catch(() => {
        toast.error("Template not found");
        navigate(BASE);
      })
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const hub = useMemo(
    () => parseHubConfig(template?.hub_template_config),
    [template]
  );

  const sections = boundSections(hub);
  const collectionById = useMemo(() => {
    const m = new Map(collections.map((c) => [c.id, c]));
    return m;
  }, [collections]);

  const collectionQuestionCount = sections.reduce((sum, s) => {
    const c = collectionById.get(s.collection_id);
    return sum + (c?.question_count || 0);
  }, 0);

  const ready = template ? canInstantiateTemplate(template) : false;

  const difficulty =
    typeof template?.difficulty_distribution === "object" && template?.difficulty_distribution
      ? template.difficulty_distribution
      : {};

  const instantiate = async (
    override?: "practice_test" | "mock_test" | "hiring" | "coding_assessment"
  ) => {
    if (!template) return;
    setBusy(true);
    try {
      const { id: driveId } = await assessmentTemplatesService.instantiateFromTemplate(
        template,
        { driveTypeOverride: override }
      );
      toast.success("Assessment created — review pool");
      navigate(`/app/superadmin/drives/${driveId}?tab=pool`);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } }; message?: string })?.response?.data
          ?.error ||
        (err as Error)?.message ||
        "Failed to create assessment";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const clone = async () => {
    if (!id) return;
    try {
      const copy = await assessmentTemplatesService.clone(id);
      toast.success("Cloned as draft");
      navigate(`${BASE}/${copy.id}`);
    } catch {
      toast.error("Clone failed");
    }
  };

  if (loading || !template) {
    return (
      <div className="min-h-full flex justify-center items-center py-24 text-gray-300">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  const st = normalizeStatus(template.status);
  const easy = Number(difficulty.easy ?? difficulty.Easy ?? 0);
  const medium = Number(difficulty.medium ?? difficulty.Medium ?? 0);
  const hard = Number(difficulty.hard ?? difficulty.Hard ?? 0);

  return (
    <div className="min-h-full bg-slate-50/80">
      <div className="border-b border-gray-200/80 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-5 pb-5">
          <Link
            to={BASE}
            className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-3"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Templates
          </Link>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Template Preview
              </p>
              <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 mt-1">
                {template.name}
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                {statusLabel(template.status)} · {assessmentTypeLabel(hub.assessment_type)} ·{" "}
                {domainLabel(hub.placement_domain || template.targeting_config?.phase1_domain)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                to={`${BASE}/${template.id}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700"
              >
                <Pencil className="w-4 h-4" /> Edit
              </Link>
              <button
                type="button"
                onClick={() => void clone()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700"
              >
                <Copy className="w-4 h-4" /> Clone
              </button>
              {ready && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void instantiate()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-navy-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {busy ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ClipboardList className="w-4 h-4" />
                  )}
                  Create Assessment
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {ready ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-800">
            Ready to create assessments — this published template has bound Question Collections.
          </div>
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-900">
            {st !== "published"
              ? "Publish this template (and bind collections) before creating assessments."
              : "Bind at least one Question Collection before creating assessments."}{" "}
            <Link to={`${BASE}/${template.id}`} className="font-medium underline">
              Edit template
            </Link>
          </div>
        )}

        {/* Overview metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              label: "Questions",
              value:
                collectionQuestionCount > 0
                  ? `${template.total_questions ?? "—"} / ${collectionQuestionCount} avail`
                  : String(template.total_questions ?? "—"),
            },
            { label: "Duration", value: `${template.duration_minutes ?? "—"} min` },
            {
              label: "Passing score",
              value:
                template.overall_cutoff != null ? `${template.overall_cutoff}%` : "—",
            },
            {
              label: "Sections",
              value: String(sections.length),
            },
          ].map((m) => (
            <div
              key={m.label}
              className="rounded-xl border border-gray-200/70 bg-white px-4 py-3 shadow-admin-card"
            >
              <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
                {m.label}
              </p>
              <p className="mt-1 text-lg font-semibold text-gray-900">{m.value}</p>
            </div>
          ))}
        </div>

        <section className="rounded-xl border border-gray-200/70 bg-white p-5 shadow-admin-card space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Overview</h2>
          <p className="text-sm text-gray-600 whitespace-pre-wrap">
            {template.description || "No description."}
          </p>
          {hub.instructions && (
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
                Instructions
              </p>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{hub.instructions}</p>
            </div>
          )}
          <div className="flex flex-wrap gap-2 text-xs text-gray-500">
            {hub.difficulty && (
              <span className="rounded-md bg-slate-50 border border-gray-100 px-2 py-0.5 capitalize">
                Difficulty: {hub.difficulty}
              </span>
            )}
            {hub.shuffle_questions && (
              <span className="rounded-md bg-slate-50 border border-gray-100 px-2 py-0.5">
                Shuffle questions
              </span>
            )}
            {hub.shuffle_options && (
              <span className="rounded-md bg-slate-50 border border-gray-100 px-2 py-0.5">
                Shuffle options
              </span>
            )}
            {template.negative_marking_enabled && (
              <span className="rounded-md bg-slate-50 border border-gray-100 px-2 py-0.5">
                Negative marking {template.negative_marking_value ?? ""}
              </span>
            )}
            {(hub.tags || []).map((tag) => (
              <span
                key={tag}
                className="rounded-md bg-slate-50 border border-gray-100 px-2 py-0.5"
              >
                #{tag}
              </span>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-gray-200/70 bg-white p-5 shadow-admin-card space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Sections</h2>
          {sections.length === 0 ? (
            <p className="text-sm text-gray-400">
              No collections bound.{" "}
              <Link to={`${BASE}/${template.id}`} className="text-admin-accent hover:underline">
                Edit template
              </Link>{" "}
              to add sections before creating assessments.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {sections.map((s, i) => {
                const c = collectionById.get(s.collection_id);
                return (
                  <li key={i} className="py-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{s.section_name}</p>
                      <p className="text-xs text-gray-500">
                        {c?.name || s.collection_id}
                        {c ? ` · ${c.question_count} questions` : " · collection missing"}
                      </p>
                    </div>
                    {s.time_limit_minutes != null && (
                      <span className="text-xs text-gray-400">{s.time_limit_minutes} min</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-gray-200/70 bg-white p-5 shadow-admin-card space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Difficulty distribution</h2>
          <div className="space-y-2">
            {[
              { key: "Easy", pct: easy, color: "bg-emerald-500" },
              { key: "Medium", pct: medium, color: "bg-amber-500" },
              { key: "Hard", pct: hard, color: "bg-red-500" },
            ].map((row) => (
              <div key={row.key}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-600">{row.key}</span>
                  <span className="text-gray-400">{row.pct}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${row.color}`}
                    style={{ width: `${Math.min(100, Math.max(0, row.pct))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {ready && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void instantiate("practice_test")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 disabled:opacity-50"
            >
              <BookOpen className="w-4 h-4" /> Create Practice Set
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void instantiate("mock_test")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 disabled:opacity-50"
            >
              <FlaskConical className="w-4 h-4" /> Create Mock Test
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
