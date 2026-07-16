import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

export function PageHeader({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-navy-900/[0.06] rounded-lg">
          <Icon className="w-5 h-5 text-navy-900" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
          {description ? <p className="text-sm text-gray-500 mt-0.5">{description}</p> : null}
        </div>
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ message, ctaHref, ctaLabel }: { message: string; ctaHref?: string; ctaLabel?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-200 bg-white px-6 py-12 text-center">
      <p className="text-sm text-gray-500">{message}</p>
      {ctaHref && ctaLabel ? (
        <Link
          to={ctaHref}
          className="inline-flex mt-4 text-sm font-medium text-admin-accent hover:underline"
        >
          {ctaLabel}
        </Link>
      ) : null}
    </div>
  );
}

export function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-gray-200/70 bg-white p-4 shadow-admin-card">
      <p className="text-xs uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
    </div>
  );
}
