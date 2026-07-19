// =============================================================================
// Public Registration — Company/HR only
// Students do not self-register; their college provisions their account.
// =============================================================================

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../../lib/api";
import { authActions } from "../../stores/authStore";
import { getLandingPath } from "../../components/ProtectedRoute";
import { parseApiError } from "../../services/studentAuthService";
import {
  GraduationCap, Building2, Eye, EyeOff, Loader2,
  CheckCircle2, User, Mail, Lock, Briefcase, MapPin,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface CompanyForm {
  name: string; email: string; password: string; confirm: string;
  company_name: string; industry: string; headquarters: string;
}

const INDUSTRIES = [
  "Technology", "Finance & Banking", "Healthcare", "E-Commerce",
  "Manufacturing", "Education", "Consulting", "Telecommunications",
  "Media & Entertainment", "Automotive", "Real Estate", "Other",
];

// ── Input helper ──────────────────────────────────────────────────────────────
function Field({
  label, icon: Icon, type = "text", placeholder, value, onChange, error, optional,
}: {
  label: string; icon: typeof User; type?: string; placeholder?: string;
  value: string; onChange: (v: string) => void; error?: string; optional?: boolean;
}) {
  const [show, setShow] = useState(false);
  const isPassword = type === "password";
  return (
    <div>
      <label className="block text-xs font-bold text-slate-700 mb-1">
        {label} {optional && <span className="text-slate-400 font-normal">(optional)</span>}
      </label>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
        <input
          type={isPassword && !show ? "password" : "text"}
          placeholder={placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
          className={`w-full pl-9 pr-${isPassword ? "9" : "3"} py-2.5 bg-slate-50 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 transition-colors ${error ? "border-rose-300" : "border-slate-200"}`}
        />
        {isPassword && (
          <button type="button" onClick={() => setShow(s => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
      {error && <p className="text-xs text-rose-500 mt-1">{error}</p>}
    </div>
  );
}

// ── Password strength ─────────────────────────────────────────────────────────
// Must mirror server/src/validators/password.ts — a rule shown here that the
// server does not enforce (or vice versa) lets the form read valid while the
// API rejects it.
function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: "8+ characters", ok: password.length >= 8 },
    { label: "Lowercase",     ok: /[a-z]/.test(password) },
    { label: "Uppercase",     ok: /[A-Z]/.test(password) },
    { label: "Number",        ok: /\d/.test(password) },
  ];
  if (!password) return null;
  return (
    <div className="flex flex-wrap gap-3 mt-1">
      {checks.map(c => (
        <span key={c.label} className={`flex items-center gap-1 text-[10px] font-semibold ${c.ok ? "text-emerald-600" : "text-slate-400"}`}>
          <CheckCircle2 className={`h-3 w-3 ${c.ok ? "text-emerald-500" : "text-slate-300"}`} />
          {c.label}
        </span>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function RegisterPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [c, setC] = useState<CompanyForm>({
    name: "", email: "", password: "", confirm: "",
    company_name: "", industry: "", headquarters: "",
  });

  const setField = (key: keyof CompanyForm, val: string) => {
    setC(prev => ({ ...prev, [key]: val }));
    setErrors(e => { const n = { ...e }; delete n[key as string]; return n; });
  };

  const validateCompany = () => {
    const e: Record<string, string> = {};
    if (!c.name.trim())         e.name         = "Your name is required";
    if (!c.email.trim())        e.email        = "Email is required";
    if (c.password.length < 8)  e.password     = "Minimum 8 characters";
    if (c.password !== c.confirm) e.confirm    = "Passwords don't match";
    if (!c.company_name.trim()) e.company_name = "Company name is required";
    return e;
  };

  const submit = async () => {
    const errs = validateCompany();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    try {
      const { data } = await api.post("/auth/register/company", {
        name: c.name, email: c.email, password: c.password,
        company_name: c.company_name,
        industry: c.industry || undefined,
        headquarters: c.headquarters || undefined,
      });
      const result = data.data;

      authActions.login(result.accessToken, result.user, result.refreshToken, result.permissions ?? []);
      toast.success("Account created! Welcome 🎉");
      navigate(getLandingPath(result.user));
    } catch (err: unknown) {
      const { message, fieldErrors } = parseApiError(err);
      const msg = (fieldErrors && Object.values(fieldErrors)[0]) || message;
      toast.error(msg);
      if (fieldErrors) setErrors(fieldErrors);
      else if (msg.includes("email")) setErrors({ email: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-black text-slate-900">Create a company account</h2>
        <p className="text-sm text-slate-500 mt-1">Hire campus talent on GradLogic</p>
      </div>

      {/* Students are provisioned by their college — no self-registration */}
      <div className="flex gap-3 rounded-xl border border-indigo-100 bg-indigo-50/70 p-3">
        <GraduationCap className="h-5 w-5 shrink-0 text-indigo-500" aria-hidden />
        <div>
          <p className="text-xs font-bold text-indigo-900">Are you a student?</p>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
            Your college creates your GradLogic account. Contact your placement
            office or TPO to get your login, then{" "}
            <Link to="/auth/login?role=student" className="font-semibold text-indigo-600 hover:underline">
              sign in here
            </Link>.
          </p>
        </div>
      </div>

      {/* ── Company form ──────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <Field label="Your Name" icon={User} placeholder="Priya Mehta"
          value={c.name} onChange={v => setField("name", v)} error={errors.name} />
        <Field label="Work Email" icon={Mail} placeholder="priya@company.com"
          value={c.email} onChange={v => setField("email", v)} error={errors.email} />
        <div>
          <Field label="Password" icon={Lock} type="password" placeholder="Min 8 characters"
            value={c.password} onChange={v => setField("password", v)} error={errors.password} />
          <PasswordStrength password={c.password} />
        </div>
        <Field label="Confirm Password" icon={Lock} type="password"
          value={c.confirm} onChange={v => setField("confirm", v)} error={errors.confirm} />

        <div className="pt-1">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Company Details</p>
          <div className="space-y-3">
            <Field label="Company Name" icon={Building2} placeholder="Acme Technologies"
              value={c.company_name} onChange={v => setField("company_name", v)} error={errors.company_name} />
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Industry <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <div className="relative">
                <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                <select
                  value={c.industry}
                  onChange={e => setField("industry", e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 appearance-none"
                >
                  <option value="">Select industry…</option>
                  {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
            </div>
            <Field label="Headquarters" icon={MapPin} placeholder="Bangalore, India"
              value={c.headquarters} onChange={v => setField("headquarters", v)} optional />
          </div>
        </div>
      </div>

      {/* Submit */}
      <button
        type="button"
        onClick={submit}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors shadow-md shadow-indigo-200"
      >
        {loading
          ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating account…</>
          : "Create Company Account"}
      </button>

      {/* Terms */}
      <p className="text-center text-xs text-slate-400">
        By registering you agree to our{" "}
        <Link to="/terms" className="text-indigo-500 hover:underline">Terms</Link>
        {" "}&amp;{" "}
        <Link to="/privacy" className="text-indigo-500 hover:underline">Privacy Policy</Link>
      </p>

      {/* Login link */}
      <p className="text-center text-sm text-slate-500">
        Already have an account?{" "}
        <Link to="/auth/login" className="text-indigo-600 font-bold hover:underline">Sign in</Link>
      </p>
    </div>
  );
}
