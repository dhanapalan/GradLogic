import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  ShieldCheck,
  ShieldOff,
  Loader2,
  Copy,
  Check,
  KeyRound,
  Smartphone,
} from "lucide-react";
import api from "../../lib/api";
import { authActions, useAuthStore } from "../../stores/authStore";

type SetupData = { secret: string; otpauthUrl: string };
type Phase = "idle" | "setup" | "disabling";

/** Format a base32 secret into groups of 4 for easier manual entry. */
function groupSecret(secret: string): string {
  return secret.replace(/(.{4})/g, "$1 ").trim();
}

export default function SecurityPage() {
  const user = useAuthStore((s) => s.user);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [setup, setSetup] = useState<SetupData | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void loadStatus();
  }, []);

  async function loadStatus() {
    try {
      const { data } = await api.get("/auth/2fa/status");
      setEnabled(!!data.data?.enabled);
    } catch {
      setEnabled(false);
    }
  }

  async function startSetup() {
    setBusy(true);
    try {
      const { data } = await api.post("/auth/2fa/setup");
      setSetup(data.data);
      setPhase("setup");
      setCode("");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Could not start 2FA setup");
    } finally {
      setBusy(false);
    }
  }

  async function confirmEnable() {
    setBusy(true);
    try {
      await api.post("/auth/2fa/enable", { code });
      toast.success("Two-factor authentication enabled");
      setEnabled(true);
      setPhase("idle");
      setSetup(null);
      if (user) authActions.setUser({ ...user, two_factor_enabled: true });
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Invalid code, try again");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDisable() {
    setBusy(true);
    try {
      await api.post("/auth/2fa/disable", { code });
      toast.success("Two-factor authentication disabled");
      setEnabled(false);
      setPhase("idle");
      if (user) authActions.setUser({ ...user, two_factor_enabled: false });
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Invalid code, try again");
    } finally {
      setBusy(false);
    }
  }

  function copySecret() {
    if (!setup) return;
    navigator.clipboard.writeText(setup.secret).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-black tracking-tight text-slate-900">Security</h1>
      <p className="mt-1 text-sm text-slate-500">Manage your account's sign-in security.</p>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${enabled ? "bg-emerald-50" : "bg-slate-100"}`}>
              {enabled ? (
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
              ) : (
                <ShieldOff className="h-5 w-5 text-slate-400" />
              )}
            </div>
            <div>
              <h2 className="font-bold text-slate-900">Two-Factor Authentication</h2>
              <p className="mt-0.5 text-sm text-slate-500">
                Add a one-time code from an authenticator app on top of your password.
              </p>
              {enabled !== null && (
                <span
                  className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    enabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {enabled ? "Enabled" : "Disabled"}
                </span>
              )}
            </div>
          </div>

          {enabled === null ? (
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          ) : phase === "idle" ? (
            enabled ? (
              <button
                onClick={() => { setPhase("disabling"); setCode(""); }}
                className="shrink-0 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-100"
              >
                Disable
              </button>
            ) : (
              <button
                onClick={startSetup}
                disabled={busy}
                className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enable"}
              </button>
            )
          ) : null}
        </div>

        {/* Enrollment flow */}
        {phase === "setup" && setup && (
          <div className="mt-6 border-t border-slate-100 pt-6 space-y-5">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-sm font-bold text-indigo-600">1</div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                  <Smartphone className="h-4 w-4" /> Add the key to your authenticator app
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  In Google Authenticator, Authy, Microsoft Authenticator or 1Password, choose
                  "Add account" → "Enter a setup key", then paste this key:
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <code className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm tracking-wider text-slate-800 break-all">
                    {groupSecret(setup.secret)}
                  </code>
                  <button
                    onClick={copySecret}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
                    title="Copy key"
                  >
                    {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
                <a
                  href={setup.otpauthUrl}
                  className="mt-2 inline-block text-xs font-semibold text-indigo-500 hover:underline"
                >
                  Open in an authenticator app on this device →
                </a>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-sm font-bold text-indigo-600">2</div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                  <KeyRound className="h-4 w-4" /> Enter the 6-digit code to confirm
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <input
                    inputMode="numeric"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000"
                    className="w-40 rounded-lg border border-slate-200 bg-slate-50 py-2 text-center text-lg font-bold tracking-[0.4em] text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    onClick={confirmEnable}
                    disabled={busy || code.length !== 6}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm & enable"}
                  </button>
                  <button
                    onClick={() => { setPhase("idle"); setSetup(null); }}
                    className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Disable flow */}
        {phase === "disabling" && (
          <div className="mt-6 border-t border-slate-100 pt-6">
            <p className="text-sm text-slate-600">
              Enter a current 6-digit code from your authenticator app to turn off 2FA.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <input
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                className="w-40 rounded-lg border border-slate-200 bg-slate-50 py-2 text-center text-lg font-bold tracking-[0.4em] text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
              <button
                onClick={confirmDisable}
                disabled={busy || code.length !== 6}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Disable 2FA"}
              </button>
              <button
                onClick={() => setPhase("idle")}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="font-bold text-slate-900">Password</h2>
        <p className="mt-0.5 text-sm text-slate-500">Change the password you use to sign in.</p>
        <a
          href="/auth/change-password"
          className="mt-3 inline-block rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Change password
        </a>
      </div>
    </div>
  );
}
