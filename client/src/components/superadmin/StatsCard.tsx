import React from "react";

type CardColor = "blue" | "violet" | "emerald" | "amber" | "rose" | "cyan" | "indigo" | "orange";

const BOLD_STYLES: Record<CardColor, { card: string; icon: string; ring: string }> = {
  blue: {
    card: "from-blue-500 via-blue-600 to-indigo-600 border-blue-400/30 shadow-blue-500/25",
    icon: "bg-white/20 text-white ring-white/30",
    ring: "hover:ring-blue-300",
  },
  violet: {
    card: "from-violet-500 via-purple-600 to-fuchsia-600 border-violet-400/30 shadow-violet-500/25",
    icon: "bg-white/20 text-white ring-white/30",
    ring: "hover:ring-violet-300",
  },
  emerald: {
    card: "from-emerald-500 via-green-600 to-teal-600 border-emerald-400/30 shadow-emerald-500/25",
    icon: "bg-white/20 text-white ring-white/30",
    ring: "hover:ring-emerald-300",
  },
  amber: {
    card: "from-amber-400 via-orange-500 to-amber-600 border-amber-300/30 shadow-amber-500/25",
    icon: "bg-white/20 text-white ring-white/30",
    ring: "hover:ring-amber-300",
  },
  rose: {
    card: "from-rose-500 via-pink-600 to-red-600 border-rose-400/30 shadow-rose-500/25",
    icon: "bg-white/20 text-white ring-white/30",
    ring: "hover:ring-rose-300",
  },
  cyan: {
    card: "from-cyan-400 via-sky-500 to-blue-500 border-cyan-300/30 shadow-cyan-500/25",
    icon: "bg-white/20 text-white ring-white/30",
    ring: "hover:ring-cyan-300",
  },
  indigo: {
    card: "from-indigo-500 via-indigo-600 to-violet-700 border-indigo-400/30 shadow-indigo-500/25",
    icon: "bg-white/20 text-white ring-white/30",
    ring: "hover:ring-indigo-300",
  },
  orange: {
    card: "from-orange-500 via-amber-500 to-yellow-500 border-orange-400/30 shadow-orange-500/25",
    icon: "bg-white/20 text-white ring-white/30",
    ring: "hover:ring-orange-300",
  },
};

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  color?: CardColor;
  compact?: boolean;
  loading?: boolean;
  onClick?: () => void;
}

export default function StatsCard({
  title,
  value,
  subtitle,
  icon,
  color = "blue",
  compact = false,
  loading = false,
  onClick,
}: StatsCardProps) {
  const s = BOLD_STYLES[color];

  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      className={`
        relative overflow-hidden rounded-xl border bg-gradient-to-br text-white shadow-lg
        ${s.card}
        ${compact ? "p-3" : "p-4"}
        ${onClick ? `cursor-pointer hover:shadow-xl hover:ring-2 ${s.ring} hover:scale-[1.02] transition-all duration-200` : ""}
      `}
    >
      <div className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-white/10 blur-xl pointer-events-none" />
      <div className={`relative flex items-start justify-between gap-2 ${compact ? "min-h-[4.5rem]" : "min-h-[5.5rem]"}`}>
        <div className="flex-1 min-w-0">
          <p className={`font-medium text-white/85 truncate ${compact ? "text-[10px] sm:text-xs" : "text-xs"}`}>{title}</p>
          {loading ? (
            <div className={`bg-white/25 rounded animate-pulse ${compact ? "mt-1.5 h-6 w-12" : "mt-2 h-8 w-16"}`} />
          ) : (
            <p className={`font-bold tracking-tight tabular-nums ${compact ? "mt-0.5 text-xl sm:text-2xl" : "mt-1 text-2xl sm:text-3xl"}`}>
              {value}
            </p>
          )}
          {subtitle && !loading && (
            <p className={`text-white/70 truncate ${compact ? "mt-0.5 text-[9px] sm:text-[10px]" : "mt-1 text-[10px] sm:text-xs"}`}>
              {subtitle}
            </p>
          )}
        </div>
        {icon && (
          <div className={`flex shrink-0 items-center justify-center rounded-lg ring-1 ${s.icon} ${compact ? "h-8 w-8 sm:h-9 sm:w-9" : "h-10 w-10"}`}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
