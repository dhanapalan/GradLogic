import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import studentAuthService, { parseApiError } from "../../services/studentAuthService";
import {
  getLandingPath,
  getWorkflowRedirectUrl,
} from "../../components/ProtectedRoute";
import { cn } from "../../lib/utils";
import {
  LOGIN_ROLES,
  readStoredLoginRole,
  storeLoginRole,
  type LoginRoleId,
} from "./login/loginRoles";

type LoginForm = {
  identifier: string;
  password: string;
  rememberMe: boolean;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<LoginRoleId>(() => {
    const fromQuery = params.get("role") as LoginRoleId | null;
    if (fromQuery && LOGIN_ROLES.some((r) => r.id === fromQuery)) return fromQuery;
    return readStoredLoginRole();
  });

  const {
    register,
    handleSubmit,
    setFocus,
    formState: { errors },
  } = useForm<LoginForm>({
    defaultValues: {
      rememberMe: localStorage.getItem("gradlogic.rememberMe") === "1",
      identifier: localStorage.getItem("gradlogic.lastIdentifier") || "",
    },
  });

  useEffect(() => {
    document.title = "Sign in · GradLogic";
    setFocus("identifier");
  }, [setFocus]);

  useEffect(() => {
    storeLoginRole(role);
  }, [role]);

  const activeRole = useMemo(
    () => LOGIN_ROLES.find((r) => r.id === role) ?? LOGIN_ROLES[0],
    [role]
  );

  const onSubmit = async (form: LoginForm) => {
    setLoading(true);
    try {
      const identifier = form.identifier.trim();
      if (identifier.includes("@") && !EMAIL_RE.test(identifier)) {
        toast.error("Enter a valid email address");
        return;
      }

      const result = await studentAuthService.login({
        email: identifier,
        password: form.password,
        rememberMe: form.rememberMe,
      });

      if (form.rememberMe) {
        localStorage.setItem("gradlogic.rememberMe", "1");
        localStorage.setItem("gradlogic.lastIdentifier", identifier);
      } else {
        localStorage.removeItem("gradlogic.rememberMe");
      }

      if (result.requires2FA) {
        navigate("/auth/2fa", { state: { challengeToken: result.challengeToken } });
        return;
      }

      const userRole = String(result.user?.role || "").toLowerCase();
      if (
        activeRole.expectedRoles.length &&
        !activeRole.expectedRoles.some((r) => userRole.includes(r) || r === userRole)
      ) {
        toast(
          `Signed in as ${userRole.replace(/_/g, " ")}. Opening your portal…`,
          { icon: "ℹ️" }
        );
      }

      setTimeout(() => {
        const landingPath = getLandingPath(result.user);
        const workflowRedirect = getWorkflowRedirectUrl(result.user, landingPath);
        if (workflowRedirect) {
          window.location.replace(workflowRedirect);
          return;
        }
        navigate(landingPath);
      }, 80);
    } catch (err: unknown) {
      const apiError = parseApiError(err);
      toast.error(
        apiError.fieldErrors?.email ||
          (apiError.message === "Validation failed" ? "Validation failed" : apiError.message) ||
          "Invalid email or password"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-in fade-in duration-500">
      <div className="mb-5">
        <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Welcome back
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Sign in as <span className="font-semibold text-slate-700 dark:text-slate-200">{activeRole.label}</span>
          {" — "}
          {activeRole.hint}
        </p>
      </div>

      {/* Role tabs */}
      <div
        role="tablist"
        aria-label="Login role"
        className="mb-5 flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-900"
      >
        {LOGIN_ROLES.map((r) => (
          <button
            key={r.id}
            type="button"
            role="tab"
            aria-selected={role === r.id}
            onClick={() => setRole(r.id)}
            className={cn(
              "whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
              role === r.id
                ? "bg-white text-primary-700 shadow-sm dark:bg-slate-800 dark:text-primary-300"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            )}
          >
            {r.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <div>
          <label htmlFor="identifier" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
            Email or Student ID
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              id="identifier"
              type="text"
              autoComplete="username"
              {...register("identifier", {
                required: "Email or Student ID is required",
                minLength: { value: 2, message: "Enter a valid email or student ID" },
                validate: (v) =>
                  !v.includes("@") || EMAIL_RE.test(v.trim()) || "Enter a valid email address",
              })}
              className={cn(
                "w-full rounded-xl border bg-white py-3 pl-10 pr-4 text-sm text-slate-900 transition placeholder:text-slate-400",
                "focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-slate-950 dark:text-white dark:border-slate-700",
                errors.identifier ? "border-rose-300 ring-1 ring-rose-300" : "border-slate-200"
              )}
              placeholder="you@college.edu or STU12345"
              aria-invalid={Boolean(errors.identifier)}
              aria-describedby={errors.identifier ? "identifier-error" : undefined}
            />
          </div>
          {errors.identifier && (
            <p id="identifier-error" className="mt-1.5 text-xs text-rose-500" role="alert">
              {errors.identifier.message}
            </p>
          )}
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="password" className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Password
            </label>
            <Link
              to="/auth/forgot-password"
              className="text-xs font-semibold text-primary-600 hover:underline dark:text-primary-400"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              {...register("password", {
                required: "Password is required",
                minLength: { value: 6, message: "Password must be at least 6 characters" },
              })}
              className={cn(
                "w-full rounded-xl border bg-white py-3 pl-10 pr-10 text-sm text-slate-900 transition placeholder:text-slate-400",
                "focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-slate-950 dark:text-white dark:border-slate-700",
                errors.password ? "border-rose-300 ring-1 ring-rose-300" : "border-slate-200"
              )}
              placeholder="Enter your password"
              aria-invalid={Boolean(errors.password)}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && (
            <p className="mt-1.5 text-xs text-rose-500" role="alert">
              {errors.password.message}
            </p>
          )}
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
            {...register("rememberMe")}
          />
          Remember me on this device
        </label>

        <button
          type="submit"
          disabled={loading}
          className="group flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 py-3 text-sm font-bold text-white shadow-md shadow-primary-600/20 transition hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-label="Signing in" />
          ) : (
            <>
              Sign In
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
            </>
          )}
        </button>
      </form>

      {/* AI insights + security */}
      <div className="mt-5 space-y-3">
        <div className="rounded-xl border border-primary-100 bg-primary-50/80 p-3 dark:border-primary-900 dark:bg-primary-950/40">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary-700 dark:text-primary-300">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Today&apos;s AI Insights
          </p>
          <ul className="mt-2 space-y-1 text-xs text-slate-700 dark:text-slate-300">
            <li>Welcome back! Your Placement Readiness increased by 6%.</li>
            <li>Complete today&apos;s assessment.</li>
            <li>Mock Interview scheduled tomorrow.</li>
          </ul>
        </div>

        <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-3 dark:border-emerald-900 dark:bg-emerald-950/30">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            Enterprise Security
          </p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
            HTTPS · MFA · CAPTCHA after failed attempts · Device recognition · Suspicious login
            detection · Session timeout · Password expiry · Account lockout · Login history · Geo
            detection
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
        <p>
          New to GradLogic?{" "}
          <Link to="/auth/register" className="font-bold text-primary-600 hover:underline dark:text-primary-400">
            Register
          </Link>
        </p>
        <Link to="/contact" className="font-semibold hover:text-slate-800 dark:hover:text-slate-200">
          Need help?
        </Link>
      </div>
    </div>
  );
}
