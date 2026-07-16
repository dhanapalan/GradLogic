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
    subtitle: "Create, edit, enable/disable, and manage encrypted API keys for platform AI services.",
  },
  model: { title: "Model Settings", subtitle: "Which model powers question generation" },
  prompts: { title: "Prompt Templates", subtitle: "Templates used by the AI question generator" },
  quotas: { title: "Usage Quotas", subtitle: "Limits on AI generation usage" },
  usage: { title: "Usage Monitoring", subtitle: "AI question generation and assignment per college" },
};

const inputClass =
  "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-admin-accent focus:border-transparent";

interface EngineStatus {
  online: boolean;
  engine: { components?: Record<string, string> } | null;
}

interface AIServiceStatus {
  id: string;
  key: string;
  name: string;
  purpose: string;
  provider: string;
  model: string | null;
  api_endpoint: string | null;
  organization_id: string | null;
  project_id: string | null;
  deployment_name: string | null;
  region: string | null;
  timeout_ms: number;
  retry_count: number;
  max_tokens: number | null;
  temperature: number | null;
  top_p: number | null;
  streaming_enabled: boolean;
  rate_limit_rpm: number | null;
  concurrency: number | null;
  is_enabled: boolean;
  is_system: boolean;
  key_location: string;
  configured: boolean;
  last4: string | null;
  reachable: boolean | null;
  testable: boolean;
  editable: boolean;
  deletable: boolean;
  source: "database" | "environment" | "unset";
  updated_at: string | null;
  components: Record<string, string> | null;
  used_by: string[];
  note: string | null;
}

type ServiceFormState = {
  service_key: string;
  name: string;
  purpose: string;
  provider: string;
  model: string;
  api_endpoint: string;
  organization_id: string;
  project_id: string;
  deployment_name: string;
  region: string;
  timeout_ms: number;
  retry_count: number;
  max_tokens: string;
  temperature: string;
  top_p: string;
  streaming_enabled: boolean;
  rate_limit_rpm: string;
  concurrency: string;
  is_enabled: boolean;
  used_by: string;
  note: string;
  api_key: string;
};

const EMPTY_FORM: ServiceFormState = {
  service_key: "",
  name: "",
  purpose: "",
  provider: "openai",
  model: "",
  api_endpoint: "",
  organization_id: "",
  project_id: "",
  deployment_name: "",
  region: "",
  timeout_ms: 30000,
  retry_count: 2,
  max_tokens: "",
  temperature: "",
  top_p: "",
  streaming_enabled: true,
  rate_limit_rpm: "",
  concurrency: "",
  is_enabled: true,
  used_by: "",
  note: "",
  api_key: "",
};

const PROVIDER_OPTIONS = [
  "openai",
  "anthropic",
  "google",
  "azure_openai",
  "aws_bedrock",
  "groq",
  "openrouter",
  "ollama",
  "vapi",
  "judge0",
  "custom",
];

function formFromService(s: AIServiceStatus): ServiceFormState {
  return {
    service_key: s.key,
    name: s.name,
    purpose: s.purpose || "",
    provider: s.provider,
    model: s.model || "",
    api_endpoint: s.api_endpoint || "",
    organization_id: s.organization_id || "",
    project_id: s.project_id || "",
    deployment_name: s.deployment_name || "",
    region: s.region || "",
    timeout_ms: s.timeout_ms ?? 30000,
    retry_count: s.retry_count ?? 2,
    max_tokens: s.max_tokens != null ? String(s.max_tokens) : "",
    temperature: s.temperature != null ? String(s.temperature) : "",
    top_p: s.top_p != null ? String(s.top_p) : "",
    streaming_enabled: s.streaming_enabled !== false,
    rate_limit_rpm: s.rate_limit_rpm != null ? String(s.rate_limit_rpm) : "",
    concurrency: s.concurrency != null ? String(s.concurrency) : "",
    is_enabled: s.is_enabled !== false,
    used_by: (s.used_by || []).join(", "),
    note: s.note || "",
    api_key: "",
  };
}

