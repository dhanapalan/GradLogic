import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import {
  Mail,
  ArrowRight,
  Loader2,
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  RefreshCw,
} from "lucide-react";
import studentAuthService, { parseApiError } from "../../services/studentAuthService";

type EmailForm = { email: string };
type OtpForm = { otp: string };

type Step = "email" | "otp" | "sent";

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("email");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [email, setEmail] = useState("");
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);

  const emailForm = useForm<EmailForm>();
  const otpForm = useForm<OtpForm>();

  const requestCode = async (addr: string) => {
    const data = await studentAuthService.forgotPassword(addr);
    setDevOtp(data.otp || null);
    setDevResetUrl(data.resetUrl || null);
  };

  const onEmailSubmit = async (form: EmailForm) => {
    setLoading(true);
    try {
      const normalized = form.email.trim().toLowerCase();
      await requestCode(normalized);
      setEmail(normalized);
      setStep("otp");
      toast.success("If an account exists, a verification code was sent.");
    } catch (err) {
      toast.error(parseApiError(err).message);
    } finally {
      setLoading(false);
    }
  };

  const onOtpSubmit = async (form: OtpForm) => {
    setLoading(true);
    try {
      const { resetToken } = await studentAuthService.verifyOtp(email, form.otp.trim());
      // Router state, not a ?token= query param — keeps the reset token out of
      // the URL bar, browser history and any proxy/Referer logs.
      navigate("/auth/reset-password", { state: { token: resetToken } });
    } catch (err) {
      toast.error(parseApiError(err).message);
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setResending(true);
    try {
      await requestCode(email);
      toast.success("A new code was sent if the account exists.");
    } catch (err) {
      toast.error(parseApiError(err).message);
    } finally {
      setResending(false);
    }
  };

  if (step === "otp") {
    return (
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-700">
        <div className="mb-6">
          <h2 className="text-2xl font-black tracking-tight text-slate-900">Enter verification code</h2>
          <p className="mt-1 text-sm text-slate-500">
            We sent a 6-digit code to <span className="font-semibold text-slate-700">{email}</span>
          </p>
        </div>

        {devOtp && (
          <div className="mb-4 rounded-xl border border-indigo-100 bg-indigo-50 p-3 text-left text-xs text-indigo-800">
            Dev mode — OTP: <strong className="tracking-widest">{devOtp}</strong>
          </div>
        )}

        <form onSubmit={otpForm.handleSubmit(onOtpSubmit)} noValidate className="space-y-4">
          <div>
            <label
              htmlFor="otp"
              className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600"
            >
              One-time password
            </label>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                {...otpForm.register("otp", {
                  required: "Enter the 6-digit code",
                  pattern: { value: /^\d{6}$/, message: "Enter the 6-digit code" },
                })}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-center text-lg tracking-[0.35em] text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="••••••"
                aria-invalid={Boolean(otpForm.formState.errors.otp)}
              />
            </div>
            {otpForm.formState.errors.otp && (
              <p className="mt-1.5 text-xs text-rose-500" role="alert">
                {otpForm.formState.errors.otp.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Verify code <ArrowRight className="h-4 w-4" /></>}
          </button>
        </form>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
          <button
            type="button"
            onClick={() => void resend()}
            disabled={resending}
            className="inline-flex items-center gap-1.5 font-semibold text-indigo-600 hover:underline disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${resending ? "animate-spin" : ""}`} />
            Resend code
          </button>
          <button
            type="button"
            onClick={() => setStep("email")}
            className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800"
          >
            <ArrowLeft className="h-4 w-4" /> Change email
          </button>
        </div>

        {devResetUrl && (
          <a
            href={devResetUrl}
            className="mt-4 block text-center text-xs font-semibold text-indigo-600 hover:underline"
          >
            Or use email reset link →
          </a>
        )}
      </div>
    );
  }

  if (step === "sent") {
    return (
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-700 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
          <CheckCircle2 className="h-6 w-6 text-emerald-500" />
        </div>
        <h2 className="text-2xl font-black tracking-tight text-slate-900">Check your email</h2>
        <p className="mt-2 text-sm text-slate-500">
          If an account exists, we sent a verification code and reset link.
        </p>
        <Link
          to="/auth/login"
          className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-indigo-600 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-700">
      <div className="mb-6">
        <h2 className="text-2xl font-black tracking-tight text-slate-900">Forgot password?</h2>
        <p className="mt-1 text-sm text-slate-500">
          Enter your email and we&apos;ll send a one-time verification code.
        </p>
      </div>

      <form onSubmit={emailForm.handleSubmit(onEmailSubmit)} noValidate className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600"
          >
            Email Address
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="email"
              type="email"
              {...emailForm.register("email", {
                required: "Email is required",
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: "Enter a valid email",
                },
              })}
              className={`w-full rounded-xl border bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 ${emailForm.formState.errors.email ? "border-rose-300" : "border-slate-200"}`}
              placeholder="you@college.edu"
              autoComplete="email"
            />
          </div>
          {emailForm.formState.errors.email && (
            <p className="mt-1.5 text-xs text-rose-500" role="alert">
              {emailForm.formState.errors.email.message}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              Send verification code <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </form>

      <Link
        to="/auth/login"
        className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-indigo-600 hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> Back to sign in
      </Link>
    </div>
  );
}
