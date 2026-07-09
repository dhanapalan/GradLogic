import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { Lock, ArrowRight, Loader2, Eye, EyeOff, ArrowLeft, ShieldAlert } from "lucide-react";
import api from "../../lib/api";

type ResetForm = { password: string; confirm: string };

const PASSWORD_RULE =
  "At least 8 characters with an uppercase, a lowercase and a number.";

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { register, handleSubmit, watch, formState: { errors } } = useForm<ResetForm>();

  const onSubmit = async (form: ResetForm) => {
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, password: form.password });
      toast.success("Password reset. Please sign in with your new password.");
      navigate("/auth/login");
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.response?.data?.message || "Reset link is invalid or expired");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-700 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-50">
          <ShieldAlert className="h-6 w-6 text-rose-500" />
        </div>
        <h2 className="text-2xl font-black tracking-tight text-slate-900">Invalid reset link</h2>
        <p className="mt-2 text-sm text-slate-500">
          This link is missing its token. Please request a new password reset.
        </p>
        <Link to="/auth/forgot-password" className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-indigo-600 hover:text-indigo-700 hover:underline">
          Request new link <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-700">
      <div className="mb-6">
        <h2 className="text-2xl font-black tracking-tight text-slate-900">Set a new password</h2>
        <p className="mt-1 text-sm text-slate-500">{PASSWORD_RULE}</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
            New Password
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type={showPassword ? "text" : "password"}
              {...register("password", {
                required: "Password is required",
                minLength: { value: 8, message: "Minimum 8 characters" },
                pattern: {
                  value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/,
                  message: PASSWORD_RULE,
                },
              })}
              className={`w-full rounded-xl border bg-slate-50 py-3 pl-10 pr-10 text-sm text-slate-900 transition-all placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.password ? "border-rose-300 ring-1 ring-rose-300" : "border-slate-200"}`}
              placeholder="Enter a new password"
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && <p className="mt-1.5 text-xs text-rose-500">{errors.password.message}</p>}
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
            Confirm Password
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type={showPassword ? "text" : "password"}
              {...register("confirm", {
                required: "Please confirm your password",
                validate: (v) => v === watch("password") || "Passwords don't match",
              })}
              className={`w-full rounded-xl border bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-900 transition-all placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.confirm ? "border-rose-300 ring-1 ring-rose-300" : "border-slate-200"}`}
              placeholder="Re-enter your new password"
              autoComplete="new-password"
            />
          </div>
          {errors.confirm && <p className="mt-1.5 text-xs text-rose-500">{errors.confirm.message}</p>}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="group flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white shadow-md shadow-indigo-200 transition-all hover:bg-indigo-700 hover:shadow-indigo-300 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
            <>Reset password <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></>
          )}
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
