import { AlertCircle, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  loading?: boolean;
  error?: boolean;
  empty?: boolean;
  emptyMessage?: string;
  onRetry?: () => void;
  children: ReactNode;
  className?: string;
  minHeight?: string;
};

export function WidgetSkeleton({ minHeight = "min-h-[180px]" }: { minHeight?: string }) {
  return (
    <div
      className={`${minHeight} animate-pulse rounded-2xl border border-slate-100 bg-slate-100`}
      aria-hidden
    />
  );
}

export default function WidgetShell({
  title,
  subtitle,
  action,
  loading,
  error,
  empty,
  emptyMessage = "Nothing here yet",
  onRetry,
  children,
  className = "",
  minHeight = "min-h-[180px]",
}: Props) {
  if (loading) return <WidgetSkeleton minHeight={minHeight} />;

  return (
    <section
      className={`rounded-2xl border border-slate-100 bg-white p-5 shadow-sm ${minHeight} ${className}`}
      aria-label={title}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm font-medium text-slate-600">{subtitle}</p>}
        </div>
        {action}
      </div>

      {error ? (
        <div className="flex flex-col items-start gap-3 py-4" role="alert">
          <div className="flex items-center gap-2 text-sm text-rose-600">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Couldn’t load this section
          </div>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </button>
          )}
        </div>
      ) : empty ? (
        <p className="py-6 text-center text-sm text-slate-400">{emptyMessage}</p>
      ) : (
        children
      )}
    </section>
  );
}
