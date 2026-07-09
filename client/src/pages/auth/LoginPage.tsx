import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { Mail, Lock, ArrowRight, Loader2, Eye, EyeOff } from "lucide-react";
import api from "../../lib/api";
import { authActions } from "../../stores/authStore";
import {
  getLandingPath,
  getWorkflowRedirectUrl,
} from "../../components/ProtectedRoute";

type LoginForm = {
  email: string;
  password: string;
};

export default function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [msLoading, setMsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>();

  const onSubmit = async (form: LoginForm) => {
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", form);

      // 2FA gate: password OK but a TOTP code is required to finish signing in.
      if (data.data?.requires2FA) {
        navigate("/auth/2fa", { state: { challengeToken: data.data.challengeToken } });
        return;
      }

      const { accessToken, refreshToken, permissions, user } = data.data;
      authActions.login(accessToken, user, refreshToken, permissions ?? []);

      setTimeout(() => {
        const landingPath = getLandingPath(user);
        const workflowRedirect = getWorkflowRedirectUrl(user, landingPath);
        if (workflowRedirect) { window.location.replace(workflowRedirect); return; }
        navigate(landingPath);
      }, 100);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  const handleMicrosoftLogin = async () => {
    setMsLoading(true);
    try {
      const { data } = await api.get("/auth/microsoft/url");
      if (data?.data?.url) {
        if (data.data.state) sessionStorage.setItem("ms_oauth_state", data.data.state);
        window.location.href = data.data.url;
      }
    } catch {
      toast.error("Failed to initiate Microsoft login");
      setMsLoading(false);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-700">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-black tracking-tight text-slate-900">
          Welcome back
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Students, companies and colleges — sign in below.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Email */}
        <div>
          <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
            Email Address
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="email"
              {...register("email", { required: "Email is required" })}
              className={`w-full rounded-xl border bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-900 transition-all placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.email ? "border-rose-300 ring-1 ring-rose-300" : "border-slate-200"}`}
              placeholder="you@company.com"
              autoComplete="email"
            />
          </div>
          {errors.email && (
            <p className="mt-1.5 text-xs text-rose-500">{errors.email.message}</p>
          )}
        </div>

        {/* Password */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
              Password
            </label>
            <Link to="/auth/forgot-password" className="text-xs font-semibold text-indigo-500 hover:text-indigo-700 hover:underline">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type={showPassword ? "text" : "password"}
              {...register("password", { required: "Password is required" })}
              className={`w-full rounded-xl border bg-slate-50 py-3 pl-10 pr-10 text-sm text-slate-900 transition-all placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.password ? "border-rose-300 ring-1 ring-rose-300" : "border-slate-200"}`}
              placeholder="Enter your password"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && (
            <p className="mt-1.5 text-xs text-rose-500">{errors.password.message}</p>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="group flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white shadow-md shadow-indigo-200 transition-all hover:bg-indigo-700 hover:shadow-indigo-300 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              Sign In
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </>
          )}
        </button>

        {/* Microsoft SSO */}
        {!window.location.hostname.startsWith("college.") &&
          !window.location.hostname.startsWith("campus.") &&
          !window.location.hostname.startsWith("student.") && (
            <>
              <div className="relative my-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-white px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400">or</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleMicrosoftLogin}
                disabled={loading || msLoading}
                className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-50 hover:border-slate-300 active:scale-[0.98] disabled:opacity-60"
              >
                {msLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <svg className="h-4 w-4" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
                      <path d="M10 0H0V10H10V0Z" fill="#F25022" />
                      <path d="M21 0H11V10H21V0Z" fill="#7FBA00" />
                      <path d="M10 11H0V21H10V11Z" fill="#00A4EF" />
                      <path d="M21 11H11V21H21V11Z" fill="#FFB900" />
                    </svg>
                    Continue with Microsoft
                  </>
                )}
              </button>
            </>
          )}
      </form>

      {/* Register link */}
      <p className="mt-6 text-center text-sm text-slate-500">
        New to GradLogic?{" "}
        <Link to="/auth/register" className="font-bold text-indigo-600 hover:text-indigo-700 hover:underline">
          Create a free account →
        </Link>
      </p>
    </div>
  );
}
