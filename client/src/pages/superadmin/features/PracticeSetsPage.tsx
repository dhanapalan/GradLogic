// =============================================================================
// Assessment Hub · Practice Sets
// Unlimited self-practice from Assessment Templates → practice_test drives.
// Does not duplicate Assessment Builder — create via Templates instantiate.
// =============================================================================

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import {
  FlaskConical,
  Plus,
  Search,
  Loader2,
  Infinity,
  Sparkles,
  Zap,
  Lightbulb,
  Bookmark,
  RotateCcw,
  BarChart3,
  ArrowRight,
  FileStack,
  BookOpen,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "../../../lib/api";
import assessmentTemplatesService from "../../../services/assessmentTemplatesService";
import {
  canInstantiateTemplate,
  domainLabel,
  normalizeStatus,
  parseHubConfig,
} from "./templates/templateConstants";
import {
  PHASE1_PLACEMENT_DOMAINS as PHASE1_DOMAINS,
  phase1DomainByValue,
} from "../../../lib/phase1PlacementDomains";

interface Drive {
  id: string;
  name: string;
  rule_id?: string;
  rule_name?: string;
  status: string;
  drive_type?: string;
  attempt_limit?: number;
  total_students?: number;
  targeting_config?: {
    phase1_domain?: string;
    bank_category?: string | null;
  } | null;
  hub_template_config?: {
    placement_domain?: string;
    assessment_type?: string;
  } | null;
}

const FEATURES = [
  {
    title: "Topic-wise practice",
    description: "Phase-1 domains only — Aptitude, Reasoning, Python, Java, AI Fundamentals.",
    icon: BookOpen,
  },
  {
    title: "Unlimited attempts",
    description: "Practice sets default to high attempt limits so students can retry freely.",
    icon: Infinity,
  },
  {
    title: "Instant evaluation",
    description: "Students get correct/incorrect feedback immediately in Practice Arena.",
    icon: Zap,
  },
  {
    title: "AI explanations & hints",
    description: "Bank explanations plus optional hints and AI Voice Tutor on each question.",
    icon: Lightbulb,
  },
  {
    title: "Retry & bookmarks",
    description: "Retry incorrect questions and bookmark items for later review.",
    icon: RotateCcw,
  },
  {
    title: "Progress tracking",
    description: "Session scores and topic performance feed student practice stats.",
    icon: BarChart3,
  },
] as const;

function driveDomain(d: Drive): string {
  const hub = d.hub_template_config;
  return (
    hub?.placement_domain ||
    d.targeting_config?.phase1_domain ||
    d.targeting_config?.bank_category ||
    ""
  );
}

export default function PracticeSetsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [domain, setDomain] = useState("");
  const [creatingId, setCreatingId] = useState<string | null>(null);

  const { data: drives = [], isLoading } = useQuery<Drive[]>({
    queryKey: ["drives", "practice_test"],
    queryFn: async () => {
      const res = await api.get("/drives?drive_type=practice_test");
      return res.data.data || [];
    },
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["assessment-templates", "practice-sets"],
    queryFn: () => assessmentTemplatesService.list(),
  });

  const readyTemplates = useMemo(
    () =>
      templates.filter((t) => {
        if (!canInstantiateTemplate(t)) return false;
        const hub = parseHubConfig(t.hub_template_config);
        const type = hub.assessment_type || "placement_test";
        // Prefer practice / weekly / placement / coding blueprints
        if (!["practice", "weekly_test", "placement_test", "coding_assessment"].includes(type)) {
          return false;
        }
        // Phase-1 domains only
        const dom =
          hub.placement_domain ||
          t.targeting_config?.phase1_domain ||
          t.targeting_config?.bank_category ||
          "";
        return !!phase1DomainByValue(dom) || dom === "campus_combined";
      }),
    [templates]
  );

  const templatesById = useMemo(() => {
    const m = new Map(templates.map((t) => [t.id, t]));
    return m;
  }, [templates]);

  const resolveDomain = (d: Drive): string => {
    const fromDrive = driveDomain(d);
    if (fromDrive) return fromDrive;
    if (!d.rule_id) return "";
    const t = templatesById.get(d.rule_id);
    if (!t) return "";
    const hub = parseHubConfig(t.hub_template_config);
    return (
      hub.placement_domain ||
      t.targeting_config?.phase1_domain ||
      t.targeting_config?.bank_category ||
      ""
    );
  };

  const arenaTopicForDomain = (dom: string): string => {
    const hit = phase1DomainByValue(dom);
    return hit?.bankCategory || hit?.value || "";
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const domainMeta = PHASE1_DOMAINS.find((p) => p.value === domain);
    return drives.filter((d) => {
      const dom = resolveDomain(d);
      if (domain && domainMeta) {
        const hay = `${d.name} ${d.rule_name || ""} ${dom}`.toLowerCase();
        const matchesDomain =
          dom === domainMeta.value ||
          dom === domainMeta.bankCategory ||
          hay.includes(domainMeta.label.toLowerCase()) ||
          hay.includes(domainMeta.value.replace("_", " "));
        if (!matchesDomain) return false;
      }
      if (!q) return true;
      return (
        d.name.toLowerCase().includes(q) ||
        (d.rule_name || "").toLowerCase().includes(q) ||
        domainLabel(dom).toLowerCase().includes(q)
      );
    });
  }, [drives, search, domain, templatesById]);

  const kpis = useMemo(() => {
    const unlimited = drives.filter((d) => (d.attempt_limit ?? 0) >= 99).length;
    const students = drives.reduce((sum, d) => sum + (d.total_students || 0), 0);
    return { total: drives.length, unlimited, students, templates: readyTemplates.length };
  }, [drives, readyTemplates.length]);

  const createFromTemplate = async (templateId: string) => {
    const template = templates.find((t) => t.id === templateId);
    if (!template) return;
    setCreatingId(templateId);
    try {
      const { id } = await assessmentTemplatesService.instantiateFromTemplate(template, {
        driveTypeOverride: "practice_test",
        nameSuffix: "Practice",
      });
      toast.success("Practice set created from template");
      await queryClient.invalidateQueries({ queryKey: ["drives", "practice_test"] });
      navigate(`/app/superadmin/drives/${id}?tab=pool`);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } }; message?: string })?.response?.data
          ?.error ||
        (err as Error)?.message ||
        "Failed to create practice set";
      toast.error(msg);
    } finally {
      setCreatingId(null);
    }
  };

  return (
    <div className="min-h-full bg-slate-50/80">
      <div className="border-b border-gray-200/80 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 pb-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Assessment Hub · Unlimited self-practice
          </p>
          <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 flex items-center gap-2">
                <FlaskConical className="w-6 h-6 text-navy-900" />
                Practice Sets
              </h1>
              <p className="mt-1 text-sm text-gray-500 max-w-2xl">
                Template → Practice Set → Student → Instant AI feedback. Create from published
                Assessment Templates (no Builder duplication). Phase 1 domains only.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                to="/app/superadmin/assessment-templates"
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700"
              >
                <FileStack className="w-4 h-4" />
                Templates
              </Link>
              <Link
                to="/app/student-portal/practice"
                className="inline-flex items-center gap-2 rounded-lg bg-navy-900 px-4 py-2.5 text-sm font-medium text-white"
              >
                <Plus className="w-4 h-4" />
                Open student practice
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-8">
        <section>
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Dashboard</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Practice sets", value: kpis.total },
              { label: "Unlimited", value: kpis.unlimited },
              { label: "Student enrollments", value: kpis.students },
              { label: "Ready templates", value: kpis.templates },
            ].map((k) => (
              <div
                key={k.label}
                className="rounded-xl border border-gray-200/70 bg-white px-4 py-3 shadow-admin-card"
              >
                <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
                  {k.label}
                </p>
                <p className="mt-1 text-2xl font-semibold text-gray-900 tabular-nums">{k.value}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-1">Phase 1 domains</h2>
          <p className="text-xs text-gray-500 mb-3">Filter practice sets by Placement Preparation domain.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            <button
              type="button"
              onClick={() => setDomain("")}
              className={`rounded-xl border px-3 py-3 text-center shadow-admin-card text-xs font-medium ${
                !domain ? "border-navy-900 bg-navy-900/[0.04]" : "border-gray-200/70 bg-white"
              }`}
            >
              All
            </button>
            {PHASE1_DOMAINS.map((d) => (
              <button
                key={d.value}
                type="button"
                onClick={() => setDomain(domain === d.value ? "" : d.value)}
                className={`rounded-xl border px-3 py-3 text-center shadow-admin-card transition-colors ${
                  domain === d.value
                    ? "border-navy-900 bg-navy-900/[0.04]"
                    : "border-gray-200/70 bg-white hover:border-navy-900/30"
                }`}
              >
                <p className="text-xs font-medium text-gray-800">{d.label}</p>
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Capabilities</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="rounded-xl border border-gray-200/70 bg-white p-4 shadow-admin-card"
                >
                  <div className="inline-flex rounded-lg bg-slate-50 p-2.5 text-navy-900">
                    <Icon className="w-4 h-4" />
                  </div>
                  <h3 className="mt-3 text-sm font-semibold text-gray-900">{f.title}</h3>
                  <p className="mt-1 text-xs text-gray-500">{f.description}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-xl border border-gray-200/70 bg-white p-5 shadow-admin-card">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Create from template</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Published templates with bound Question Collections → Practice Set (
                <code className="text-[11px]">practice_test</code>).
              </p>
            </div>
            <Link
              to="/app/superadmin/assessment-templates"
              className="inline-flex items-center gap-1 text-xs text-admin-accent hover:underline"
            >
              Manage templates
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {readyTemplates.length === 0 ? (
            <p className="text-sm text-gray-500 py-4 text-center border border-dashed border-gray-200 rounded-lg">
              No ready templates. Publish a template with collections first, or{" "}
              <Link to="/app/superadmin/assessment-templates" className="text-admin-accent underline">
                seed Phase-1 templates
              </Link>
              .
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {readyTemplates.slice(0, 8).map((t) => {
                const hub = parseHubConfig(t.hub_template_config);
                const busy = creatingId === t.id;
                return (
                  <li
                    key={t.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{t.name}</p>
                      <p className="text-xs text-gray-500">
                        {domainLabel(hub.placement_domain)} · {normalizeStatus(t.status)} ·{" "}
                        {t.duration_minutes ?? "—"} min
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void createFromTemplate(t.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-navy-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                    >
                      {busy ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5" />
                      )}
                      Create Practice Set
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-gray-200/70 bg-white p-5 shadow-admin-card">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">All practice sets</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Instant feedback for students runs in Practice Arena; sets track enrollments here.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Bookmark className="w-3.5 h-3.5" />
              Bookmarks · hints · retry live in student practice
            </div>
          </div>

          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search practice sets…"
              className="w-full rounded-lg border border-gray-200 pl-9 pr-3 py-2 text-sm"
            />
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12 text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 px-6 py-10 text-center">
              <p className="text-sm text-gray-500">No practice sets match.</p>
              <p className="text-xs text-gray-400 mt-1">Create one from a published Assessment Template above.</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {filtered.map((d) => {
                const dom = resolveDomain(d);
                const arenaTopic = arenaTopicForDomain(dom);
                return (
                  <li
                    key={d.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-3.5 -mx-2 px-2 rounded-lg"
                  >
                    <Link
                      to={`/app/superadmin/drives/${d.id}`}
                      className="min-w-0 flex-1 hover:bg-gray-50/80 rounded-lg px-1 py-1"
                    >
                      <p className="text-sm font-medium text-gray-900 truncate">{d.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {domainLabel(dom)} · {d.rule_name || "Template"} · {d.status}
                        {d.attempt_limit != null
                          ? ` · ${d.attempt_limit >= 99 ? "unlimited" : `${d.attempt_limit} attempts`}`
                          : ""}
                        {d.total_students != null ? ` · ${d.total_students} students` : ""}
                      </p>
                    </Link>
                    <div className="flex items-center gap-2 shrink-0">
                      {arenaTopic && (
                        <Link
                          to={`/app/student-portal/practice?topic=${encodeURIComponent(arenaTopic)}`}
                          className="text-xs font-medium text-admin-accent hover:underline"
                        >
                          Open Arena
                        </Link>
                      )}
                      <span className="text-[10px] uppercase tracking-wider text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                        Practice
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <p className="text-xs text-gray-400">
          Pipeline: Assessment Templates →{" "}
          <strong className="font-medium text-gray-500">Practice Sets</strong> → Student Practice
          Arena → Instant evaluation → Progress & AI Learning Journey.
        </p>
      </div>
    </div>
  );
}
