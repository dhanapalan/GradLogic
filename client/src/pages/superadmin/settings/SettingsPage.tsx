import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../../../lib/api";
import settingsService, { SystemSettings } from "../../../services/settingsService";

type Tab = "system" | "backup";

export default function SettingsPage() {
  const [searchParams] = useSearchParams();
  const tab: Tab = searchParams.get("tab") === "backup" ? "backup" : "system";

  const [settings, setSettings] = useState<SystemSettings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        setSettings(await settingsService.getSettings());
      } catch (error) {
        toast.error("Failed to load settings");
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const set = (key: string, value: unknown) =>
    setSettings((s) => ({ ...s, [key]: value }));

  const save = async (keys: string[]) => {
    setSaving(true);
    try {
      const payload: SystemSettings = {};
      for (const k of keys) payload[k] = settings[k];
      await settingsService.updateSettings(payload);
      toast.success("Settings saved");
    } catch (error) {
      toast.error("Failed to save settings");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold tracking-tight text-gray-900">
          {tab === "backup" ? "Backup & Security" : "System Settings"}
        </h2>
        <p className="text-gray-600 mt-1">
          {tab === "backup"
            ? "Security policies and backup configuration"
            : "Platform-wide configuration"}
        </p>
      </div>

      {loading ? (
        <div className="p-12 text-center text-gray-600">Loading settings...</div>
      ) : tab === "backup" ? (
        <BackupSecurityTab settings={settings} set={set} save={save} saving={saving} />
      ) : (
        <SystemTab settings={settings} set={set} save={save} saving={saving} />
      )}
    </div>
  );
}

interface TabProps {
  settings: SystemSettings;
  set: (key: string, value: unknown) => void;
  save: (keys: string[]) => Promise<void>;
  saving: boolean;
}

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description: string;
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          checked ? "bg-navy-900" : "bg-gray-300"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}

const inputClass =
  "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-admin-accent focus:border-transparent";

