import React from "react";

type CardColor = "blue" | "violet" | "emerald" | "amber" | "rose" | "cyan" | "indigo" | "orange";

const ACCENT: Record<CardColor, { icon: string; bar: string }> = {
  blue: { icon: "bg-blue-50 text-blue-600", bar: "bg-blue-500" },
  violet: { icon: "bg-violet-50 text-violet-600", bar: "bg-violet-500" },
  emerald: { icon: "bg-emerald-50 text-emerald-600", bar: "bg-emerald-500" },
  amber: { icon: "bg-amber-50 text-amber-600", bar: "bg-amber-500" },
  rose: { icon: "bg-rose-50 text-rose-600", bar: "bg-rose-500" },
  cyan: { icon: "bg-cyan-50 text-cyan-600", bar: "bg-cyan-500" },
  indigo: { icon: "bg-indigo-50 text-indigo-600", bar: "bg-indigo-500" },
  orange: { icon: "bg-orange-50 text-orange-600", bar: "bg-orange-500" },
};

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  color?: CardColor;
  loading?: boolean;
  onClick?: () => void;
}

export default function StatsCard({
  title,
  value,
  subtitle,
  icon,
  color = "blue",
  loading = false,
  onClick,
}: StatsCardProps) {
  const a = ACCENT[color];

  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      className={`
        relative bg-white rounded-lg border border-gray-200 p-4 shadow-sm
        ${onClick ? "cursor-pointer hover:border-gray-300 hover:shadow transition-all" : ""}
      `}
    >
      <div className={`absolute left-0 top-3 bottom-3 w-0.5 rounded-full ${a.bar}`} />
      <div className="flex items-start justify-between gap-3 pl-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-gray-500 truncate">{title}</p>
          {loading ? (
            <div className="mt-2 h-7 w-16 bg-gray-100 rounded animate-pulse" />
          ) : (
            <p className="mt-1 text-2xl font-semibold text-gray-900 tabular-nums tracking-tight">{value}</p>
          )}
          {subtitle && !loading && (
            <p className="mt-0.5 text-xs text-gray-400 truncate">{subtitle}</p>
          )}
        </div>
        {icon && (
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${a.icon}`}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
