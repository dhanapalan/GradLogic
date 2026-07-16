// =============================================================================
// Assessment Hub · Create / Edit Template
// =============================================================================

import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Plus, Trash2, Save } from "lucide-react";
import toast from "react-hot-toast";
import assessmentTemplatesService from "../../../../services/assessmentTemplatesService";
import questionCollectionsService, {
  type QuestionCollection,
} from "../../../../services/questionCollectionsService";
import {
  ASSESSMENT_TYPES,
  DIFFICULTY_LEVELS,
  TEMPLATE_DOMAINS,
  TEMPLATE_STATUSES,
  boundSections,
  emptyHubConfig,
  normalizeStatus,
  parseHubConfig,
  toPersistStatus,
  type HubTemplateConfig,
  type HubTemplateSection,
} from "./templateConstants";

const BASE = "/app/superadmin/assessment-templates";

type FormState = {
  name: string;
  description: string;
  duration_minutes: string;
  total_questions: string;
  total_marks: string;
  overall_cutoff: string;
  negative_marking_enabled: boolean;
  negative_marking_value: string;
  easy: string;
  medium: string;
  hard: string;
  status: string;
  hub: HubTemplateConfig;
};

function defaultForm(): FormState {
  return {
    name: "",
    description: "",
    duration_minutes: "60",
    total_questions: "30",
    total_marks: "100",
    overall_cutoff: "40",
    negative_marking_enabled: false,
    negative_marking_value: "0.25",
    easy: "30",
    medium: "50",
    hard: "20",
    status: "draft",
    hub: emptyHubConfig(),
  };
}