function SystemTab({ settings, set, save, saving }: TabProps) {
  const KEYS = [
    "platform.name",
    "platform.support_email",
    "platform.maintenance_mode",
    "platform.allow_registrations",
    "billing.fee_per_student",
    "billing.academic_year",
  ];

  return (
    <div className="max-w-2xl space-y-6">
      <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-6 space-y-4">
        <h3 className="font-semibold text-gray-900">Platform</h3>
        <Field label="Platform Name">
          <input
            type="text"
            value={String(settings["platform.name"] ?? "")}
            onChange={(e) => set("platform.name", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Support Email">
          <input
            type="email"
            value={String(settings["platform.support_email"] ?? "")}
            onChange={(e) => set("platform.support_email", e.target.value)}
            className={inputClass}
          />
        </Field>
        <div className="divide-y divide-gray-100">
          <Toggle
            checked={settings["platform.maintenance_mode"] === true}
            onChange={(v) => set("platform.maintenance_mode", v)}
            label="Maintenance Mode"
            description="Show a maintenance banner and block student logins"
          />
          <Toggle
            checked={settings["platform.allow_registrations"] === true}
            onChange={(v) => set("platform.allow_registrations", v)}
            label="Allow Registrations"
            description="Let new colleges request accounts from the public site"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-6 space-y-4">
        <h3 className="font-semibold text-gray-900">Billing Defaults</h3>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Fee per Student (₹)" hint="Charged per student per academic year">
            <input
              type="number"
              min={0}
              value={Number(settings["billing.fee_per_student"] ?? 500)}
              onChange={(e) => set("billing.fee_per_student", Number(e.target.value))}
              className={inputClass}
            />
          </Field>
          <Field label="Academic Year" hint="Format: 2026-27">
            <input
              type="text"
              value={String(settings["billing.academic_year"] ?? "")}
              onChange={(e) => set("billing.academic_year", e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">System Logs</h3>
            <p className="text-xs text-gray-500 mt-1">
              Every admin action is recorded in the audit trail — logins, approvals, imports,
              backups, and configuration changes.
            </p>
          </div>
          <Link
            to="/app/superadmin/audit-trail"
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 whitespace-nowrap"
          >
            View Audit Logs
          </Link>
        </div>
      </div>

      <button
        onClick={() => save(KEYS)}
        disabled={saving}
        className="px-6 py-2 bg-navy-900 text-white rounded-lg font-medium hover:bg-navy-800 disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save Settings"}
      </button>
    </div>
  );
}

function BackupSecurityTab({ settings, set, save, saving }: TabProps) {
  const KEYS = [
    "security.password_min_length",
    "security.session_timeout_hours",
    "security.enforce_2fa",
    "backup.auto_enabled",
    "backup.frequency",
    "backup.retention_days",
  ];

  const [exporting, setExporting] = useState(false);
  const lastBackup = settings["backup.last_run_at"]
    ? new Date(String(settings["backup.last_run_at"])).toLocaleString()
    : null;

  const handleBackupNow = async () => {
    setExporting(true);
    try {
      const res = await api.get("/superadmin/backup/export", { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `gradlogic-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      set("backup.last_run_at", new Date().toISOString());
      toast.success("Backup exported");
    } catch {
      toast.error("Backup export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-6 space-y-4">
        <h3 className="font-semibold text-gray-900">Security</h3>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Minimum Password Length">
            <input
              type="number"
              min={6}
              max={32}
              value={Number(settings["security.password_min_length"] ?? 8)}
              onChange={(e) => set("security.password_min_length", Number(e.target.value))}
              className={inputClass}
            />
          </Field>
          <Field label="Session Timeout (hours)">
            <input
              type="number"
              min={1}
              value={Number(settings["security.session_timeout_hours"] ?? 168)}
              onChange={(e) => set("security.session_timeout_hours", Number(e.target.value))}
              className={inputClass}
            />
          </Field>
        </div>
        <Toggle
          checked={settings["security.enforce_2fa"] === true}
          onChange={(v) => set("security.enforce_2fa", v)}
          label="Enforce Two-Factor Authentication"
          description="Require 2FA for all admin accounts"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">Backups</h3>
            <p className="text-xs text-gray-500 mt-1">
              {lastBackup ? `Last backup: ${lastBackup}` : "No backup has been run yet"}
            </p>
          </div>
          <button
            onClick={handleBackupNow}
            disabled={exporting}
            className="px-4 py-2 bg-navy-900 text-white rounded-lg text-sm font-medium hover:bg-navy-800 disabled:opacity-50"
          >
            {exporting ? "Exporting..." : "Download Backup Now"}
          </button>
        </div>
        <p className="text-xs text-gray-500">
          Downloads a JSON export of colleges, users (no passwords), the question bank, workflows,
          and settings. Scheduled server-side dumps are configured below and run at the
          infrastructure level.
        </p>
        <Toggle
          checked={settings["backup.auto_enabled"] === true}
          onChange={(v) => set("backup.auto_enabled", v)}
          label="Automatic Backups"
          description="Run scheduled database backups"
        />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Frequency">
            <select
              value={String(settings["backup.frequency"] ?? "daily")}
              onChange={(e) => set("backup.frequency", e.target.value)}
              className={inputClass}
            >
              <option value="hourly">Hourly</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </Field>
          <Field label="Retention (days)">
            <input
              type="number"
              min={1}
              value={Number(settings["backup.retention_days"] ?? 30)}
              onChange={(e) => set("backup.retention_days", Number(e.target.value))}
              className={inputClass}
            />
          </Field>
        </div>
      </div>

      <button
        onClick={() => save(KEYS)}
        disabled={saving}
        className="px-6 py-2 bg-navy-900 text-white rounded-lg font-medium hover:bg-navy-800 disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save Settings"}
      </button>
    </div>
  );
}
