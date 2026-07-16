import { useEffect, useState } from "react";
import { Palette, Plug, Loader2, CheckCircle2, XCircle } from "lucide-react";
import toast from "react-hot-toast";
import settingsService from "../../../services/settingsService";
import api from "../../../lib/api";
import { PageHeader } from "./FeatureUi";

export function BrandingPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    "branding.platform_name": "GradLogic",
    "branding.tagline": "",
    "branding.primary_color": "#0f172a",
    "branding.accent_color": "#2563eb",
    "branding.logo_url": "",
    "branding.favicon_url": "",
  });

  useEffect(() => {
    settingsService
      .getSettings()
      .then((s) => {
        setForm((prev) => ({
          ...prev,
          "branding.platform_name": String(s["branding.platform_name"] ?? prev["branding.platform_name"]),
          "branding.tagline": String(s["branding.tagline"] ?? ""),
          "branding.primary_color": String(s["branding.primary_color"] ?? prev["branding.primary_color"]),
          "branding.accent_color": String(s["branding.accent_color"] ?? prev["branding.accent_color"]),
          "branding.logo_url": String(s["branding.logo_url"] ?? ""),
          "branding.favicon_url": String(s["branding.favicon_url"] ?? ""),
        }));
      })
      .catch(() => toast.error("Failed to load branding"))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await settingsService.updateSettings(form);
      toast.success("Branding saved");
    } catch {
      toast.error("Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-300" /></div>;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
      <PageHeader icon={Palette} title="Branding" description="Platform name, colors, and logo URLs." />
      <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
        {(
          [
            ["branding.platform_name", "Platform name"],
            ["branding.tagline", "Tagline"],
            ["branding.primary_color", "Primary color"],
            ["branding.accent_color", "Accent color"],
            ["branding.logo_url", "Logo URL"],
            ["branding.favicon_url", "Favicon URL"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="block text-sm">
            <span className="text-gray-600">{label}</span>
            <input
              value={form[key]}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </label>
        ))}
        <button
          type="button"
          disabled={saving}
          onClick={save}
          className="rounded-lg bg-navy-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Save branding
        </button>
      </div>
    </div>
  );
}

export function IntegrationsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [keys, setKeys] = useState<any[]>([]);
  const [form, setForm] = useState({
    "integrations.sso_enabled": false,
    "integrations.webhooks_url": "",
    "integrations.lms_sync": false,
  });

  useEffect(() => {
    Promise.all([
      settingsService.getSettings().catch(() => ({})),
      api.get("/superadmin/ai-services").then((r) => r.data?.data || r.data?.services || []).catch(() => []),
    ])
      .then(([s, services]) => {
        setForm({
          "integrations.sso_enabled": Boolean(s["integrations.sso_enabled"]),
          "integrations.webhooks_url": String(s["integrations.webhooks_url"] ?? ""),
          "integrations.lms_sync": Boolean(s["integrations.lms_sync"]),
        });
        setKeys(Array.isArray(services) ? services : []);
      })
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await settingsService.updateSettings(form);
      toast.success("Integrations saved");
    } catch {
      toast.error("Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-300" /></div>;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <PageHeader icon={Plug} title="Integrations" description="SSO, webhooks, LMS sync, and AI service keys." />

      <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
        <label className="flex items-center justify-between text-sm">
          <span>SSO enabled</span>
          <input
            type="checkbox"
            checked={form["integrations.sso_enabled"]}
            onChange={(e) => setForm({ ...form, "integrations.sso_enabled": e.target.checked })}
          />
        </label>
        <label className="flex items-center justify-between text-sm">
          <span>LMS sync</span>
          <input
            type="checkbox"
            checked={form["integrations.lms_sync"]}
            onChange={(e) => setForm({ ...form, "integrations.lms_sync": e.target.checked })}
          />
        </label>
        <label className="block text-sm">
          <span className="text-gray-600">Webhooks URL</span>
          <input
            value={form["integrations.webhooks_url"]}
            onChange={(e) => setForm({ ...form, "integrations.webhooks_url": e.target.value })}
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            placeholder="https://…"
          />
        </label>
        <button type="button" disabled={saving} onClick={save} className="rounded-lg bg-navy-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          Save integrations
        </button>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold mb-3">Connected AI services</h2>
        {keys.length === 0 ? (
          <p className="text-sm text-gray-500">
            Configure keys in{" "}
            <a href="/app/superadmin/ai-config?tab=services" className="text-admin-accent">
              AI Configuration
            </a>
            .
          </p>
        ) : (
          <ul className="space-y-2">
            {keys.map((s: any) => (
              <li key={s.key || s.name} className="flex items-center justify-between text-sm">
                <span>{s.label || s.name || s.key}</span>
                {s.configured || s.has_key || s.status === "configured" ? (
                  <span className="inline-flex items-center gap-1 text-emerald-600"><CheckCircle2 className="w-4 h-4" /> Ready</span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-gray-400"><XCircle className="w-4 h-4" /> Missing</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