export default function TemplateFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(defaultForm);
  const [collections, setCollections] = useState<QuestionCollection[]>([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    questionCollectionsService
      .list()
      .then(setCollections)
      .catch(() => setCollections([]));
  }, []);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    assessmentTemplatesService
      .get(id)
      .then((t) => {
        const hub = { ...emptyHubConfig(), ...parseHubConfig(t.hub_template_config) };
        const dist =
          typeof t.difficulty_distribution === "object" && t.difficulty_distribution
            ? t.difficulty_distribution
            : {};
        setForm({
          name: t.name || "",
          description: t.description || "",
          duration_minutes: String(t.duration_minutes ?? 60),
          total_questions: String(t.total_questions ?? 30),
          total_marks: String(t.total_marks ?? 100),
          overall_cutoff: t.overall_cutoff != null ? String(t.overall_cutoff) : "40",
          negative_marking_enabled: !!t.negative_marking_enabled,
          negative_marking_value:
            t.negative_marking_value != null ? String(t.negative_marking_value) : "0.25",
          easy: String(dist.easy ?? dist.Easy ?? 30),
          medium: String(dist.medium ?? dist.Medium ?? 50),
          hard: String(dist.hard ?? dist.Hard ?? 20),
          status: normalizeStatus(t.status || "draft"),
          hub,
        });
      })
      .catch(() => {
        toast.error("Template not found");
        navigate(BASE);
      })
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const setHub = (patch: Partial<HubTemplateConfig>) => {
    setForm((f) => ({ ...f, hub: { ...f.hub, ...patch } }));
  };

  const updateSection = (index: number, patch: Partial<HubTemplateSection>) => {
    const sections = [...(form.hub.sections || [])];
    sections[index] = { ...sections[index], ...patch };
    setHub({ sections });
  };

  const addSection = () => {
    setHub({
      sections: [
        ...(form.hub.sections || []),
        { section_name: `Section ${(form.hub.sections || []).length + 1}`, collection_id: "", time_limit_minutes: null },
      ],
    });
  };

  const removeSection = (index: number) => {
    setHub({ sections: (form.hub.sections || []).filter((_, i) => i !== index) });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Template name is required");
      return;
    }
    const persistStatus = toPersistStatus(form.status);
    const sections = boundSections(form.hub);
    if (persistStatus === "published" && sections.length === 0) {
      toast.error("Bind at least one Question Collection before publishing");
      return;
    }
    const mix =
      (parseInt(form.easy, 10) || 0) +
      (parseInt(form.medium, 10) || 0) +
      (parseInt(form.hard, 10) || 0);
    if (mix > 0 && mix !== 100) {
      toast.error("Difficulty mix must total 100%");
      return;
    }
    setSaving(true);
    try {
      const domain = form.hub.placement_domain || "aptitude";
      const domainMeta = TEMPLATE_DOMAINS.find((d) => d.value === domain);
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        duration_minutes: parseInt(form.duration_minutes, 10) || 60,
        total_questions: parseInt(form.total_questions, 10) || 30,
        total_marks: parseInt(form.total_marks, 10) || 100,
        overall_cutoff: form.overall_cutoff ? parseFloat(form.overall_cutoff) : null,
        negative_marking_enabled: form.negative_marking_enabled,
        negative_marking_value: form.negative_marking_enabled
          ? parseFloat(form.negative_marking_value) || 0.25
          : null,
        difficulty_distribution: {
          easy: parseInt(form.easy, 10) || 0,
          medium: parseInt(form.medium, 10) || 0,
          hard: parseInt(form.hard, 10) || 0,
        },
        targeting_config: {
          track: "placement_preparation",
          phase1_domain: domain,
          bank_category: domainMeta?.bankCategory ?? domain,
        },
        hub_template_config: {
          ...form.hub,
          tags: (form.hub.tags || []).filter(Boolean),
          sections,
        },
        status: persistStatus,
        proctoring_mode: "standard",
      };

      if (isEdit && id) {
        await assessmentTemplatesService.update(id, payload);
        toast.success("Template updated");
        navigate(`${BASE}/${id}/preview`);
      } else {
        const created = await assessmentTemplatesService.create(payload);
        toast.success("Template created");
        navigate(`${BASE}/${created.id}/preview`);
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        "Save failed";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-full flex justify-center items-center py-24 text-gray-300">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  const tagsStr = (form.hub.tags || []).join(", ");

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
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">
            {isEdit ? "Edit Template" : "Create Template"}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Blueprints only — questions live in Question Collections. Publish to create assessments.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Template information */}
        <section className="rounded-xl border border-gray-200/70 bg-white p-5 shadow-admin-card space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Template information</h2>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">
              Template Name
            </label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-navy-900/10"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-navy-900/10"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                Assessment Type
              </label>
              <select
                value={form.hub.assessment_type || "placement_test"}
                onChange={(e) =>
                  setHub({ assessment_type: e.target.value as HubTemplateConfig["assessment_type"] })
                }
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm"
              >
                {ASSESSMENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                Placement Domain
              </label>
              <select
                value={form.hub.placement_domain || "aptitude"}
                onChange={(e) => setHub({ placement_domain: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm"
              >
                {TEMPLATE_DOMAINS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                Difficulty
              </label>
              <select
                value={form.hub.difficulty || "mixed"}
                onChange={(e) =>
                  setHub({ difficulty: e.target.value as HubTemplateConfig["difficulty"] })
                }
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm"
              >
                {DIFFICULTY_LEVELS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                Status
              </label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm"
              >
                {TEMPLATE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                Estimated Duration (min)
              </label>
              <input
                type="number"
                min={1}
                value={form.duration_minutes}
                onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                Passing Percentage
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={form.overall_cutoff}
                onChange={(e) => setForm({ ...form, overall_cutoff: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">
              Tags (comma-separated)
            </label>
            <input
              value={tagsStr}
              onChange={(e) =>
                setHub({
                  tags: e.target.value
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean),
                })
              }
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm"
              placeholder="placement, weekly"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">
              Instructions
            </label>
            <textarea
              value={form.hub.instructions || ""}
              onChange={(e) => setHub({ instructions: e.target.value })}
              rows={3}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm"
            />
          </div>
        </section>

        {/* Structure */}
        <section className="rounded-xl border border-gray-200/70 bg-white p-5 shadow-admin-card space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Sections & Collections</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Each section binds an existing Question Collection (no questions created here).
              </p>
            </div>
            <button
              type="button"
              onClick={addSection}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-slate-50"
            >
              <Plus className="w-3.5 h-3.5" /> Add section
            </button>
          </div>
          {(form.hub.sections || []).length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center border border-dashed border-gray-200 rounded-lg">
              No sections yet. Add at least one before creating assessments.
            </p>
          ) : (
            <ul className="space-y-3">
              {(form.hub.sections || []).map((sec, i) => (
                <li
                  key={i}
                  className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end rounded-lg border border-gray-100 bg-slate-50/80 p-3"
                >
                  <div className="sm:col-span-4">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                      Section name
                    </label>
                    <input
                      value={sec.section_name}
                      onChange={(e) => updateSection(i, { section_name: e.target.value })}
                      className="w-full rounded-lg border border-gray-200 px-2.5 py-2 text-sm bg-white"
                    />
                  </div>
                  <div className="sm:col-span-5">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                      Question Collection
                    </label>
                    <select
                      value={sec.collection_id}
                      onChange={(e) => {
                        const c = collections.find((x) => x.id === e.target.value);
                        updateSection(i, {
                          collection_id: e.target.value,
                          section_name: sec.section_name || c?.name || `Section ${i + 1}`,
                        });
                      }}
                      className="w-full rounded-lg border border-gray-200 px-2.5 py-2 text-sm bg-white"
                    >
                      <option value="">Select collection…</option>
                      {collections.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.question_count} Q)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                      Time (min)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={sec.time_limit_minutes ?? ""}
                      onChange={(e) =>
                        updateSection(i, {
                          time_limit_minutes: e.target.value
                            ? parseInt(e.target.value, 10)
                            : null,
                        })
                      }
                      className="w-full rounded-lg border border-gray-200 px-2.5 py-2 text-sm bg-white"
                      placeholder="—"
                    />
                  </div>
                  <div className="sm:col-span-1 flex justify-end pb-0.5">
                    <button
                      type="button"
                      onClick={() => removeSection(i)}
                      className="p-2 text-gray-400 hover:text-red-600"
                      title="Remove section"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {collections.length === 0 && (
            <p className="text-xs text-amber-700">
              No collections found.{" "}
              <Link to="/app/superadmin/question-collections" className="underline">
                Create Question Collections
              </Link>{" "}
              first.
            </p>
          )}
        </section>

        {/* Mix & rules */}
        <section className="rounded-xl border border-gray-200/70 bg-white p-5 shadow-admin-card space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Difficulty mix & scoring</h2>
          <p className="text-xs text-gray-500">
            Randomization uses this mix when Assessment Builder seeds the question pool. Easy + Medium +
            Hard must equal 100%.
          </p>
          <div className="grid grid-cols-3 gap-3">
            {(
              [
                ["easy", "Easy %"],
                ["medium", "Medium %"],
                ["hard", "Hard %"],
              ] as const
            ).map(([key, label]) => (
              <div key={key}>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                  {label}
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm"
                />
              </div>
            ))}
          </div>
          {(() => {
            const mix =
              (parseInt(form.easy, 10) || 0) +
              (parseInt(form.medium, 10) || 0) +
              (parseInt(form.hard, 10) || 0);
            if (mix === 100) return null;
            return (
              <p className="text-xs text-amber-700">
                Current mix totals {mix}% (need 100%).
              </p>
            );
          })()}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                Total questions (target)
              </label>
              <input
                type="number"
                min={1}
                value={form.total_questions}
                onChange={(e) => setForm({ ...form, total_questions: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                Total marks
              </label>
              <input
                type="number"
                min={1}
                value={form.total_marks}
                onChange={(e) => setForm({ ...form, total_marks: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.negative_marking_enabled}
              onChange={(e) =>
                setForm({ ...form, negative_marking_enabled: e.target.checked })
              }
              className="rounded border-gray-300"
            />
            Negative marking
            {form.negative_marking_enabled && (
              <input
                type="number"
                step="0.01"
                min={0}
                value={form.negative_marking_value}
                onChange={(e) => setForm({ ...form, negative_marking_value: e.target.value })}
                className="ml-2 w-20 rounded-lg border border-gray-200 px-2 py-1 text-sm"
              />
            )}
          </label>
          <div className="flex flex-wrap gap-4 pt-1">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={!!form.hub.shuffle_questions}
                onChange={(e) => setHub({ shuffle_questions: e.target.checked })}
                className="rounded border-gray-300"
              />
              Shuffle questions
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={!!form.hub.shuffle_options}
                onChange={(e) => setHub({ shuffle_options: e.target.checked })}
                className="rounded border-gray-300"
              />
              Shuffle options (stored for runtime)
            </label>
          </div>
        </section>

        <div className="flex flex-wrap gap-3 justify-end pb-8">
          <Link
            to={BASE}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-600"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-navy-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isEdit ? "Save template" : "Create template"}
          </button>
        </div>
      </form>
    </div>
  );
}
