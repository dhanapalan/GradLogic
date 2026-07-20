import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
} from "lucide-react";
import studentAuthService, { parseApiError } from "../../services/studentAuthService";
import {
  getLandingPath,
  getWorkflowRedirectUrl,
} from "../../components/ProtectedRoute";
import { cn } from "../../lib/utils";
import {
  isUnknownPortal,
  portalExpectedRoles,
  resolveLoginPortal,
} from "./login/loginPortals";

type LoginForm = {
  identifier: string;
  password: string;
  rememberMe: boolean;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  // Which portal this hostname represents (exam./campus./admin.).
  // Resolved once — the hostname cannot change mid-session.
  const portal = useMemo(() => resolveLoginPortal(), []);

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

      // The account's real role decides where it lands. Flag only the case
      // where someone signed in at a portal that isn't theirs — they still
      // get in, but the redirect would otherwise look like a bug.
      const userRole = String(result.user?.role || "").toLowerCase();
      const expected = portalExpectedRoles(portal);
      if (
        expected.length &&
        userRole &&
        !expected.some((r: string) => userRole.includes(r) || r === userRole)
      ) {
        toast(`Signed in as ${userRole.replace(/_/g, " ")}. Opening your portal…`, {
          icon: "ℹ️",
        });
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

  // An unrecognised host gets no sign-in form at all — not a form that fails
  // on submit. Nothing here reveals which portals exist.
  if (isUnknownPortal(portal)) {
    return (
      <div className="animate-in fade-in duration-500 text-center">
        <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Portal not found
        </h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          This address isn&apos;t a recognised GradLogic portal. Please use the
          link your college or administrator provided.
        </p>
        <a
          href="https://gradlogic.atherasys.com"
          className="mt-5 inline-block rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-primary-700"
        >
          Go to GradLogic
        </a>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-500">
      <div className="mb-5">
        {portal.name && (
          <p className="mb-1 text-xs font-bold uppercase tracking-wider text-primary-600 dark:text-primary-400">
            {portal.name}
          </p>
        )}
        <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Welcome back
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {portal.tagline ?? "Sign in to continue."}
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <div>
          <label htmlFor="identifier" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
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
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
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

      {/* The "Today's AI Insights" panel was removed: it showed personalised
          copy ("your readiness increased by 6%") to a visitor who has not
          authenticated yet — placeholder data on a sign-in screen. That content
          belongs on the post-login dashboard where it is actually true.
          The security list was condensed from eleven items to a single line;
          the full detail lives on the security page. */}
      <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden />
        Encrypted connection · MFA-ready · Account lockout protection
      </p>

      {/* Self-service registration removed: accounts are provisioned by the
          college or platform admin, so a public "Register" link only led users
          into a flow they are not permitted to complete. */}
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-sm text-slate-500">
        <Link to="/contact" className="font-semibold hover:text-slate-800 dark:hover:text-slate-200">
          Need help signing in?
        </Link>
      </div>
    </div>
  );
}
