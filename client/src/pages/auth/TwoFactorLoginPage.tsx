import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { ShieldCheck, Loader2, ArrowLeft } from "lucide-react";
import api from "../../lib/api";
import { authActions } from "../../stores/authStore";
import { getLandingPath, getWorkflowRedirectUrl } from "../../components/ProtectedRoute";

/**
 * Second step of a 2FA login. Reached from LoginPage with the short-lived
 * `challengeToken` in router state. The user enters the 6-digit code from their
 * authenticator app to complete authentication.
 */
export default function TwoFactorLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const challengeToken = (location.state as { challengeToken?: string } | null)?.challengeToken;

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // No challenge token means the user landed here directly — send them back.
    if (!challengeToken) navigate("/auth/login", { replace: true });
    else inputRef.current?.focus();
  }, [challengeToken, navigate]);

  const submit = async (value: string) => {
    if (!challengeToken || value.length !== 6) return;
    setLoading(true);
    try {
      const { data } = await api.post("/auth/2fa/verify", { challengeToken, code: value });
      const { accessToken, refreshToken, permissions, user } = data.data;
      authActions.login(accessToken, user, refreshToken, permissions ?? []);

      const landingPath = getLandingPath(user);
      const workflowRedirect = getWorkflowRedirectUrl(user, landingPath);
      if (workflowRedirect) { window.location.replace(workflowRedirect); return; }
      navigate(landingPath);
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.response?.data?.message || "Invalid verification code");
      setCode("");
      inputRef.current?.focus();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-700">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50">
          <ShieldCheck className="h-6 w-6 text-indigo-600" />
        </div>
        <h2 className="text-2xl font-black tracking-tight text-slate-900">Two-factor authentication</h2>
        <p className="mt-1 text-sm text-slate-500">
          Enter the 6-digit code from your authenticator app.
        </p>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); void submit(code); }}
        className="space-y-4"
      >
        <input
          ref={inputRef}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => {
            const next = e.target.value.replace(/\D/g, "").slice(0, 6);
            setCode(next);
            if (next.length === 6) void submit(next);
          }}
          placeholder="000000"
          className="w-full rounded-xl border border-slate-200 bg-slate-50 py-4 text-center text-2xl font-bold tracking-[0.5em] text-slate-900 transition-all placeholder:text-slate-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />

        <button
          type="submit"
          disabled={loading || code.length !== 6}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white shadow-md shadow-indigo-200 transition-all hover:bg-indigo-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify & sign in"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        <Link to="/auth/login" className="inline-flex items-center gap-1.5 font-bold text-indigo-600 hover:text-indigo-700 hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to sign in
        </Link>
      </p>
    </div>
  );
}
