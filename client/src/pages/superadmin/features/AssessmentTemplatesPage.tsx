// =============================================================================
// Assessment Hub · Assessment Templates
// Reusable blueprints — not assessments. Instantiate via Builder API.
// =============================================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FileStack,
  Loader2,
  Plus,
  Sprout,
  Search,
  Copy,
  Archive,
  Eye,
  Pencil,
  ClipboardList,
  BookOpen,
  FlaskConical,
  MoreHorizontal,
} from "lucide-react";
import toast from "react-hot-toast";
import assessmentTemplatesService from "../../../services/assessmentTemplatesService";
import {
  ASSESSMENT_TYPES,
  DIFFICULTY_LEVELS,
  TEMPLATE_DOMAINS,
  type AssessmentTemplate,
  assessmentTypeLabel,
  boundSections,
  canInstantiateTemplate,
  domainLabel,
  normalizeStatus,
  parseHubConfig,
  statusLabel,
} from "./templates/templateConstants";

const BASE = "/app/superadmin/assessment-templates";

export default function AssessmentTemplatesPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<AssessmentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [instantiatingId, setInstantiatingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [domainFilter, setDomainFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState("");
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    assessmentTemplatesService
      .list()
      .then(setRows)
      .catch(() => {
        setRows([]);
        toast.error("Failed to load templates");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const seed = async () => {
    setSeeding(true);
    try {
      const res = await assessmentTemplatesService.seedPhase1();
      const parts: string[] = [];
      if (res.created_count > 0) {
        parts.push(`created ${res.created_count}`);
      }
      if ((res.repaired_count || 0) > 0) {
        parts.push(`repaired ${res.repaired_count}`);
      }
      toast.success(
        parts.length > 0
          ? `Phase-1 templates: ${parts.join(", ")}`
          : "Placement Preparation templates already up to date"
      );
      load();
    } catch {
      toast.error("Seed failed");
    } finally {
      setSeeding(false);
    }
  };

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      const hub = parseHubConfig(r.hub_template_config);
      const st = normalizeStatus(r.status);
      const domain =
        hub.placement_domain ||
        r.targeting_config?.phase1_domain ||
        r.targeting_config?.bank_category ||
        "";
      const type = hub.assessment_type || "";
      const difficulty = hub.difficulty || "";

      if (statusFilter !== "all" && st !== statusFilter) return false;
      if (domainFilter && domain !== domainFilter && r.targeting_config?.bank_category !== domainFilter) {
        const d = TEMPLATE_DOMAINS.find((x) => x.value === domainFilter);
        if (
          !(
            d &&
            (domain === d.value ||
              r.targeting_config?.bank_category === d.bankCategory ||
              domain === d.bankCategory)
          )
        ) {
          return false;
        }
      }
      if (typeFilter && type !== typeFilter) return false;
      if (difficultyFilter && difficulty !== difficultyFilter) return false;

      if (!q) return true;
      const hay = [
        r.name,
        r.description,
        domainLabel(domain),
        assessmentTypeLabel(type),
        ...(hub.tags || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search, statusFilter, domainFilter, typeFilter, difficultyFilter]);

  const kpis = useMemo(() => {
    const published = rows.filter((r) => normalizeStatus(r.status) === "published").length;
    const draft = rows.filter((r) => normalizeStatus(r.status) === "draft").length;
    const archived = rows.filter((r) => normalizeStatus(r.status) === "archived").length;
    return {
      total: rows.length,
      published,
      draft,
      archived,
    };
  }, [rows]);

  const instantiate = async (
    template: AssessmentTemplate,
    override?: "practice_test" | "mock_test" | "hiring" | "coding_assessment"
  ) => {
    setInstantiatingId(template.id);
    setMenuOpen(null);
    try {
      const { id } = await assessmentTemplatesService.instantiateFromTemplate(template, {
        driveTypeOverride: override,
      });
      toast.success("Assessment created from template — review pool");
      navigate(`/app/superadmin/drives/${id}?tab=pool`);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } }; message?: string })?.response?.data
          ?.error ||
        (err as Error)?.message ||
        "Failed to create assessment";
      toast.error(msg);
    } finally {
      setInstantiatingId(null);
    }
  };

  const clone = async (id: string) => {
    setMenuOpen(null);
    try {
      const copy = await assessmentTemplatesService.clone(id);
      toast.success("Template cloned as draft");
      navigate(`${BASE}/${copy.id}`);
    } catch {
      toast.error("Clone failed");
    }
  };

  const archive = async (id: string) => {
    setMenuOpen(null);
    try {
      await assessmentTemplatesService.archive(id);
      toast.success("Template archived");
      load();
    } catch {
      toast.error("Archive failed");
    }
  };

  return (
    <div className="min-h-full bg-slate-50/80" onClick={() => setMenuOpen(null)}>
      <div className="border-b border-gray-200/80 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 pb-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Assessment Hub · Blueprints
          </p>
          <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 flex items-center gap-2">
                <FileStack className="w-6 h-6 text-navy-900" />
                Assessment Templates
              </h1>
              <p className="mt-1 text-sm text-gray-500 max-w-2xl">
                Reusable blueprints for Practice, Mock, Weekly, Coding, and Placement tests. Templates
                are not assessments — use them to generate many assessments from Question Collections.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={seeding}
                onClick={() => void seed()}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm disabled:opacity-50"
              >
                <Sprout className="w-4 h-4" />
                {seeding ? "Seeding…" : "Seed Phase-1"}
              </button>
              <Link
                to={`${BASE}/new`}
                className="inline-flex items-center gap-2 rounded-lg bg-navy-900 px-4 py-2.5 text-sm font-medium text-white"
              >
                <Plus className="w-4 h-4" />
                Create Template
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Dashboard KPIs */}
        <section>
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Dashboard</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Total", value: kpis.total },
              { label: "Published", value: kpis.published },
              { label: "Draft", value: kpis.draft },
              { label: "Archived", value: kpis.archived },
            ].map((k) => (
              <button
                key={k.label}
                type="button"
                onClick={() =>
                  setStatusFilter(
                    k.label === "Total"
                      ? "all"
                      : k.label === "Published"
                        ? "published"
                        : k.label === "Draft"
                          ? "draft"
                          : "archived"
                  )
                }
                className="rounded-xl border border-gray-200/70 bg-white px-4 py-3 shadow-admin-card text-left hover:border-navy-900/20 transition-colors"
              >
                <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
                  {k.label}
                </p>
                <p className="mt-1 text-2xl font-semibold text-gray-900 tabular-nums">{k.value}</p>
              </button>
            ))}
          </div>
        </section>

        {/* Search + filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, domain, or type…"
              className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-gray-200 bg-white text-sm outline-none focus:ring-2 focus:ring-navy-900/10"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700"
              title="Status"
            >
              <option value="all">All statuses</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
            <select
              value={domainFilter}
              onChange={(e) => setDomainFilter(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700"
              title="Domain"
            >
              <option value="">All domains</option>
              {TEMPLATE_DOMAINS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700"
              title="Assessment type"
            >
              <option value="">All types</option>
              {ASSESSMENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <select
              value={difficultyFilter}
              onChange={(e) => setDifficultyFilter(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700"
              title="Difficulty"
            >
              <option value="">All difficulties</option>
              {DIFFICULTY_LEVELS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <section>
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="text-sm font-semibold text-gray-900">All Templates</h2>
            <p className="text-xs text-gray-400">
              {shown.length} shown
              {rows.length !== shown.length ? ` of ${rows.length}` : ""}
            </p>
          </div>

          {loading ? (
            <div className="flex justify-center py-16 text-gray-300">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-white px-6 py-12 text-center">
              <p className="text-sm text-gray-500">No templates yet.</p>
              <p className="mt-1 text-xs text-gray-400">
                Create a blueprint or seed Phase-1 Placement Preparation templates.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={() => void seed()}
                  className="text-sm text-admin-accent hover:underline"
                >
                  Seed Phase-1 templates
                </button>
                <Link to={`${BASE}/new`} className="text-sm font-medium text-navy-900 hover:underline">
                  Create Template
                </Link>
              </div>
            </div>
          ) : shown.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-white px-6 py-12 text-center">
              <p className="text-sm text-gray-500">No templates match your filters.</p>
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("all");
                  setDomainFilter("");
                  setTypeFilter("");
                  setDifficultyFilter("");
                }}
                className="mt-3 text-sm text-admin-accent hover:underline"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {shown.map((r) => {
                const hub = parseHubConfig(r.hub_template_config);
                const domain =
                  hub.placement_domain ||
                  r.targeting_config?.phase1_domain ||
                  "";
                const st = normalizeStatus(r.status);
                const sectionCount = boundSections(hub).length;
                const ready = canInstantiateTemplate(r);
                const busy = instantiatingId === r.id;

                return (
                  <li
                    key={r.id}
                    className="rounded-xl border border-gray-200/70 bg-white p-4 shadow-admin-card flex flex-col gap-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link
                          to={`${BASE}/${r.id}/preview`}
                          className="text-sm font-semibold text-gray-900 hover:text-navy-900 line-clamp-2"
                        >
                          {r.name}
                        </Link>
                        <p className="mt-1 text-xs text-gray-500 line-clamp-2">
                          {r.description || "No description"}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                          st === "published"
                            ? "bg-emerald-50 text-emerald-700"
                            : st === "archived"
                              ? "bg-slate-100 text-slate-500"
                              : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {statusLabel(r.status)}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 text-[11px]">
                      <span className="rounded-md bg-slate-50 border border-gray-100 px-2 py-0.5 text-gray-600">
                        {assessmentTypeLabel(hub.assessment_type)}
                      </span>
                      <span className="rounded-md bg-slate-50 border border-gray-100 px-2 py-0.5 text-gray-600">
                        {domainLabel(domain)}
                      </span>
                      {hub.difficulty && (
                        <span className="rounded-md bg-slate-50 border border-gray-100 px-2 py-0.5 text-gray-600 capitalize">
                          {hub.difficulty}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-gray-400">
                      {r.duration_minutes ?? "—"} min · {r.total_questions ?? "—"} Q ·{" "}
                      {sectionCount} section{sectionCount === 1 ? "" : "s"}
                      {r.overall_cutoff != null ? ` · Pass ${r.overall_cutoff}%` : ""}
                    </p>
                    {st === "published" && sectionCount === 0 && (
                      <p className="text-[11px] text-amber-700">
                        Bind a Question Collection before creating assessments.
                      </p>
                    )}
                    {st === "draft" && sectionCount === 0 && (
                      <p className="text-[11px] text-gray-400">
                        Draft — bind collections and publish to enable Create Assessment.
                      </p>
                    )}

                    <div className="mt-auto flex flex-wrap items-center gap-2 pt-1 border-t border-gray-100">
                      <Link
                        to={`${BASE}/${r.id}/preview`}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-slate-50"
                      >
                        <Eye className="w-3.5 h-3.5" /> Preview
                      </Link>
                      <Link
                        to={`${BASE}/${r.id}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-slate-50"
                      >
                        <Pencil className="w-3.5 h-3.5" /> Edit
                      </Link>
                      {ready && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={(e) => {
                            e.stopPropagation();
                            void instantiate(r);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg bg-navy-900 px-2.5 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                        >
                          {busy ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <ClipboardList className="w-3.5 h-3.5" />
                          )}
                          Create Assessment
                        </button>
                      )}
                      <div className="relative ml-auto">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpen(menuOpen === r.id ? null : r.id);
                          }}
                          className="p-1.5 rounded-lg text-gray-400 hover:bg-slate-50 hover:text-gray-700"
                          title="More actions"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                        {menuOpen === r.id && (
                          <div
                            className="absolute right-0 bottom-full mb-1 z-20 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {ready && (
                              <>
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-gray-700 hover:bg-slate-50"
                                  onClick={() => void instantiate(r, "practice_test")}
                                >
                                  <BookOpen className="w-3.5 h-3.5" /> Create Practice Set
                                </button>
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-gray-700 hover:bg-slate-50"
                                  onClick={() => void instantiate(r, "mock_test")}
                                >
                                  <FlaskConical className="w-3.5 h-3.5" /> Create Mock Test
                                </button>
                              </>
                            )}
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-gray-700 hover:bg-slate-50"
                              onClick={() => void clone(r.id)}
                            >
                              <Copy className="w-3.5 h-3.5" /> Clone
                            </button>
                            {st !== "archived" && (
                              <button
                                type="button"
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-red-600 hover:bg-red-50"
                                onClick={() => void archive(r.id)}
                              >
                                <Archive className="w-3.5 h-3.5" /> Archive
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
