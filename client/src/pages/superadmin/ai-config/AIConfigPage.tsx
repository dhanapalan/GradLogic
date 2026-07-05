import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  SparklesIcon,
  MicrophoneIcon,
  DocumentTextIcon,
  ClipboardDocumentListIcon,
  CodeBracketIcon,
  CpuChipIcon,
  CheckCircleIcon,
  XCircleIcon,
  BoltIcon,
} from "@heroicons/react/24/outline";
import api from "../../../lib/api";
import settingsService, { SystemSettings } from "../../../services/settingsService";
import analyticsService, { AIUsage } from "../../../services/analyticsService";

type HeroIcon = React.ForwardRefExoticComponent<
  React.SVGProps<SVGSVGElement> & { title?: string; titleId?: string }
>;

const SERVICE_ICONS: Record<string, HeroIcon> = {
  question_bank: SparklesIcon,
  voice_interview: MicrophoneIcon,
  resume_extraction: DocumentTextIcon,
  drive_generation: ClipboardDocumentListIcon,
  code_execution: CodeBracketIcon,
};

type Tab = "services" | "model" | "prompts" | "quotas" | "usage";

const TAB_META: Record<Tab, { title: string; subtitle: string }> = {
  services: {
    title: "API Keys & Services",
    subtitle: "Every AI service and its key status. Keys are managed in environment configuration, not the database.",
  },
  model: { title: "Model Settings", subtitle: "Which model powers question generation" },
  prompts: { title: "Prompt Templates", subtitle: "Templates used by the AI question generator" },
  quotas: { title: "Usage Quotas", subtitle: "Limits on AI generation usage" },
  usage: { title: "Usage Monitoring", subtitle: "AI question generation and assignment per college" },
};

const inputClass =
  "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent";

interface EngineStatus {
  online: boolean;
  engine: { components?: Record<string, string> } | null;
}

interface AIServiceStatus {
  key: string;
  name: string;
  purpose: string;
  provider: string;
  model: string | null;
  key_location: string;
  configured: boolean;
  last4: string | null;
  reachable: boolean | null;
  testable: boolean;
  components: Record<string, string> | null;
  used_by: string[];
  note: string | null;
}

interface TestResult {
  ok: boolean;
  message: string;
  latency_ms: number;
}

