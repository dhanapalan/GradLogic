// =============================================================================
// Public Registration — Students + Company/HR
// Two-tab form; auto-login on success
// =============================================================================

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../../lib/api";
import { authActions } from "../../stores/authStore";
import { getLandingPath } from "../../components/ProtectedRoute";
import {
  GraduationCap, Building2, Eye, EyeOff, Loader2,
  CheckCircle2, User, Mail, Lock, Phone, BookOpen, Calendar,
  Briefcase, MapPin,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
type Tab = "student" | "company";

interface StudentForm {
  name: string; email: string; password: string; confirm: string;
  phone: string; college_name: string; degree: string;
  specialization: string; passing_year: string;
}
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
function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: "8+ characters", ok: password.length >= 8 },
    { label: "Uppercase",     ok: /[A-Z]/.test(password) },
    { label: "Number",        ok: /\d/.test(password) },
  ];
  if (!password) return null;
  return (
    <div className="flex gap-3 mt-1">
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
  const [tab, setTab] = useState<Tab>("student");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Student form
  const [s, setS] = useState<StudentForm>({
    name: "", email: "", password: "", confirm: "",
    phone: "", college_name: "", degree: "", specialization: "", passing_year: "",
  });

  // Company form
  const [c, setC] = useState<CompanyForm>({
    name: "", email: "", password: "", confirm: "",
    company_name: "", industry: "", headquarters: "",
  });

  const setField = <T extends StudentForm | CompanyForm>(
    setter: React.Dispatch<React.SetStateAction<T>>,
    key: keyof T,
    val: string
  ) => {
    setter(prev => ({ ...prev, [key]: val }));
    setErrors(e => { const n = { ...e }; delete n[key as string]; return n; });
  };

  const validateStudent = () => {
    const e: Record<string, string> = {};
    if (!s.name.trim())     e.name     = "Name is required";
    if (!s.email.trim())    e.email    = "Email is required";
    if (s.password.length < 8) e.password = "Minimum 8 characters";
    if (s.password !== s.confirm) e.confirm = "Passwords don't match";
    return e;
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
    const errs = tab === "student" ? validateStudent() : validateCompany();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    try {
      let result;
      if (tab === "student") {
        const { data } = await api.post("/auth/register/student", {
          name: s.name, email: s.email, password: s.password,
          phone: s.phone || undefined,
          college_name: s.college_name || undefined,
          degree: s.degree || undefined,
          specialization: s.specialization || undefined,
          passing_year: s.passing_year ? parseInt(s.passing_year) : undefined,
        });
        result = data.data;
      } else {
        const { data } = await api.post("/auth/register/company", {
          name: c.name, email: c.email, password: c.password,
          company_name: c.company_name,
          industry: c.industry || undefined,
          headquarters: c.headquarters || undefined,
        });
        result = data.data;
      }

      authActions.login(result.accessToken, result.user, result.refreshToken, result.permissions ?? []);
      toast.success("Account created! Welcome 🎉");
      navigate(getLandingPath(result.user));
    } catch (err: any) {
      const msg = err.response?.data?.error || "Registration failed. Please try again.";
      toast.error(msg);
      if (msg.includes("email")) setErrors({ email: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-black text-slate-900">Create your account</h2>
        <p className="text-sm text-slate-500 mt-1">Choose your account type to get started</p>
      </div>

      {/* Tab selector */}
      <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
        {([
          { key: "student", label: "Student",    icon: GraduationCap, desc: "Learn & get placed" },
          { key: "company", label: "Company/HR", icon: Building2,     desc: "Hire campus talent" },
        ] as const).map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => { setTab(t.key); setErrors({}); }}
            className={`flex flex-col items-center gap-1 py-3 px-2 rounded-lg transition-all text-sm font-bold ${
              tab === t.key ? "bg-white shadow-sm text-indigo-700" : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <t.icon className={`h-5 w-5 ${tab === t.key ? "text-indigo-500" : "text-slate-300"}`} />
            {t.label}
            <span className="text-[10px] font-normal text-slate-400">{t.desc}</span>
          </button>
        ))}
      </div>

      {/* ── Student form ──────────────────────────────────────────────────── */}
      {tab === "student" && (
        <div className="space-y-3">
          <Field label="Full Name" icon={User} placeholder="Rahul Sharma"
            value={s.name} onChange={v => setField(setS, "name", v)} error={errors.name} />
          <Field label="Email" icon={Mail} placeholder="rahul@college.edu"
            value={s.email} onChange={v => setField(setS, "email", v)} error={errors.email} />
          <div>
            <Field label="Password" icon={Lock} type="password" placeholder="Min 8 characters"
              value={s.password} onChange={v => setField(setS, "password", v)} error={errors.password} />
            <PasswordStrength password={s.password} />
          </div>
          <Field label="Confirm Password" icon={Lock} type="password"
            value={s.confirm} onChange={v => setField(setS, "confirm", v)} error={errors.confirm} />

          <div className="pt-1">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Academic Details (optional)</p>
            <div className="space-y-3">
              <Field label="Phone" icon={Phone} placeholder="+91 9876543210"
                value={s.phone} onChange={v => setField(setS, "phone", v)} optional />
              <Field label="College / University" icon={BookOpen} placeholder="IIT Bombay, VTU…"
                value={s.college_name} onChange={v => setField(setS, "college_name", v)} optional />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Degree" icon={GraduationCap} placeholder="B.Tech, MBA…"
                  value={s.degree} onChange={v => setField(setS, "degree", v)} optional />
                <Field label="Passing Year" icon={Calendar} placeholder="2025"
                  value={s.passing_year} onChange={v => setField(setS, "passing_year", v)} optional />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Company form ──────────────────────────────────────────────────── */}
      {tab === "company" && (
        <div className="space-y-3">
          <Field label="Your Name" icon={User} placeholder="Priya Mehta"
            value={c.name} onChange={v => setField(setC, "name", v)} error={errors.name} />
          <Field label="Work Email" icon={Mail} placeholder="priya@company.com"
            value={c.email} onChange={v => setField(setC, "email", v)} error={errors.email} />
          <div>
            <Field label="Password" icon={Lock} type="password" placeholder="Min 8 characters"
              value={c.password} onChange={v => setField(setC, "password", v)} error={errors.password} />
            <PasswordStrength password={c.password} />
          </div>
          <Field label="Confirm Password" icon={Lock} type="password"
            value={c.confirm} onChange={v => setField(setC, "confirm", v)} error={errors.confirm} />

          <div className="pt-1">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Company Details</p>
            <div className="space-y-3">
              <Field label="Company Name" icon={Building2} placeholder="Acme Technologies"
                value={c.company_name} onChange={v => setField(setC, "company_name", v)} error={errors.company_name} />
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Industry <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                  <select
                    value={c.industry}
                    onChange={e => setField(setC, "industry", e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 appearance-none"
                  >
                    <option value="">Select industry…</option>
                    {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
              </div>
              <Field label="Headquarters" icon={MapPin} placeholder="Bangalore, India"
                value={c.headquarters} onChange={v => setField(setC, "headquarters", v)} optional />
            </div>
          </div>
        </div>
      )}

      {/* Submit */}
      <button
        type="button"
        onClick={submit}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors shadow-md shadow-indigo-200"
      >
        {loading
          ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating account…</>
          : tab === "student" ? "Create Student Account" : "Create Company Account"}
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
