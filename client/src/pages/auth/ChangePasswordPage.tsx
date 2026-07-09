import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { Lock, ArrowRight, Loader2, Eye, EyeOff, ArrowLeft } from "lucide-react";
import api from "../../lib/api";
import { authActions, useAuthStore } from "../../stores/authStore";

type ChangeForm = { currentPassword: string; newPassword: string; confirm: string };

const PASSWORD_RULE = "At least 8 characters with an uppercase, a lowercase and a number.";

export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);
  const { register, handleSubmit, watch, formState: { errors } } = useForm<ChangeForm>();

  if (!isAuthenticated) {
    return (
      <div className="text-center">
        <p className="text-sm text-slate-500 mb-4">You must be signed in to change your password.</p>
        <Link to="/auth/login" className="text-sm font-bold text-indigo-600 hover:underline">Sign in</Link>
      </div>
    );
  }

  const onSubmit = async (form: ChangeForm) => {
    setLoading(true);
    try {
      await api.post("/auth/change-password", {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      // Server revokes all sessions after a password change → re-authenticate.
      toast.success("Password changed. Please sign in again.");
      authActions.logout();
      navigate("/auth/login");
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.response?.data?.message || "Could not change password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-700">
      <div className="mb-6">
        <h2 className="text-2xl font-black tracking-tight text-slate-900">Change password</h2>
        <p className="mt-1 text-sm text-slate-500">{PASSWORD_RULE}</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
            Current Password
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type={show ? "text" : "password"}
              {...register("currentPassword", { required: "Current password is required" })}
              className={`w-full rounded-xl border bg-slate-50 py-3 pl-10 pr-10 text-sm text-slate-900 transition-all placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.currentPassword ? "border-rose-300 ring-1 ring-rose-300" : "border-slate-200"}`}
              placeholder="Enter current password"
              autoComplete="current-password"
            />
            <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" tabIndex={-1}>
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.currentPassword && <p className="mt-1.5 text-xs text-rose-500">{errors.currentPassword.message}</p>}
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
            New Password
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type={show ? "text" : "password"}
              {...register("newPassword", {
                required: "New password is required",
                minLength: { value: 8, message: "Minimum 8 characters" },
                pattern: { value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, message: PASSWORD_RULE },
              })}
              className={`w-full rounded-xl border bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-900 transition-all placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.newPassword ? "border-rose-300 ring-1 ring-rose-300" : "border-slate-200"}`}
              placeholder="Enter a new password"
              autoComplete="new-password"
            />
          </div>
          {errors.newPassword && <p className="mt-1.5 text-xs text-rose-500">{errors.newPassword.message}</p>}
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
            Confirm New Password
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type={show ? "text" : "password"}
              {...register("confirm", {
                required: "Please confirm your new password",
                validate: (v) => v === watch("newPassword") || "Passwords don't match",
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
            <>Change password <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></>
          )}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        <Link to="/auth/login" className="inline-flex items-center gap-1.5 font-bold text-indigo-600 hover:text-indigo-700 hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
      </p>
    </div>
  );
}
