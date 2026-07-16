// =============================================================================
// Assessment Hub · Coding Assessments
// Template → coding_assessment drives. Student editor reuses Knowledge Library
// coding_challenge items (Python & Java only).
// =============================================================================

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import {
  Code2,
  Plus,
  Search,
  Loader2,
  Terminal,
  Play,
  EyeOff,
  Sparkles,
  Lightbulb,
  MessageSquare,
  FileStack,
  ArrowRight,
  Layers,
  Target,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "../../../lib/api";
import assessmentTemplatesService from "../../../services/assessmentTemplatesService";
import questionBankService from "../../../services/questionBankService";
import {
  canInstantiateTemplate,
  domainLabel,
  parseHubConfig,
  boundSections,
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
  duration_minutes?: number | null;
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

const CODING_DOMAINS = PHASE1_DOMAINS.filter(
  (d) => d.value === "python_coding" || d.value === "java_coding"
);

const FEATURES = [
  {
    title: "Online editor",
    description: "Student Coding Arena — Python & Java starter stubs from the bank.",
    icon: Terminal,
  },
  {
    title: "Run code",
    description: "Judge0 execute against custom stdin before submit.",
    icon: Play,
  },
  {
    title: "Hidden test cases",
    description: "Server grades all cases from Knowledge Library coding_challenge items.",
    icon: EyeOff,
  },
  {
    title: "AI code review",
    description: "Post-submit review of student source against failing cases.",
    icon: Sparkles,
  },
  {
    title: "AI hints & explanation",
    description: "Nudges without full solutions; explain approach after attempts.",
    icon: Lightbulb,
  },
  {
    title: "Score calculation",
    description: "Percent of test cases passed → submission score.",
    icon: Target,
  },
] as const;

function driveDomain(d: Drive): string {
  return (
    d.hub_template_config?.placement_domain ||
    d.targeting_config?.phase1_domain ||
    d.targeting_config?.bank_category ||
    ""
  );
}

function isCodingDomain(dom: string): boolean {
  return (
    dom === "python_coding" ||
    dom === "java_coding" ||
    !!phase1DomainByValue(dom)?.value?.endsWith("_coding")
  );
}

export default function CodingAssessmentsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [domain, setDomain] = useState("");
  const [creatingId, setCreatingId] = useState<string | null>(null);

  const { data: drives = [], isLoading } = useQuery<Drive[]>({
    queryKey: ["drives", "coding_assessment"],
    queryFn: async () => {
      const res = await api.get("/drives?drive_type=coding_assessment");
      return res.data.data || [];
    },
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["assessment-templates", "coding-assessments"],
    queryFn: () => assessmentTemplatesService.list(),
  });

  const { data: codingBankCount = 0 } = useQuery({
    queryKey: ["coding-q-count"],
    queryFn: async () => {
      const res = await questionBankService.searchQuestions({
        type: "coding_challenge",
        limit: 1,
      });
      return res.total || 0;
    },
  });

  const { data: pyCount = 0 } = useQuery({
    queryKey: ["coding-q-count", "python_coding"],
    queryFn: async () => {
      const res = await questionBankService.searchQuestions({
        type: "coding_challenge",
        category: "python_coding",
        limit: 1,
      });
      return res.total || 0;
    },
  });

  const { data: javaCount = 0 } = useQuery({
    queryKey: ["coding-q-count", "java_coding"],
    queryFn: async () => {
      const res = await questionBankService.searchQuestions({
        type: "coding_challenge",
        category: "java_coding",
        limit: 1,
      });
      return res.total || 0;
    },
  });

  const readyTemplates = useMemo(
    () =>
      templates.filter((t) => {
        if (!canInstantiateTemplate(t)) return false;
        const hub = parseHubConfig(t.hub_template_config);
        const type = hub.assessment_type || "placement_test";
        if (!["coding_assessment", "practice", "placement_test", "weekly_test"].includes(type)) {
          return false;
        }
        const sections = boundSections(hub);
        if (sections.length === 0) return false;
        const dom =
          hub.placement_domain ||
          t.targeting_config?.phase1_domain ||
          t.targeting_config?.bank_category ||
          "";
        return isCodingDomain(dom);
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

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const domainMeta = CODING_DOMAINS.find((p) => p.value === domain);
    return drives.filter((d) => {
      const dom = resolveDomain(d);
      if (domain && domainMeta) {
        const matches =
          dom === domainMeta.value ||
          dom === domainMeta.bankCategory ||
          `${d.name} ${d.rule_name || ""} ${dom}`
            .toLowerCase()
            .includes(domainMeta.label.toLowerCase());
        if (!matches) return false;
      }
      if (!q) return true;
      return (
        d.name.toLowerCase().includes(q) ||
        (d.rule_name || "").toLowerCase().includes(q) ||
        domainLabel(dom).toLowerCase().includes(q)
      );
    });
  }, [drives, search, domain, templatesById]);

  const createFromTemplate = async (templateId: string) => {
    const template = templates.find((t) => t.id === templateId);
    if (!template) return;
    setCreatingId(templateId);
    try {
      const { id } = await assessmentTemplatesService.instantiateFromTemplate(template, {
        driveTypeOverride: "coding_assessment",
        nameSuffix: "Coding",
      });
      toast.success("Coding assessment created from template");
      await queryClient.invalidateQueries({ queryKey: ["drives", "coding_assessment"] });
      navigate(`/app/superadmin/drives/${id}?tab=pool`);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } }; message?: string })?.response?.data
          ?.error ||
        (err as Error)?.message ||
        "Failed to create coding assessment";
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
            Assessment Hub · Python &amp; Java only
          </p>
          <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 flex items-center gap-2">
                <Code2 className="w-6 h-6 text-navy-900" />
                Coding Assessments
              </h1>
              <p className="mt-1 text-sm text-gray-500 max-w-2xl">
                Template → Coding Assessment → Student editor → Run / hidden tests → AI review →
                Score. Challenges come from Knowledge Library{" "}
                <code className="text-[11px]">coding_challenge</code> items.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                to="/app/superadmin/knowledge-library/assets/coding"
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700"
              >
                <Layers className="w-4 h-4" />
                Coding challenges
              </Link>
              <Link
                to="/app/superadmin/assessment-templates"
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700"
              >
                <FileStack className="w-4 h-4" />
                Templates
              </Link>
              <Link
                to="/app/student-portal/practice?tab=coding"
                className="inline-flex items-center gap-2 rounded-lg bg-navy-900 px-4 py-2.5 text-sm font-medium text-white"
              >
                <Terminal className="w-4 h-4" />
                Open Coding Arena
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
              { label: "Bank challenges", value: codingBankCount },
              { label: "Python", value: pyCount },
              { label: "Java", value: javaCount },
              { label: "Assessments", value: drives.length },
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
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Features</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="rounded-xl border border-gray-200/70 bg-white p-4 shadow-admin-card"
                >
                  <div className="inline-flex rounded-lg bg-teal-50 p-2.5 text-teal-700">
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
                Published templates with Python/Java collections bound — no Builder duplication.
              </p>
            </div>
            <span className="text-xs text-gray-400">{readyTemplates.length} ready</span>
          </div>
          {readyTemplates.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 px-6 py-8 text-center">
              <p className="text-sm text-gray-500">
                No ready coding templates. Publish a template with a Python or Java collection.
              </p>
              <Link
                to="/app/superadmin/assessment-templates"
                className="inline-flex items-center gap-1.5 mt-3 text-sm text-admin-accent hover:underline"
              >
                Open Assessment Templates
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {readyTemplates.map((t) => {
                const hub = parseHubConfig(t.hub_template_config);
                const dom =
                  hub.placement_domain ||
                  t.targeting_config?.phase1_domain ||
                  t.targeting_config?.bank_category ||
                  "";
                const busy = creatingId === t.id;
                return (
                  <li
                    key={t.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{t.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {domainLabel(dom)} · {t.duration_minutes || 60} min ·{" "}
                        {boundSections(hub).length} section
                        {boundSections(hub).length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => createFromTemplate(t.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-navy-900 px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
                    >
                      {busy ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Plus className="w-3.5 h-3.5" />
                      )}
                      Create coding assessment
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
              <h2 className="text-sm font-semibold text-gray-900">Coding assessments</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Type <code className="text-[11px]">coding_assessment</code> · Phase-1 Python /
                Java.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search coding assessments…"
                className="w-full rounded-lg border border-gray-200 pl-9 pr-3 py-2 text-sm"
              />
            </div>
            <select
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
            >
              <option value="">All languages</option>
              {CODING_DOMAINS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12 text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 px-6 py-10 text-center">
              <p className="text-sm text-gray-500">No coding assessments yet.</p>
              <p className="text-xs text-gray-400 mt-1">
                Create one from a ready template above.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {filtered.map((d) => {
                const dom = resolveDomain(d);
                return (
                  <li key={d.id}>
                    <Link
                      to={`/app/superadmin/drives/${d.id}`}
                      className="flex flex-wrap items-center justify-between gap-2 py-3.5 hover:bg-gray-50/80 -mx-2 px-2 rounded-lg"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{d.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {d.rule_name || "Template"} · {d.status}
                          {d.duration_minutes != null ? ` · ${d.duration_minutes} min` : ""}
                          {dom ? ` · ${domainLabel(dom)}` : ""}
                          {d.total_students != null ? ` · ${d.total_students} students` : ""}
                        </p>
                      </div>
                      <span className="text-[10px] uppercase tracking-wider text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded">
                        Coding
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <p className="text-xs text-gray-400 flex items-start gap-1.5">
          <MessageSquare className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          Pipeline: Knowledge Library coding challenges → Collections → Templates → Coding
          Assessments → Coding Arena (run / hidden tests / AI) → Score.
        </p>
      </div>
    </div>
  );
}
