// =============================================================================
// Catalog course detail — deep preview, AI insights, college/batch assignment
// =============================================================================

import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Loader2,
  CheckCircle2,
  Building2,
  Sparkles,
  BookOpen,
  Code2,
  ClipboardCheck,
  Mic2,
  Layers,
} from "lucide-react";
import toast from "react-hot-toast";
import courseCatalogService, {
  COURSE_CATALOG_BASE as BASE,
  type CatalogAiInsights,
  type CatalogCoursePreview,
} from "../../../services/courseCatalogService";
import lmsCourseService from "../../../services/lmsCourseService";
import collegeService from "../../../services/collegeService";
import superadminFeaturesService, {
  type BatchRow,
} from "../../../services/superadminFeaturesService";

const ROLE_META: Record<string, { label: string; icon: typeof BookOpen; tone: string }> = {
  lesson: { label: "Lessons", icon: BookOpen, tone: "text-sky-700 bg-sky-50" },
  resource: { label: "Resources", icon: Layers, tone: "text-slate-700 bg-slate-50" },
  practice: { label: "Practice", icon: ClipboardCheck, tone: "text-emerald-700 bg-emerald-50" },
  coding: { label: "Coding", icon: Code2, tone: "text-violet-700 bg-violet-50" },
  assessment: { label: "Assessments", icon: CheckCircle2, tone: "text-amber-700 bg-amber-50" },
  voice: { label: "Voice", icon: Mic2, tone: "text-rose-700 bg-rose-50" },
};

