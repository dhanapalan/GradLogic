import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Loader2, Sparkles } from "lucide-react";
import type { LiCard } from "../../../../services/studentAiCoachService";

export function LoadingBlock({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex h-36 items-center justify-center rounded-2xl border border-slate-100 bg-white" role="status">
      <Loader2 className="h-6 w-6 animate-spin text-indigo-500" aria-label={label} />
    </div>
  );
}

export function EmptyBlock({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-8 text-center">
      <Sparkles className="mx-auto mb-2 h-7 w-7 text-slate-300" aria-hidden />
      <p className="text-sm font-bold text-slate-500">{title}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-700" role="alert">
      <div className="flex gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="font-bold">Something went wrong</p>
          <p className="mt-0.5 text-rose-600/90">{message}</p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-2 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-rose-700 ring-1 ring-rose-200"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function CoachCard({
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

export function PriorityBadge({ label }: { label: string }) {
  const styles: Record<string, string> = {
    High: "bg-rose-50 text-rose-700 border-rose-100",
    Medium: "bg-amber-50 text-amber-800 border-amber-100",
    Low: "bg-slate-50 text-slate-600 border-slate-200",
    Excellent: "bg-emerald-50 text-emerald-700 border-emerald-100",
    Good: "bg-sky-50 text-sky-700 border-sky-100",
    Average: "bg-amber-50 text-amber-800 border-amber-100",
    "Needs Improvement": "bg-rose-50 text-rose-700 border-rose-100",
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

export function RecommendationCard({ card }: { card: LiCard }) {
  const li = card.learning_intelligence;
  return (
    <Link
      to={card.href}
      className="block rounded-xl border border-slate-100 bg-slate-50/50 p-3 transition hover:border-indigo-100 hover:bg-indigo-50/40"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-bold text-slate-900">{card.title}</p>
        <PriorityBadge label={card.priority} />
      </div>
      {card.description && (
        <p className="mt-1 line-clamp-2 text-[11px] text-slate-500">{card.description}</p>
      )}
      <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        {[li.skill, li.difficulty, li.estimated_learning_time_minutes != null ? `~${li.estimated_learning_time_minutes}m` : null]
          .filter(Boolean)
          .join(" · ") || card.kind.replace(/_/g, " ")}
      </p>
    </Link>
  );
}

/** Lightweight markdown: paragraphs + fenced code blocks (no extra deps). */
export function CoachMarkdown({ text }: { text: string }) {
  const parts = text.split(/(```[\s\S]*?```)/g);
  return (
    <div className="space-y-2 text-sm leading-relaxed text-slate-800">
      {parts.map((part, i) => {
        if (part.startsWith("```")) {
          const body = part.replace(/^```\w*\n?/, "").replace(/```$/, "");
          return (
            <pre
              key={i}
              className="overflow-x-auto rounded-xl bg-slate-900 p-3 text-xs text-slate-100"
            >
              <code>{body}</code>
            </pre>
          );
        }
        return (
          <p key={i} className="whitespace-pre-wrap">
            {part}
          </p>
        );
      })}
    </div>
  );
}
