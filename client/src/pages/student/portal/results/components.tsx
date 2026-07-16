import type { ReactNode } from "react";
import { AlertTriangle, Loader2, BarChart3 } from "lucide-react";

export function LoadingBlock({ label = "Loading analytics" }: { label?: string }) {
  return (
    <div
      className="flex h-40 items-center justify-center rounded-2xl border border-slate-100 bg-white"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="h-6 w-6 animate-spin text-indigo-500" aria-label={label} />
    </div>
  );
}

export function EmptyBlock({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center">
      <BarChart3 className="mx-auto mb-2 h-8 w-8 text-slate-300" aria-hidden />
      <p className="text-sm font-bold text-slate-500">{title}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-2xl border border-rose-100 bg-rose-50 p-5 text-sm text-rose-700" role="alert">
      <div className="flex gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-bold">Couldn’t load this section</p>
          <p className="mt-0.5 text-rose-600/90">{message}</p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-rose-700 shadow-sm ring-1 ring-rose-200 hover:bg-rose-50"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function AnalyticsCard({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-black text-slate-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function MetricTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-black text-slate-900">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function PerformanceBadge({ label }: { label: string }) {
  const styles: Record<string, string> = {
    Excellent: "bg-emerald-50 text-emerald-700 border-emerald-100",
    Good: "bg-sky-50 text-sky-700 border-sky-100",
    Average: "bg-amber-50 text-amber-800 border-amber-100",
    "Needs Improvement": "bg-rose-50 text-rose-700 border-rose-100",
    Pass: "bg-emerald-50 text-emerald-700 border-emerald-100",
    Fail: "bg-rose-50 text-rose-700 border-rose-100",
    Achieved: "bg-emerald-50 text-emerald-700 border-emerald-100",
    "Partially Achieved": "bg-amber-50 text-amber-800 border-amber-100",
    "Not Attempted": "bg-slate-50 text-slate-600 border-slate-200",
    High: "bg-rose-50 text-rose-700 border-rose-100",
    Medium: "bg-amber-50 text-amber-800 border-amber-100",
    Low: "bg-slate-50 text-slate-600 border-slate-200",
    Correct: "bg-emerald-50 text-emerald-700 border-emerald-100",
    Wrong: "bg-rose-50 text-rose-700 border-rose-100",
    Pending: "bg-amber-50 text-amber-800 border-amber-100",
    Completed: "bg-slate-100 text-slate-700 border-slate-200",
    "Pending Evaluation": "bg-amber-50 text-amber-800 border-amber-100",
  };
  return (
    <span
      className={`inline-flex rounded-lg border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
        styles[label] || "bg-slate-50 text-slate-600 border-slate-200"
      }`}
    >
      {label}
    </span>
  );
}

export function ProgressBar({ value }: { value: number | null | undefined }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100" aria-hidden>
      <div
        className="h-full rounded-full bg-indigo-500 transition-all duration-500"
        style={{ width: `${v}%` }}
      />
    </div>
  );
}

export function formatWhen(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDuration(seconds?: number | null) {
  if (seconds == null || seconds <= 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}