function RoleChip({ role, count }: { role: string; count: number }) {
  const meta = ROLE_META[role] || { label: role, icon: Layers, tone: "text-gray-600 bg-gray-50" };
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs ${meta.tone}`}>
      <Icon className="w-3.5 h-3.5" />
      {meta.label}: {count}
    </span>
  );
}

export default function CatalogCourseDetailPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const [preview, setPreview] = useState<CatalogCoursePreview | null>(null);
  const [colleges, setColleges] = useState<{ id: string; name: string }[]>([]);
  const [batches, setBatches] = useState<BatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [collegeId, setCollegeId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [insights, setInsights] = useState<CatalogAiInsights | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const reload = async () => {
    if (!courseId) return;
    const [p, collegeRes] = await Promise.all([
      courseCatalogService.getPreview(courseId),
      collegeService.getAllColleges().catch(() => ({ colleges: [], total: 0 })),
    ]);
    setPreview(p);
    setColleges((collegeRes.colleges || []).map((x) => ({ id: x.id, name: x.name })));
  };

  useEffect(() => {
    setLoading(true);
    reload()
      .catch(() => toast.error("Failed to load course preview"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  useEffect(() => {
    if (!collegeId) {
      setBatches([]);
      setBatchId("");
      return;
    }
    superadminFeaturesService
      .listBatches(collegeId)
      .then(setBatches)
      .catch(() => setBatches([]));
    setBatchId("");
  }, [collegeId]);

  const publish = async () => {
    if (!courseId || !preview) return;
    setBusy(true);
    try {
      await courseCatalogService.publishCourse(courseId);
      toast.success("Published to catalog");
      await reload();
    } catch {
      toast.error("Publish failed — check Builder Review gates");
    } finally {
      setBusy(false);
    }
  };

  const assign = async () => {
    if (!courseId || !collegeId) return;
    setBusy(true);
    try {
      await lmsCourseService.assignCollege(courseId, collegeId, {
        notes: notes.trim() || undefined,
        batch_id: batchId || null,
      });
      toast.success("Assigned to college");
      setCollegeId("");
      setBatchId("");
      setNotes("");
      await reload();
    } catch {
      toast.error("Assign failed");
    } finally {
      setBusy(false);
    }
  };

  const runAi = async () => {
    if (!courseId) return;
    setAiBusy(true);
    try {
      const data = await courseCatalogService.getAiInsights(courseId);
      setInsights(data);
      toast.success(data.source === "ai" ? "AI insights ready" : "Template insights ready");
    } catch {
      toast.error("Could not generate insights");
    } finally {
      setAiBusy(false);
    }
  };

  if (loading || !preview) {
    return (
      <div className="flex justify-center py-20 text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  const cfg = preview.assessment_config;

  return (
    <div className="space-y-6 max-w-5xl">
      <Link to={`${BASE}/all`} className="text-xs text-admin-accent hover:underline">
        ← All courses
      </Link>

      <div className="rounded-xl border border-gray-200/70 bg-white p-6 shadow-admin-card">
        <p className="text-[11px] uppercase tracking-wider text-gray-400 capitalize">
          {preview.category.replace(/_/g, " ")} · {preview.difficulty}
          {preview.subject ? ` · ${preview.subject}` : ""}
        </p>
        <h2 className="mt-1 text-2xl font-semibold text-gray-900">{preview.title}</h2>
        <p className="mt-2 text-sm text-gray-600">{preview.description || "No description"}</p>
        <p className="mt-3 text-xs text-gray-400 capitalize">
          Status: <strong>{preview.status}</strong> · {preview.totals.modules} modules ·{" "}
          {preview.totals.lessons} lessons · {preview.totals.assets} KL mappings ·{" "}
          {preview.enrollments} enrollments
          {preview.duration_hours != null ? ` · ~${preview.duration_hours}h` : ""}
          {preview.instructor_name ? ` · ${preview.instructor_name}` : ""}
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {Object.entries(preview.role_counts).map(([role, count]) => (
            <RoleChip key={role} role={role} count={count} />
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {preview.status === "draft" ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void publish()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-navy-900 px-3 py-2 text-sm text-white disabled:opacity-40"
            >
              <CheckCircle2 className="w-4 h-4" /> Publish
            </button>
          ) : null}
          <Link
            to={`/app/superadmin/course-builder/${preview.id}`}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          >
            Open in Course Builder
          </Link>
          <Link
            to="/app/superadmin/course-builder/review"
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          >
            Review gates
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="lg:col-span-3 space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">Deep preview</h3>
          {preview.modules.length === 0 ? (
            <p className="text-sm text-gray-400 rounded-xl border border-dashed border-gray-200 p-6">
              No modules yet — assemble content in Course Builder.
            </p>
          ) : (
            preview.modules.map((m, i) => {
              const open = expanded[m.id] ?? i === 0;
              return (
                <div
                  key={m.id}
                  className="rounded-xl border border-gray-200/70 bg-white shadow-admin-card overflow-hidden"
                >
                  <button
                    type="button"
                    className="w-full text-left px-4 py-3 flex items-start justify-between gap-3 hover:bg-gray-50/80"
                    onClick={() => setExpanded((s) => ({ ...s, [m.id]: !open }))}
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        <span className="text-gray-400 text-xs mr-2">{i + 1}.</span>
                        {m.title}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {m.lesson_count} lessons · {m.assets.length} mapped assets
                      </p>
                    </div>
                    <span className="text-xs text-gray-400">{open ? "Hide" : "Show"}</span>
                  </button>
                  {open ? (
                    <div className="border-t border-gray-100 px-4 py-3 space-y-3">
                      {m.description ? (
                        <p className="text-xs text-gray-500">{m.description}</p>
                      ) : null}
                      {(["practice", "coding", "assessment", "lesson", "resource", "voice"] as const).map(
                        (role) => {
                          const items = m.by_role[role] || [];
                          if (!items.length) return null;
                          return (
                            <div key={role}>
                              <p className="text-[11px] uppercase tracking-wider text-gray-400 mb-1 capitalize">
                                {role}
                              </p>
                              <ul className="space-y-1">
                                {items.map((a) => (
                                  <li
                                    key={a.id}
                                    className="text-sm text-gray-700 flex gap-2 items-baseline"
                                  >
                                    <span className="text-[10px] text-gray-400 shrink-0 uppercase">
                                      {a.asset_type}
                                    </span>
                                    <span className="truncate">
                                      {a.asset_title || a.asset_id.slice(0, 8)}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          );
                        }
                      )}
                      {m.assets.length === 0 ? (
                        <p className="text-xs text-gray-400">No Knowledge Library assets mapped.</p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })
          )}

          <div className="rounded-xl border border-gray-200/70 bg-white p-4 shadow-admin-card text-sm">
            <h4 className="font-semibold text-gray-900 text-sm">Assessment gates</h4>
            <dl className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-600">
              <div>
                Passing: <strong>{cfg.passing_percent}%</strong>
              </div>
              <div>
                Attempts: <strong>{cfg.attempts}</strong>
              </div>
              <div>
                Min practice / module: <strong>{cfg.min_practice_per_module}</strong>
              </div>
              <div>
                Require assessment: <strong>{cfg.require_assessment ? "Yes" : "No"}</strong>
              </div>
            </dl>
          </div>
        </section>

        <div className="lg:col-span-2 space-y-6">
          <section className="rounded-xl border border-gray-200/70 bg-white p-5 shadow-admin-card">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" /> AI summary & recs
              </h3>
              <button
                type="button"
                disabled={aiBusy}
                onClick={() => void runAi()}
                className="rounded-lg bg-navy-900 px-2.5 py-1.5 text-xs text-white disabled:opacity-40"
              >
                {aiBusy ? "Generating…" : insights ? "Refresh" : "Generate"}
              </button>
            </div>
            {!insights ? (
              <p className="mt-3 text-xs text-gray-500">
                Generate a catalog-facing summary, placement readiness score, and recommendations.
                Uses Anthropic when configured; otherwise a structured template.
              </p>
            ) : (
              <div className="mt-3 space-y-3 text-sm">
                <p className="text-[10px] uppercase tracking-wider text-gray-400">
                  Source: {insights.source}
                  {insights.placement_readiness_score != null
                    ? ` · Readiness ${insights.placement_readiness_score}/100`
                    : ""}
                  {insights.estimated_hours != null ? ` · ~${insights.estimated_hours}h` : ""}
                </p>
                <p className="text-gray-700">{insights.summary}</p>
                {insights.difficulty_analysis ? (
                  <p className="text-xs text-gray-500">{insights.difficulty_analysis}</p>
                ) : null}
                {insights.recommendations.length ? (
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-gray-400">Recommendations</p>
                    <ul className="mt-1 list-disc pl-4 space-y-1 text-xs text-gray-700">
                      {insights.recommendations.map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {insights.missing_topics.length ? (
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-gray-400">Gaps</p>
                    <ul className="mt-1 list-disc pl-4 space-y-1 text-xs text-amber-800">
                      {insights.missing_topics.map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {insights.skills.length ? (
                  <div className="flex flex-wrap gap-1">
                    {insights.skills.slice(0, 8).map((s) => (
                      <span
                        key={s}
                        className="rounded bg-gray-50 px-1.5 py-0.5 text-[11px] text-gray-600"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-gray-200/70 bg-white p-5 shadow-admin-card">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Building2 className="w-4 h-4" /> College assignment
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Optional batch + notes. Empty list = available to all colleges.
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              {preview.colleges.length === 0 ? (
                <li className="text-gray-400">No college restriction (platform-wide).</li>
              ) : (
                preview.colleges.map((a) => (
                  <li key={a.college_id} className="rounded-lg border border-gray-100 px-3 py-2">
                    <div className="flex justify-between gap-2">
                      <span className="font-medium text-gray-800">{a.college_name}</span>
                      <button
                        type="button"
                        className="text-xs text-rose-600 shrink-0"
                        onClick={() =>
                          void lmsCourseService
                            .unassignCollege(preview.id, a.college_id)
                            .then(reload)
                        }
                      >
                        Remove
                      </button>
                    </div>
                    {a.batch_name ? (
                      <p className="text-xs text-gray-500 mt-0.5">Batch: {a.batch_name}</p>
                    ) : null}
                    {a.notes ? <p className="text-xs text-gray-500 mt-0.5">{a.notes}</p> : null}
                  </li>
                ))
              )}
            </ul>
            <div className="mt-3 space-y-2">
              <select
                value={collegeId}
                onChange={(e) => setCollegeId(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-2.5 py-2 text-sm"
              >
                <option value="">Select college…</option>
                {colleges.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select
                value={batchId}
                onChange={(e) => setBatchId(e.target.value)}
                disabled={!collegeId || batches.length === 0}
                className="w-full rounded-lg border border-gray-200 px-2.5 py-2 text-sm disabled:opacity-50"
              >
                <option value="">
                  {!collegeId
                    ? "Select college first…"
                    : batches.length === 0
                      ? "No batches for college"
                      : "Optional batch…"}
                </option>
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                    {b.academic_year ? ` (${b.academic_year})` : ""}
                  </option>
                ))}
              </select>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Assignment notes (optional)"
                rows={2}
                className="w-full rounded-lg border border-gray-200 px-2.5 py-2 text-sm resize-none"
              />
              <button
                type="button"
                disabled={!collegeId || busy}
                onClick={() => void assign()}
                className="w-full rounded-lg bg-navy-900 px-3 py-2 text-sm text-white disabled:opacity-40"
              >
                Assign
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
