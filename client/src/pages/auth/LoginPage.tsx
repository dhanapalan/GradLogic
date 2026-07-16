import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { Mail, Lock, ArrowRight, Loader2, Eye, EyeOff } from "lucide-react";
import studentAuthService, { parseApiError } from "../../services/studentAuthService";
import {
  getLandingPath,
  getWorkflowRedirectUrl,
} from "../../components/ProtectedRoute";

type LoginForm = {
  identifier: string;
  password: string;
  rememberMe: boolean;
};

export default function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    defaultValues: { rememberMe: false },
  });

  const onSubmit = async (form: LoginForm) => {
    setLoading(true);
    try {
      const result = await studentAuthService.login({
        email: form.identifier.trim(),
        password: form.password,
        rememberMe: form.rememberMe,
      });

      if (result.requires2FA) {
        navigate("/auth/2fa", { state: { challengeToken: result.challengeToken } });
        return;
      }

      setTimeout(() => {
        const landingPath = getLandingPath(result.user);
        const workflowRedirect = getWorkflowRedirectUrl(result.user, landingPath);
        if (workflowRedirect) {
          window.location.replace(workflowRedirect);
          return;
        }
        navigate(landingPath);
      }, 100);
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
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-700">
      <div className="mb-6">
        <h2 className="text-2xl font-black tracking-tight text-slate-900">Welcome back</h2>
        <p className="mt-1 text-sm text-slate-500">
          Sign in with your email or student ID.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <div>
          <label
            htmlFor="identifier"
            className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600"
          >
            Email or Student ID
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="identifier"
              type="text"
              {...register("identifier", {
                required: "Email or Student ID is required",
                minLength: { value: 2, message: "Enter a valid email or student ID" },
              })}
              className={`w-full rounded-xl border bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-900 transition-all placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.identifier ? "border-rose-300 ring-1 ring-rose-300" : "border-slate-200"}`}
              placeholder="you@college.edu or STU12345"
              autoComplete="username"
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
            <label
              htmlFor="password"
              className="block text-xs font-bold uppercase tracking-wider text-slate-600"
            >
              Password
            </label>
            <Link
              to="/auth/forgot-password"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              {...register("password", { required: "Password is required" })}
              className={`w-full rounded-xl border bg-slate-50 py-3 pl-10 pr-10 text-sm text-slate-900 transition-all placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.password ? "border-rose-300 ring-1 ring-rose-300" : "border-slate-200"}`}
              placeholder="Enter your password"
              autoComplete="current-password"
              aria-invalid={Boolean(errors.password)}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
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

        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            {...register("rememberMe")}
          />
          Remember me on this device
        </label>

        <button
          type="submit"
          disabled={loading}
          className="group flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white shadow-md shadow-indigo-200 transition-all hover:bg-indigo-700 hover:shadow-indigo-300 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-label="Signing in" />
          ) : (
            <>
              Sign In
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </>
          )}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        New to GradLogic?{" "}
        <Link
          to="/auth/register"
          className="font-bold text-indigo-600 hover:text-indigo-700 hover:underline"
        >
          Create a free account →
        </Link>
      </p>
    </div>
  );
}