export default function AIConfigPage() {
  const [searchParams] = useSearchParams();
  const raw = searchParams.get("tab");
  const tab: Tab =
    raw === "prompts" || raw === "quotas" || raw === "usage" || raw === "services" ? raw : "model";

  const [settings, setSettings] = useState<SystemSettings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [engineStatus, setEngineStatus] = useState<EngineStatus | null>(null);
  const [usage, setUsage] = useState<AIUsage | null>(null);
  const [services, setServices] = useState<AIServiceStatus[] | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        setSettings(await settingsService.getSettings());
      } catch (error) {
        toast.error("Failed to load AI configuration");
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    load();
    api
      .get("/qb-ai/health")
      .then((res) => setEngineStatus(res.data?.data || { online: false, engine: null }))
      .catch(() => setEngineStatus({ online: false, engine: null }));
  }, []);

  useEffect(() => {
    if (tab !== "usage") return;
    analyticsService
      .getAIUsage()
      .then(setUsage)
      .catch(() => {
        toast.error("Failed to load AI usage");
        setUsage(null);
      });
  }, [tab]);

  useEffect(() => {
    if (tab !== "services") return;
    setServices(null);
    api
      .get("/superadmin/ai-services")
      .then((res) => setServices(res.data?.data || []))
      .catch(() => {
        toast.error("Failed to load AI services");
        setServices([]);
      });
  }, [tab]);

  const set = (key: string, value: unknown) =>
    setSettings((s) => ({ ...s, [key]: value }));

  const save = async (keys: string[]) => {
    setSaving(true);
    try {
      const payload: SystemSettings = {};
      for (const k of keys) payload[k] = settings[k];
      await settingsService.updateSettings(payload);
      toast.success("AI configuration saved");
    } catch (error) {
      toast.error("Failed to save configuration");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const meta = TAB_META[tab];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900">{meta.title}</h2>
        <p className="text-gray-600 mt-1">{meta.subtitle}</p>
      </div>

      {loading ? (
        <div className="p-12 text-center text-gray-600">Loading configuration...</div>
      ) : (
        <div className={`${tab === "usage" || tab === "services" ? "max-w-4xl" : "max-w-2xl"} space-y-6`}>
          {tab === "services" && (
            <ServicesTab services={services} />
          )}

          {tab === "model" && (
            <div
              className={`rounded-lg border p-4 ${
                engineStatus?.online
                  ? "bg-green-50 border-green-200"
                  : "bg-amber-50 border-amber-200"
              }`}
            >
              <p className={`text-sm font-semibold ${engineStatus?.online ? "text-green-800" : "text-amber-800"}`}>
                AI Engine: {engineStatus === null ? "checking..." : engineStatus.online ? "Online" : "Offline"}
              </p>
              {engineStatus?.engine?.components && (
                <p className="text-xs text-green-700 mt-1">
                  {Object.entries(engineStatus.engine.components)
                    .map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`)
                    .join(" · ")}
                </p>
              )}
              <p className={`text-xs mt-1 ${engineStatus?.online ? "text-green-700" : "text-amber-700"}`}>
                LLM API keys are read from the engine's own environment file
                (ai-engine/question_bank_engine/.env — e.g. GROQ_API_KEY) and are never stored in the
                platform database. {engineStatus?.online ? "The key is configured and working." : "Start the engine to check key status."}
              </p>
            </div>
          )}

          {tab === "model" && (
            <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
                  <select
                    value={String(settings["ai.provider"] ?? "groq")}
                    onChange={(e) => set("ai.provider", e.target.value)}
                    className={inputClass}
                  >
                    <option value="groq">Groq</option>
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
                  <input
                    type="text"
                    value={String(settings["ai.model"] ?? "")}
                    onChange={(e) => set("ai.model", e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Temperature ({Number(settings["ai.temperature"] ?? 0.4)})
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.1}
                    value={Number(settings["ai.temperature"] ?? 0.4)}
                    onChange={(e) => set("ai.temperature", Number(e.target.value))}
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Lower = more deterministic, higher = more varied questions
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Tokens</label>
                  <input
                    type="number"
                    min={256}
                    max={32768}
                    value={Number(settings["ai.max_tokens"] ?? 2048)}
                    onChange={(e) => set("ai.max_tokens", Number(e.target.value))}
                    className={inputClass}
                  />
                </div>
              </div>
              <SaveButton
                saving={saving}
                onClick={() => save(["ai.provider", "ai.model", "ai.temperature", "ai.max_tokens"])}
              />
            </div>
          )}

          {tab === "prompts" && (
            <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  MCQ Generation Prompt
                </label>
                <textarea
                  rows={4}
                  value={String(settings["ai.prompt_mcq"] ?? "")}
                  onChange={(e) => set("ai.prompt_mcq", e.target.value)}
                  className={inputClass}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Placeholders: {"{count}"}, {"{topic}"}, {"{difficulty}"}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Explanation Prompt
                </label>
                <textarea
                  rows={3}
                  value={String(settings["ai.prompt_explanation"] ?? "")}
                  onChange={(e) => set("ai.prompt_explanation", e.target.value)}
                  className={inputClass}
                />
                <p className="text-xs text-gray-500 mt-1">Placeholders: {"{answer}"}</p>
              </div>
              <SaveButton
                saving={saving}
                onClick={() => save(["ai.prompt_mcq", "ai.prompt_explanation"])}
              />
            </div>
          )}

          {tab === "quotas" && (
            <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Daily Generations (platform)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={Number(settings["ai.quota_daily_generations"] ?? 200)}
                    onChange={(e) => set("ai.quota_daily_generations", Number(e.target.value))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Daily Generations (per college)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={Number(settings["ai.quota_per_college_daily"] ?? 50)}
                    onChange={(e) => set("ai.quota_per_college_daily", Number(e.target.value))}
                    className={inputClass}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Monthly Token Budget
                </label>
                <input
                  type="number"
                  min={0}
                  step={100000}
                  value={Number(settings["ai.quota_monthly_tokens"] ?? 2000000)}
                  onChange={(e) => set("ai.quota_monthly_tokens", Number(e.target.value))}
                  className={inputClass}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Generation stops for the month once this budget is spent
                </p>
              </div>
              <SaveButton
                saving={saving}
                onClick={() =>
                  save([
                    "ai.quota_daily_generations",
                    "ai.quota_per_college_daily",
                    "ai.quota_monthly_tokens",
                  ])
                }
              />
            </div>
          )}

          {tab === "usage" && (
            <>
              {usage === null ? (
                <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-600">
                  Loading usage data...
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-white rounded-lg border border-gray-200 p-4">
                      <p className="text-xs text-gray-500 uppercase">AI Questions (total)</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">
                        {usage.totals.ai_questions_total}
                      </p>
                    </div>
                    <div className="bg-white rounded-lg border border-gray-200 p-4">
                      <p className="text-xs text-gray-500 uppercase">Generated (last 30 days)</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">
                        {usage.totals.ai_questions_30d}
                      </p>
                    </div>
                    <div className="bg-white rounded-lg border border-gray-200 p-4">
                      <p className="text-xs text-gray-500 uppercase">Import Batches (30 days)</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">
                        {usage.totals.import_batches_30d}
                      </p>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200">
                      <h3 className="font-semibold text-gray-900">Per-College Usage</h3>
                      <p className="text-sm text-gray-500">
                        Questions explicitly assigned to each college via the AI generator
                      </p>
                    </div>
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">College</th>
                          <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Students</th>
                          <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">AI Questions Assigned</th>
                          <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Total Questions Assigned</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {usage.per_college.map((c) => (
                          <tr key={c.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 text-sm font-medium text-gray-900">{c.name}</td>
                            <td className="px-6 py-4 text-sm text-right text-gray-600">{c.student_count}</td>
                            <td className="px-6 py-4 text-sm text-right text-gray-600">{c.ai_questions_assigned}</td>
                            <td className="px-6 py-4 text-sm text-right text-gray-600">{c.questions_assigned}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200">
                      <h3 className="font-semibold text-gray-900">Recent Import Batches</h3>
                    </div>
                    {usage.recent_imports.length === 0 ? (
                      <div className="p-8 text-center text-gray-600 text-sm">No AI imports yet</div>
                    ) : (
                      <div className="divide-y divide-gray-200">
                        {usage.recent_imports.map((imp, i) => (
                          <div key={i} className="px-6 py-3 flex items-center justify-between text-sm">
                            <span className="text-gray-900">
                              {imp.changes?.imported ?? "?"} question(s) imported
                              {imp.changes?.college_count
                                ? ` · assigned to ${imp.changes.college_count} college(s)`
                                : " · global"}
                              {imp.actor ? ` · by ${imp.actor}` : ""}
                            </span>
                            <span className="text-gray-500">
                              {new Date(imp.created_at).toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function SaveButton({ saving, onClick }: { saving: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={saving}
      className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
    >
      {saving ? "Saving..." : "Save Configuration"}
    </button>
  );
}

function ServicesTab({ services }: { services: AIServiceStatus[] | null }) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, TestResult>>({});
  const [testing, setTesting] = useState<string | null>(null);

  useEffect(() => {
    if (services && services.length > 0 && !selectedKey) {
      setSelectedKey(services[0].key);
    }
  }, [services, selectedKey]);

  if (services === null) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-600">
        Loading services...
      </div>
    );
  }

  const selected = services.find((s) => s.key === selectedKey) || services[0];
  const configuredCount = services.filter((s) => s.configured).length;

  const runTest = async (key: string) => {
    setTesting(key);
    try {
      const res = await api.post(`/superadmin/ai-services/${key}/test`);
      setResults((r) => ({ ...r, [key]: res.data?.data }));
    } catch {
      setResults((r) => ({ ...r, [key]: { ok: false, message: "Test request failed", latency_ms: 0 } }));
    } finally {
      setTesting(null);
    }
  };

  const SelIcon = SERVICE_ICONS[selected.key] || CpuChipIcon;
  const result = results[selected.key];

  return (
    <>
      {/* Summary strip */}
      <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200 px-5 py-4">
        <div>
          <p className="text-sm font-medium text-gray-900">
            {configuredCount} of {services.length} services configured
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            Keys live in environment configuration — never in the database. Rotate by updating the env value and redeploying.
          </p>
        </div>
        <div className="flex gap-1.5">
          {services.map((s) => (
            <span
              key={s.key}
              title={`${s.name}: ${s.configured ? "configured" : "not set"}`}
              className={`w-2.5 h-2.5 rounded-full ${s.configured ? "bg-green-500" : "bg-gray-300"}`}
            />
          ))}
        </div>
      </div>

      {/* Master-detail */}
      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4">
        {/* Left rail */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden self-start">
          {services.map((svc) => {
            const Icon = SERVICE_ICONS[svc.key] || CpuChipIcon;
            const active = svc.key === selected.key;
            return (
              <button
                key={svc.key}
                onClick={() => setSelectedKey(svc.key)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b border-gray-100 last:border-b-0 transition-colors ${
                  active ? "bg-blue-50" : "hover:bg-gray-50"
                }`}
              >
                <Icon className={`w-5 h-5 flex-shrink-0 ${active ? "text-blue-600" : "text-gray-400"}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${active ? "text-blue-700" : "text-gray-900"}`}>
                    {svc.name}
                  </p>
                  <p className="text-xs text-gray-500 capitalize">{svc.provider}</p>
                </div>
                <span className={`w-2 h-2 rounded-full ${svc.configured ? "bg-green-500" : "bg-gray-300"}`} />
              </button>
            );
          })}
        </div>

        {/* Detail panel */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-blue-50 p-2">
                <SelIcon className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{selected.name}</h3>
                <p className="text-sm text-gray-500">{selected.purpose}</p>
              </div>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                selected.configured ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${selected.configured ? "bg-green-500" : "bg-gray-400"}`} />
              {selected.configured ? "Configured" : "Not set"}
            </span>
          </div>

          {/* Test connection */}
          <div className="flex items-center gap-3 mb-5 pb-5 border-b border-gray-100">
            <button
              onClick={() => runTest(selected.key)}
              disabled={!selected.testable || testing === selected.key}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              <BoltIcon className="w-4 h-4" />
              {testing === selected.key ? "Testing..." : "Test connection"}
            </button>
            {!selected.testable && (
              <span className="text-xs text-gray-500">No key set to test.</span>
            )}
            {result && (
              <span
                className={`inline-flex items-center gap-1.5 text-sm font-medium ${
                  result.ok ? "text-green-700" : "text-red-600"
                }`}
              >
                {result.ok ? (
                  <CheckCircleIcon className="w-5 h-5" />
                ) : (
                  <XCircleIcon className="w-5 h-5" />
                )}
                {result.message}
                {result.latency_ms > 0 && (
                  <span className="text-gray-400 font-normal">· {result.latency_ms}ms</span>
                )}
              </span>
            )}
          </div>

          {/* Facts */}
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm mb-5">
            <div>
              <dt className="text-xs text-gray-500 uppercase">Provider</dt>
              <dd className="text-gray-900 font-medium capitalize mt-0.5">{selected.provider}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500 uppercase">Model</dt>
              <dd className="text-gray-900 font-mono text-xs mt-0.5">{selected.model || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500 uppercase">API Key</dt>
              <dd className="text-gray-900 font-mono text-xs mt-0.5">
                {selected.last4
                  ? `•••• ${selected.last4}`
                  : selected.configured
                    ? "held by engine"
                    : "not set"}
              </dd>
            </div>
            {selected.reachable !== null && (
              <div>
                <dt className="text-xs text-gray-500 uppercase">Reachable</dt>
                <dd className={`mt-0.5 font-medium ${selected.reachable ? "text-green-700" : "text-red-600"}`}>
                  {selected.reachable ? "Yes" : "No"}
                </dd>
              </div>
            )}
          </dl>

          {/* Engine components (question bank only) */}
          {selected.components && (
            <div className="mb-5">
              <p className="text-xs text-gray-500 uppercase mb-2">Engine Components</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(selected.components).map(([name, status]) => (
                  <span
                    key={name}
                    className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium ${
                      status === "healthy" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${status === "healthy" ? "bg-green-500" : "bg-amber-500"}`} />
                    {name.replace(/_/g, " ")}: {status}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Powers */}
          <div className="mb-5">
            <p className="text-xs text-gray-500 uppercase mb-2">Powers</p>
            <div className="flex flex-wrap gap-2">
              {selected.used_by.map((feature) => (
                <span key={feature} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                  {feature}
                </span>
              ))}
            </div>
          </div>

          {/* Key source */}
          <div className="rounded-lg bg-gray-50 border border-gray-200 p-3">
            <p className="text-xs text-gray-500 uppercase mb-1">Key Source</p>
            <p className="text-xs font-mono text-gray-700 break-all">{selected.key_location}</p>
            {selected.note && <p className="text-xs text-gray-500 mt-2">{selected.note}</p>}
          </div>
        </div>
      </div>
    </>
  );
}