function payloadFromForm(form: ServiceFormState, includeKey: boolean) {
  const numOrNull = (v: string) => (v.trim() === "" ? null : Number(v));
  return {
    service_key: form.service_key.trim(),
    name: form.name.trim(),
    purpose: form.purpose.trim(),
    provider: form.provider,
    model: form.model.trim() || null,
    api_endpoint: form.api_endpoint.trim() || null,
    organization_id: form.organization_id.trim() || null,
    project_id: form.project_id.trim() || null,
    deployment_name: form.deployment_name.trim() || null,
    region: form.region.trim() || null,
    timeout_ms: form.timeout_ms,
    retry_count: form.retry_count,
    max_tokens: numOrNull(form.max_tokens),
    temperature: numOrNull(form.temperature),
    top_p: numOrNull(form.top_p),
    streaming_enabled: form.streaming_enabled,
    rate_limit_rpm: numOrNull(form.rate_limit_rpm),
    concurrency: numOrNull(form.concurrency),
    is_enabled: form.is_enabled,
    used_by: form.used_by
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean),
    note: form.note.trim() || null,
    ...(includeKey && form.api_key.trim() ? { api_key: form.api_key.trim() } : {}),
  };
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

  const loadServices = () =>
    api
      .get("/superadmin/ai-services")
      .then((res) => setServices(res.data?.data || []))
      .catch(() => {
        toast.error("Failed to load AI services");
        setServices([]);
      });

  useEffect(() => {
    if (tab !== "services") return;
    setServices(null);
    loadServices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="mb-8">
        <h2 className="text-2xl font-semibold tracking-tight text-gray-900">{meta.title}</h2>
        <p className="text-gray-600 mt-1">{meta.subtitle}</p>
      </div>

      {loading ? (
        <div className="p-12 text-center text-gray-600">Loading configuration...</div>
      ) : (
        <div className={`${tab === "usage" || tab === "services" ? "max-w-4xl" : "max-w-2xl"} space-y-6`}>
          {tab === "services" && (
            <ServicesTab services={services} onChanged={loadServices} />
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
            <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-6 space-y-4">
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
            <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-6 space-y-4">
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
            <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-6 space-y-4">
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
                <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-12 text-center text-gray-600">
                  Loading usage data...
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-4">
                      <p className="text-xs text-gray-500 uppercase">AI Questions (total)</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">
                        {usage.totals.ai_questions_total}
                      </p>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-4">
                      <p className="text-xs text-gray-500 uppercase">Generated (last 30 days)</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">
                        {usage.totals.ai_questions_30d}
                      </p>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-4">
                      <p className="text-xs text-gray-500 uppercase">Import Batches (30 days)</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">
                        {usage.totals.import_batches_30d}
                      </p>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200">
                      <h3 className="font-semibold text-gray-900">Per-College Usage</h3>
                      <p className="text-sm text-gray-500">
                        Questions explicitly assigned to each college via the AI generator
                      </p>
                    </div>
                    <table className="w-full">
                      <thead className="bg-gray-50/70 border-b border-gray-200">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">College</th>
                          <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Students</th>
                          <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">AI Questions Assigned</th>
                          <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Total Questions Assigned</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
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

                  <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200">
                      <h3 className="font-semibold text-gray-900">Recent Import Batches</h3>
                    </div>
                    {usage.recent_imports.length === 0 ? (
                      <div className="p-8 text-center text-gray-600 text-sm">No AI imports yet</div>
                    ) : (
                      <div className="divide-y divide-gray-100">
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
      className="px-6 py-2 bg-navy-900 text-white rounded-lg font-medium hover:bg-navy-800 disabled:opacity-50"
    >
      {saving ? "Saving..." : "Save Configuration"}
    </button>
  );
}

function ServicesTab({
  services,
  onChanged,
}: {
  services: AIServiceStatus[] | null;
  onChanged: () => void;
}) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, TestResult>>({});
  const [testing, setTesting] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState("");
  const [savingKey, setSavingKey] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [mode, setMode] = useState<"view" | "create" | "edit">("view");
  const [form, setForm] = useState<ServiceFormState>(EMPTY_FORM);
  const [savingForm, setSavingForm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    if (services && services.length > 0 && !selectedKey) {
      setSelectedKey(services[0].key);
    }
  }, [services, selectedKey]);

  useEffect(() => {
    setKeyInput("");
    if (mode === "view") setForm(EMPTY_FORM);
  }, [selectedKey, mode]);

  if (services === null) {
    return (
      <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-12 text-center text-gray-600">
        Loading services...
      </div>
    );
  }

  const selected = services.find((s) => s.key === selectedKey) || services[0];
  const configuredCount = services.filter((s) => s.configured).length;
  const enabledCount = services.filter((s) => s.is_enabled).length;

  const runTest = async (key: string) => {
    setTesting(key);
    try {
      const res = await api.post(`/superadmin/ai-services/${key}/test`);
      setResults((r) => ({ ...r, [key]: res.data?.data }));
    } catch {
      setResults((r) => ({
        ...r,
        [key]: { ok: false, message: "Test request failed", latency_ms: 0 },
      }));
    } finally {
      setTesting(null);
    }
  };

  const SelIcon = selected ? SERVICE_ICONS[selected.key] || CpuChipIcon : CpuChipIcon;
  const result = selected ? results[selected.key] : undefined;

  const saveKey = async () => {
    if (!selected || !keyInput.trim()) return;
    setSavingKey(true);
    try {
      await api.post(`/superadmin/ai-services/${selected.key}/key`, { value: keyInput.trim() });
      toast.success("Key saved and applied");
      setKeyInput("");
      onChanged();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.response?.data?.error || "Failed to save key");
    } finally {
      setSavingKey(false);
    }
  };

  const revokeStoredKey = async () => {
    if (!selected) return;
    setRevoking(true);
    try {
      await api.delete(`/superadmin/ai-services/${selected.key}/key`);
      toast.success("Override removed — reverted to environment value");
      onChanged();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.response?.data?.error || "Failed to remove key");
    } finally {
      setRevoking(false);
    }
  };

  const openCreate = () => {
    setMode("create");
    setForm({ ...EMPTY_FORM });
  };

  const openEdit = () => {
    if (!selected) return;
    setMode("edit");
    setForm(formFromService(selected));
  };

  const cancelForm = () => {
    setMode("view");
    setForm(EMPTY_FORM);
  };

  const setFormField = <K extends keyof ServiceFormState>(key: K, value: ServiceFormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submitForm = async () => {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (mode === "create" && !form.service_key.trim() && !form.name.trim()) {
      toast.error("Service key or name is required");
      return;
    }
    setSavingForm(true);
    try {
      if (mode === "create") {
        const res = await api.post("/superadmin/ai-services", payloadFromForm(form, true));
        const createdKey = res.data?.data?.key;
        toast.success("AI service created");
        setMode("view");
        onChanged();
        if (createdKey) setSelectedKey(createdKey);
      } else if (selected) {
        await api.put(`/superadmin/ai-services/${selected.key}`, payloadFromForm(form, true));
        toast.success("AI service updated");
        setMode("view");
        onChanged();
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.response?.data?.error || "Save failed");
    } finally {
      setSavingForm(false);
    }
  };

  const deleteService = async () => {
    if (!selected?.deletable) return;
    if (!window.confirm(`Delete AI service "${selected.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await api.delete(`/superadmin/ai-services/${selected.key}`);
      toast.success("Service deleted");
      setSelectedKey(null);
      setMode("view");
      onChanged();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.response?.data?.error || "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  const toggleEnabled = async () => {
    if (!selected) return;
    setToggling(true);
    try {
      await api.put(`/superadmin/ai-services/${selected.key}`, { is_enabled: !selected.is_enabled });
      toast.success(selected.is_enabled ? "Service disabled" : "Service enabled");
      onChanged();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.response?.data?.error || "Update failed");
    } finally {
      setToggling(false);
    }
  };

  const formFields = (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {mode === "create" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Service key</label>
            <input
              value={form.service_key}
              onChange={(e) => setFormField("service_key", e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
              placeholder="e.g. ai_coach"
              className={inputClass}
            />
            <p className="text-xs text-gray-500 mt-1">Lowercase slug; unique platform-wide.</p>
          </div>
        )}
        <div className={mode === "create" ? "" : "sm:col-span-2"}>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
          <input
            value={form.name}
            onChange={(e) => setFormField("name", e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Purpose</label>
          <input
            value={form.purpose}
            onChange={(e) => setFormField("purpose", e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
          <select
            value={form.provider}
            onChange={(e) => setFormField("provider", e.target.value)}
            className={inputClass}
          >
            {PROVIDER_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Default model</label>
          <input
            value={form.model}
            onChange={(e) => setFormField("model", e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">API endpoint</label>
          <input
            value={form.api_endpoint}
            onChange={(e) => setFormField("api_endpoint", e.target.value)}
            placeholder="https://api.example.com/v1"
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Organization ID</label>
          <input
            value={form.organization_id}
            onChange={(e) => setFormField("organization_id", e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Project ID</label>
          <input
            value={form.project_id}
            onChange={(e) => setFormField("project_id", e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Deployment name</label>
          <input
            value={form.deployment_name}
            onChange={(e) => setFormField("deployment_name", e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Region</label>
          <input
            value={form.region}
            onChange={(e) => setFormField("region", e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Timeout (ms)</label>
          <input
            type="number"
            value={form.timeout_ms}
            onChange={(e) => setFormField("timeout_ms", Number(e.target.value))}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Retry count</label>
          <input
            type="number"
            value={form.retry_count}
            onChange={(e) => setFormField("retry_count", Number(e.target.value))}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Max tokens</label>
          <input
            value={form.max_tokens}
            onChange={(e) => setFormField("max_tokens", e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Temperature</label>
          <input
            value={form.temperature}
            onChange={(e) => setFormField("temperature", e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Top P</label>
          <input
            value={form.top_p}
            onChange={(e) => setFormField("top_p", e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Rate limit (RPM)</label>
          <input
            value={form.rate_limit_rpm}
            onChange={(e) => setFormField("rate_limit_rpm", e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Concurrency</label>
          <input
            value={form.concurrency}
            onChange={(e) => setFormField("concurrency", e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Used by (comma-separated)</label>
          <input
            value={form.used_by}
            onChange={(e) => setFormField("used_by", e.target.value)}
            placeholder="AI Coach, Learning Hub"
            className={inputClass}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
          <textarea
            rows={2}
            value={form.note}
            onChange={(e) => setFormField("note", e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            API key {mode === "edit" ? "(leave blank to keep current)" : "(optional)"}
          </label>
          <input
            type="password"
            value={form.api_key}
            onChange={(e) => setFormField("api_key", e.target.value)}
            placeholder="sk-... / encrypted at rest"
            className={inputClass}
          />
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={form.streaming_enabled}
            onChange={(e) => setFormField("streaming_enabled", e.target.checked)}
          />
          Streaming enabled
        </label>
        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={form.is_enabled}
            onChange={(e) => setFormField("is_enabled", e.target.checked)}
          />
          Enabled
        </label>
      </div>
      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={submitForm}
          disabled={savingForm}
          className="px-4 py-2 bg-navy-900 text-white rounded-lg text-sm font-medium hover:bg-navy-800 disabled:opacity-50"
        >
          {savingForm ? "Saving..." : mode === "create" ? "Create service" : "Save changes"}
        </button>
        <button
          type="button"
          onClick={cancelForm}
          className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );

  return (
    <>
      <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200/70 shadow-admin-card px-5 py-4">
        <div>
          <p className="text-sm font-medium text-gray-900">
            {configuredCount} of {services.length} configured · {enabledCount} enabled
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            Create, edit, enable/disable, and rotate encrypted API keys for platform AI services.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="px-3 py-2 bg-navy-900 text-white rounded-lg text-sm font-medium hover:bg-navy-800"
        >
          Add service
        </button>
      </div>

      {mode === "create" ? (
        <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Create AI service</h3>
          {formFields}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4">
          <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card overflow-hidden self-start">
            {services.map((svc) => {
              const Icon = SERVICE_ICONS[svc.key] || CpuChipIcon;
              const active = selected && svc.key === selected.key;
              return (
                <button
                  key={svc.key}
                  type="button"
                  onClick={() => {
                    setSelectedKey(svc.key);
                    setMode("view");
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b border-gray-100 last:border-b-0 transition-colors ${
                    active ? "bg-navy-900/[0.04]" : "hover:bg-gray-50"
                  }`}
                >
                  <Icon className={`w-5 h-5 flex-shrink-0 ${active ? "text-admin-accent" : "text-gray-400"}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${active ? "text-admin-accent" : "text-gray-900"}`}>
                      {svc.name}
                    </p>
                    <p className="text-xs text-gray-500 capitalize">
                      {svc.provider}
                      {!svc.is_enabled ? " · disabled" : ""}
                    </p>
                  </div>
                  <span
                    className={`w-2 h-2 rounded-full ${
                      !svc.is_enabled ? "bg-amber-400" : svc.configured ? "bg-green-500" : "bg-gray-300"
                    }`}
                  />
                </button>
              );
            })}
          </div>

          {!selected ? (
            <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-12 text-center text-gray-500">
              Select or create a service.
            </div>
          ) : mode === "edit" ? (
            <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Edit {selected.name}</h3>
              <p className="text-xs text-gray-500 mb-4 font-mono">{selected.key}</p>
              {formFields}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-6">
              <div className="flex items-start justify-between mb-4 gap-3">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-navy-900/[0.04] p-2">
                    <SelIcon className="w-6 h-6 text-admin-accent" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{selected.name}</h3>
                    <p className="text-sm text-gray-500">{selected.purpose}</p>
                    <p className="text-xs text-gray-400 font-mono mt-1">{selected.key}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 justify-end">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                      selected.is_enabled ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {selected.is_enabled ? "Enabled" : "Disabled"}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                      selected.configured ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {selected.configured ? "Configured" : "Not set"}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 mb-5 pb-5 border-b border-gray-100">
                <button
                  type="button"
                  onClick={() => runTest(selected.key)}
                  disabled={!selected.testable || testing === selected.key || !selected.is_enabled}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-navy-900 text-white rounded-lg text-sm font-medium hover:bg-navy-800 disabled:opacity-50"
                >
                  <BoltIcon className="w-4 h-4" />
                  {testing === selected.key ? "Testing..." : "Test connection"}
                </button>
                <button
                  type="button"
                  onClick={openEdit}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={toggleEnabled}
                  disabled={toggling}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {toggling ? "Updating..." : selected.is_enabled ? "Disable" : "Enable"}
                </button>
                {selected.deletable && (
                  <button
                    type="button"
                    onClick={deleteService}
                    disabled={deleting}
                    className="px-3 py-2 border border-red-200 text-red-700 bg-red-50 rounded-lg text-sm hover:bg-red-100 disabled:opacity-50"
                  >
                    {deleting ? "Deleting..." : "Delete"}
                  </button>
                )}
                {result && (
                  <span
                    className={`inline-flex items-center gap-1.5 text-sm font-medium ${
                      result.ok ? "text-green-700" : "text-red-600"
                    }`}
                  >
                    {result.ok ? <CheckCircleIcon className="w-5 h-5" /> : <XCircleIcon className="w-5 h-5" />}
                    {result.message}
                    {result.latency_ms > 0 && (
                      <span className="text-gray-400 font-normal">· {result.latency_ms}ms</span>
                    )}
                  </span>
                )}
              </div>

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
                  <dt className="text-xs text-gray-500 uppercase">Endpoint</dt>
                  <dd className="text-gray-900 font-mono text-xs mt-0.5 break-all">
                    {selected.api_endpoint || "—"}
                  </dd>
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
                <div>
                  <dt className="text-xs text-gray-500 uppercase">Timeout</dt>
                  <dd className="text-gray-900 mt-0.5">{selected.timeout_ms}ms · {selected.retry_count} retries</dd>
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
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            status === "healthy" ? "bg-green-500" : "bg-amber-500"
                          }`}
                        />
                        {name.replace(/_/g, " ")}: {status}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="mb-5">
                <p className="text-xs text-gray-500 uppercase mb-2">Powers</p>
                <div className="flex flex-wrap gap-2">
                  {(selected.used_by || []).length === 0 ? (
                    <span className="text-xs text-gray-400">—</span>
                  ) : (
                    selected.used_by.map((feature) => (
                      <span key={feature} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                        {feature}
                      </span>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 mb-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500 uppercase mb-1">Key Source</p>
                  <span
                    className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium ${
                      selected.source === "database"
                        ? "bg-indigo-50 text-indigo-700"
                        : selected.source === "environment"
                          ? "bg-gray-100 text-gray-600"
                          : "bg-red-50 text-red-600"
                    }`}
                  >
                    {selected.source === "database"
                      ? "Platform override"
                      : selected.source === "environment"
                        ? "Environment"
                        : "Unset"}
                  </span>
                </div>
                <p className="text-xs font-mono text-gray-700 break-all">{selected.key_location}</p>
                {selected.note && <p className="text-xs text-gray-500 mt-2">{selected.note}</p>}
              </div>

              {selected.editable && (
                <div className="rounded-lg border border-gray-200 p-3">
                  <p className="text-xs text-gray-500 uppercase mb-2">Set / rotate platform key</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="password"
                      value={keyInput}
                      onChange={(e) => setKeyInput(e.target.value)}
                      placeholder="Paste new key value..."
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-navy-900/20"
                    />
                    <button
                      type="button"
                      onClick={saveKey}
                      disabled={!keyInput.trim() || savingKey}
                      className="px-3 py-2 bg-navy-900 text-white rounded-lg text-sm font-medium hover:bg-navy-800 disabled:opacity-50 whitespace-nowrap"
                    >
                      {savingKey ? "Saving..." : "Save & Apply"}
                    </button>
                    {selected.source === "database" && (
                      <button
                        type="button"
                        onClick={revokeStoredKey}
                        disabled={revoking}
                        className="px-3 py-2 border border-red-200 text-red-700 bg-red-50 rounded-lg text-sm font-medium hover:bg-red-100 disabled:opacity-50 whitespace-nowrap"
                      >
                        {revoking ? "Removing..." : "Revoke"}
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Encrypted at rest. Plaintext keys are never returned by the API.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
