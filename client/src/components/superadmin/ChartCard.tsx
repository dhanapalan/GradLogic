import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface ChartData {
  label: string;
  value: number;
}

type ChartColor = "blue" | "violet" | "emerald" | "cyan" | "indigo";

const CHART_COLORS: Record<ChartColor, { stroke: string; fill: string; bar: string }> = {
  blue: { stroke: "#3b82f6", fill: "#93c5fd", bar: "#3b82f6" },
  violet: { stroke: "#8b5cf6", fill: "#c4b5fd", bar: "#8b5cf6" },
  emerald: { stroke: "#10b981", fill: "#6ee7b7", bar: "#10b981" },
  cyan: { stroke: "#06b6d4", fill: "#67e8f9", bar: "#06b6d4" },
  indigo: { stroke: "#6366f1", fill: "#a5b4fc", bar: "#6366f1" },
};

interface ChartCardProps {
  title: string;
  subtitle?: string;
  data: ChartData[];
  variant?: "area" | "bar";
  color?: ChartColor;
  loading?: boolean;
  compact?: boolean;
}

const CHART_HEADER: Record<ChartColor, string> = {
  blue: "from-blue-500/10 to-white border-blue-100",
  violet: "from-violet-500/10 to-white border-violet-100",
  emerald: "from-emerald-500/10 to-white border-emerald-100",
  cyan: "from-cyan-500/10 to-white border-cyan-100",
  indigo: "from-indigo-500/10 to-white border-indigo-100",
};

function EmptyChart({ title, subtitle, compact }: { title: string; subtitle?: string; compact?: boolean }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm h-full ${compact ? "p-3" : "p-6"}`}>
      <p className={`font-semibold text-gray-900 ${compact ? "text-xs" : "text-sm"}`}>{title}</p>
      {subtitle && <p className="text-[10px] text-gray-500">{subtitle}</p>}
      <div className={`flex flex-col items-center justify-center rounded-lg bg-gray-50 text-center ${compact ? "mt-2 h-24" : "mt-6 h-48"}`}>
        <p className="text-xs text-gray-500">No data yet</p>
      </div>
    </div>
  );
}

export default function ChartCard({
  title,
  subtitle,
  data,
  variant = "area",
  color = "blue",
  loading = false,
  compact = false,
}: ChartCardProps) {
  const palette = CHART_COLORS[color];
  const chartData = data.map((d) => ({ name: d.label, value: d.value }));
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const chartH = compact ? "h-24 sm:h-28" : "h-48";
  const pad = compact ? "p-3" : "p-6";

  if (loading) {
    return (
      <div className={`bg-white rounded-xl border border-gray-200 ${pad} shadow-sm h-full`}>
        <div className="h-3 w-28 bg-gray-200 rounded animate-pulse mb-2" />
        <div className={`${chartH} bg-gray-100 rounded-lg animate-pulse`} />
      </div>
    );
  }

  if (data.length === 0) {
    return <EmptyChart title={title} subtitle={subtitle} compact={compact} />;
  }

  return (
    <div className={`bg-gradient-to-b ${CHART_HEADER[color]} rounded-xl border ${pad} shadow-sm h-full flex flex-col`}>
      <div className={`flex items-start justify-between ${compact ? "mb-2" : "mb-4"}`}>
        <div className="min-w-0">
          <p className={`font-semibold text-gray-900 truncate ${compact ? "text-xs" : "text-sm"}`}>{title}</p>
          {subtitle && <p className="text-[10px] text-gray-500 truncate">{subtitle}</p>}
        </div>
        <span className="text-sm font-bold tabular-nums shrink-0 ml-2" style={{ color: palette.stroke }}>
          {total}
        </span>
      </div>

      <div className={`${chartH} flex-1 min-h-0`}>
        <ResponsiveContainer width="100%" height="100%">
          {variant === "bar" ? (
            <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                  fontSize: "12px",
                }}
              />
              <Bar dataKey="value" fill={palette.bar} radius={[4, 4, 0, 0]} maxBarSize={32} />
            </BarChart>
          ) : (
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id={`grad-${color}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={palette.stroke} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={palette.stroke} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                  fontSize: "12px",
                }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={palette.stroke}
                strokeWidth={2}
                fill={`url(#grad-${color})`}
              />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
