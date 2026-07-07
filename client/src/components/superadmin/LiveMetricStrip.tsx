import {
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
} from "@heroicons/react/24/outline";
import { LiveDayStats } from "../../services/superadminMetrics";

interface LiveMetricStripProps {
  today: LiveDayStats;
  yesterday: LiveDayStats;
  activeNow: number;
  examsInProgress?: number;
  loading?: boolean;
}

function delta(today: number, yesterday: number): { value: number; up: boolean } | null {
  if (today === 0 && yesterday === 0) return null;
  if (yesterday === 0) return { value: 100, up: today > 0 };
  const pct = Math.round(((today - yesterday) / yesterday) * 100);
  return { value: Math.abs(pct), up: pct >= 0 };
}

const TODAY_METRICS = [
  { key: "newStudents" as const, label: "Students" },
  { key: "newColleges" as const, label: "Colleges" },
  { key: "examAttempts" as const, label: "Exams" },
  { key: "completedExams" as const, label: "Completed" },
  { key: "logins" as const, label: "Logins" },
];

export default function LiveMetricStrip({ today, yesterday, activeNow, examsInProgress = 0, loading }: LiveMetricStripProps) {
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-3">
      {TODAY_METRICS.map(({ key, label }) => {
        const value = today[key];
        const d = delta(value, yesterday[key]);
        return (
          <div key={key} className="min-w-[4.5rem]">
            <p className="text-[11px] font-medium text-gray-500">{label}</p>
            {loading ? (
              <div className="mt-1 h-6 w-8 bg-gray-100 rounded animate-pulse" />
            ) : (
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-lg font-semibold text-gray-900 tabular-nums">{value}</span>
                {d && (
                  <span className={`inline-flex items-center text-[10px] font-medium ${d.up ? "text-emerald-600" : "text-rose-500"}`}>
                    {d.up ? <ArrowTrendingUpIcon className="w-3 h-3" /> : <ArrowTrendingDownIcon className="w-3 h-3" />}
                    {d.value}%
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}
      <div className="min-w-[4.5rem]">
        <p className="text-[11px] font-medium text-gray-500">Active now</p>
        {loading ? (
          <div className="mt-1 h-6 w-8 bg-gray-100 rounded animate-pulse" />
        ) : (
          <p className="mt-0.5 text-lg font-semibold text-gray-900 tabular-nums">{activeNow}</p>
        )}
      </div>
      <div className="min-w-[4.5rem]">
        <p className="text-[11px] font-medium text-gray-500">In exam</p>
        {loading ? (
          <div className="mt-1 h-6 w-8 bg-gray-100 rounded animate-pulse" />
        ) : (
          <p className={`mt-0.5 text-lg font-semibold tabular-nums ${examsInProgress > 0 ? "text-violet-600" : "text-gray-900"}`}>
            {examsInProgress}
          </p>
        )}
      </div>
    </div>
  );
}
