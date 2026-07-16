import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";
import { useStudentMobilePrefs } from "../../../../hooks/useStudentMobilePrefs";

function useIsNarrow() {
  const [narrow, setNarrow] = useState(
    typeof window !== "undefined" ? window.matchMedia("(max-width: 639px)").matches : false
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const on = () => setNarrow(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return narrow;
}

/** Defer mounting heavy Recharts until visible when low-bandwidth is on. */
function LazyChart({ children, height }: { children: ReactNode; height: number }) {
  const { lowBandwidth } = useStudentMobilePrefs();
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(!lowBandwidth);

  useEffect(() => {
    if (!lowBandwidth || visible) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "80px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [lowBandwidth, visible]);

  return (
    <div ref={ref} style={{ height }} className="w-full">
      {visible ? (
        children
      ) : (
        <div className="flex h-full items-center justify-center rounded-xl bg-slate-50 text-xs text-slate-500">
          Scroll to load chart (low bandwidth)
        </div>
      )}
    </div>
  );
}

export function SkillRadar({
  data,
}: {
  data: Array<{ skill: string; percentage: number }>;
}) {
  const narrow = useIsNarrow();
  if (!data.length) return null;
  const chartData = data.map((d) => ({
    ...d,
    skill: narrow && d.skill.length > 10 ? `${d.skill.slice(0, 9)}…` : d.skill,
  }));
  const height = narrow ? 220 : 256;
  return (
    <LazyChart height={height}>
      <div className="h-full w-full" role="img" aria-label="Skill radar chart">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={chartData}>
            <PolarGrid stroke="#e2e8f0" />
            <PolarAngleAxis dataKey="skill" tick={{ fontSize: narrow ? 9 : 11, fill: "#64748b" }} />
            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
            <Radar
              name="Score"
              dataKey="percentage"
              stroke="#4f46e5"
              fill="#6366f1"
              fillOpacity={0.35}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </LazyChart>
  );
}

export function ScoreTrendChart({
  data,
}: {
  data: Array<{ date: string | null; assessment: string; percentage: number }>;
}) {
  const narrow = useIsNarrow();
  if (!data.length) return null;
  const chartData = data.map((d, i) => ({
    name: (d.assessment || `A${i + 1}`).slice(0, narrow ? 8 : 12),
    percentage: d.percentage,
  }));
  const height = narrow ? 200 : 224;
  return (
    <LazyChart height={height}>
      <div className="h-full w-full" role="img" aria-label="Score trend chart">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#94a3b8" }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#94a3b8" }} />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="percentage"
              stroke="#4f46e5"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </LazyChart>
  );
}

export function DifficultyBars({
  data,
}: {
  data: Array<{ difficulty: string; accuracy: number | null; questions: number }>;
}) {
  const narrow = useIsNarrow();
  const chartData = data
    .filter((d) => d.questions > 0)
    .map((d) => ({ name: d.difficulty, accuracy: d.accuracy ?? 0 }));
  if (!chartData.length) return null;
  const height = narrow ? 180 : 208;
  return (
    <LazyChart height={height}>
      <div className="h-full w-full" role="img" aria-label="Difficulty distribution chart">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#94a3b8" }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#94a3b8" }} />
            <Tooltip />
            <Bar dataKey="accuracy" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </LazyChart>
  );
}
