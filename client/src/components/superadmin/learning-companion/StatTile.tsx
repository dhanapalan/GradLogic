import { type LucideIcon } from "lucide-react";

interface StatTileProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  accent?: "navy" | "blue" | "green" | "purple" | "amber" | "rose" | "slate";
  /** Shown instead of a numeric badge when this metric has no backing data yet. */
  unavailable?: boolean;
  onClick?: () => void;
}

const ACCENTS: Record<NonNullable<StatTileProps["accent"]>, string> = {
  navy: "bg-navy-900/[0.06] text-navy-900",
  blue: "bg-blue-50 text-blue-700",
  green: "bg-green-50 text-green-700",
  purple: "bg-purple-50 text-purple-700",
  amber: "bg-amber-50 text-amber-700",
  rose: "bg-rose-50 text-rose-700",
  slate: "bg-slate-100 text-slate-600",
};

export default function StatTile({
  label,
  value,
  icon: Icon,
  accent = "navy",
  unavailable = false,
  onClick,
}: StatTileProps) {
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      onClick={onClick}
      className={`bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-5 flex items-center gap-4 text-left w-full ${
        onClick ? "hover:border-admin-accent/40 hover:shadow-md transition-all cursor-pointer" : ""
      }`}
    >
      <div className={`shrink-0 rounded-lg p-3 ${ACCENTS[accent]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-display font-semibold text-gray-900 leading-none">
          {unavailable ? "—" : value}
        </p>
        <p className="text-sm text-gray-500 mt-1.5 truncate">{label}</p>
        {unavailable && <p className="text-[11px] text-gray-400 mt-0.5">Not yet available</p>}
      </div>
    </Wrapper>
  );
}
