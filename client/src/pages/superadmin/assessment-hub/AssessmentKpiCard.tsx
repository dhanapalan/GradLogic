import { type LucideIcon, TrendingDown, TrendingUp, Minus } from "lucide-react";
import type { KpiTrend } from "../../../services/assessmentHubService";

interface AssessmentKpiCardProps {
  label: string;
  value: number | string | null;
  icon: LucideIcon;
  accent?: "navy" | "blue" | "green" | "purple" | "amber" | "rose" | "slate";
  trend?: KpiTrend | null;
  lastUpdated?: string | null;
  unavailable?: boolean;
  onClick?: () => void;
}

const ACCENTS: Record<NonNullable<AssessmentKpiCardProps["accent"]>, string> = {
  navy: "bg-navy-900/[0.06] text-navy-900",
  blue: "bg-blue-50 text-blue-700",
  green: "bg-green-50 text-green-700",
  purple: "bg-purple-50 text-purple-700",
  amber: "bg-amber-50 text-amber-700",
  rose: "bg-rose-50 text-rose-700",
  slate: "bg-slate-100 text-slate-600",
};

function formatRelative(iso: string | null | undefined) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  const diffSec = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (diffSec < 60) return "Updated just now";
  if (diffSec < 3600) return `Updated ${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `Updated ${Math.floor(diffSec / 3600)}h ago`;
  return `Updated ${new Date(iso).toLocaleDateString()}`;
}

export default function AssessmentKpiCard({
  label,
  value,
  icon: Icon,
  accent = "navy",
  trend,
  lastUpdated,
  unavailable = false,
  onClick,
}: AssessmentKpiCardProps) {
  const Wrapper = onClick ? "button" : "div";
  const display =
    unavailable || value == null || value === ""
      ? "—"
      : typeof value === "number"
        ? Number.isInteger(value)
          ? value.toLocaleString()
          : value.toLocaleString(undefined, { maximumFractionDigits: 1 })
        : value;

  const TrendIcon =
    trend?.direction === "up"
      ? TrendingUp
      : trend?.direction === "down"
        ? TrendingDown
        : Minus;

  const trendColor =
    trend?.direction === "up"
      ? "text-emerald-600 bg-emerald-50"
      : trend?.direction === "down"
        ? "text-rose-600 bg-rose-50"
        : "text-gray-500 bg-gray-50";

  return (
    <Wrapper
      onClick={onClick}
      className={`bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-5 flex flex-col gap-3 text-left w-full ${
        onClick
          ? "hover:border-admin-accent/40 hover:shadow-md transition-all cursor-pointer"
          : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className={`shrink-0 rounded-lg p-3 ${ACCENTS[accent]}`}>
          <Icon className="w-5 h-5" />
        </div>
        {trend ? (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${trendColor}`}
            title={trend.label}
          >
            <TrendIcon className="w-3 h-3" />
            {trend.percent != null ? `${trend.percent}%` : "—"}
          </span>
        ) : null}
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-display font-semibold text-gray-900 leading-none">
          {display}
        </p>
        <p className="text-sm text-gray-500 mt-1.5 truncate">{label}</p>
        {unavailable ? (
          <p className="text-[11px] text-gray-400 mt-0.5">Not yet available</p>
        ) : (
          <p className="text-[11px] text-gray-400 mt-0.5">
            {formatRelative(lastUpdated) || "Live"}
          </p>
        )}
      </div>
    </Wrapper>
  );
}
