// =============================================================================
// Journey Templates — Phase-1 list (authoring depth in Inc 2)
// =============================================================================

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Route, Sprout } from "lucide-react";
import toast from "react-hot-toast";
import learningJourneyService, {
  LEARNING_JOURNEY_BASE as BASE,
  PHASE1_JOURNEY_DOMAINS,
  type JourneyTemplate,
} from "../../../services/learningJourneyService";

function domainLabel(domain: string | null) {
  if (!domain) return "—";
  return PHASE1_JOURNEY_DOMAINS.find((d) => d.value === domain)?.label || domain;
}

export default function JourneyTemplatesListPage() {
  const [rows, setRows] = useState<JourneyTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [domain, setDomain] = useState("");
  const [search, setSearch] = useState("");
  const [seeding, setSeeding] = useState(false);

  const load = () => {
    setLoading(true);
    learningJourneyService
      .listTemplates({
        domain: domain || undefined,
        search: search.trim() || undefined,
      })
      .then((r) => setRows(r.templates))
      .catch(() => toast.error("Failed to load templates"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domain]);

  const seed = async () => {
    setSeeding(true);
    try {
      const res = await learningJourneyService.seedPhase1();
      toast.success(
        res.created_count > 0
          ? `Seeded ${res.created_count} templates`
          : "Phase-1 templates already present"
      );
      load();
    } catch {
      toast.error("Seed failed");
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Journey Templates</h2>
          <p className="text-sm text-gray-500">
            Reusable AI Learning Journey blueprints for Phase-1 domains. AI skill assessment and
            Companion personalization attach Catalog courses in later increments.
          </p>
        </div>
        <button
          type="button"
          disabled={seeding}
          onClick={() => void seed()}
          className="inline-flex items-center gap-2 rounded-lg bg-navy-900 px-3 py-2 text-sm text-white disabled:opacity-40"
        >
          <Sprout className="w-4 h-4" />
          {seeding ? "Seeding…" : "Seed Phase-1"}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          className="rounded-lg border border-gray-200 px-2.5 py-2 text-sm bg-white"
        >
          <option value="">All domains</option>
          {PHASE1_JOURNEY_DOMAINS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
          placeholder="Search templates…"
          className="rounded-lg border border-gray-200 px-2.5 py-2 text-sm flex-1 min-w-[12rem]"
        />
        <button
          type="button"
          onClick={load}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white"
        >
          Search
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white px-6 py-12 text-center">
          <Route className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No templates yet. Seed Phase-1 domains to start.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((t) => (
            <div
              key={t.id}
              className="rounded-xl border border-gray-200/70 bg-white p-4 shadow-admin-card flex flex-wrap items-start justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wider text-gray-400">
                  {domainLabel(t.domain)} · {t.difficulty || "—"} · {t.status}
                </p>
                <h3 className="font-medium text-gray-900 mt-0.5">{t.title}</h3>
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                  {t.description || "No description"}
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  {t.course_count} courses · {t.student_count} students
                  {t.duration_days != null ? ` · ${t.duration_days} days` : ""}
                  {t.estimated_hours != null ? ` · ~${t.estimated_hours}h` : ""}
                </p>
              </div>
              <Link
                to={`${BASE}/student-journeys`}
                className="text-xs text-admin-accent hover:underline shrink-0"
              >
                Student journeys →
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
