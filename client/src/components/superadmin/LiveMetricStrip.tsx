import {
  AcademicCapIcon,
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
  BuildingOffice2Icon,
  CheckBadgeIcon,
  ClipboardDocumentCheckIcon,
  UserGroupIcon,
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

const METRICS = [
  { key: "newStudents" as const, label: "Students", grad: "from-emerald-400 to-teal-500", icon: UserGroupIcon },
  { key: "newColleges" as const, label: "Colleges", grad: "from-blue-400 to-indigo-500", icon: BuildingOffice2Icon },
  { key: "examAttempts" as const, label: "Exams", grad: "from-violet-400 to-purple-600", icon: ClipboardDocumentCheckIcon },
  { key: "completedExams" as const, label: "Done", grad: "from-cyan-400 to-sky-500", icon: CheckBadgeIcon },
  { key: "logins" as const, label: "Logins", grad: "from-amber-400 to-orange-500", icon: AcademicCapIcon },
];

export default function LiveMetricStrip({ today, yesterday, activeNow, examsInProgress = 0, loading }: LiveMetricStripProps) {
  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto pb-1 snap-x snap-mandatory scrollbar-thin sm:grid sm:grid-cols-3 lg:grid-cols-7 sm:overflow-visible sm:mx-0">
      {METRICS.map(({ key, label, grad, icon: Icon }) => {
        const value = today[key];
        const d = delta(value, yesterday[key]);
        return (
          <div
            key={key}
            className={`snap-start shrink-0 w-[7.5rem] sm:w-auto rounded-lg bg-gradient-to-br ${grad} px-3 py-2 shadow-md border border-white/20`}
          >
            <div className="flex items-center gap-1.5 mb-0.5">
              <Icon className="w-3.5 h-3.5 text-white/90 shrink-0" />
              <p className="text-[10px] font-semibold text-white/90 truncate">{label}</p>
            </div>
            {loading ? (
              <div className="h-6 w-10 bg-white/25 rounded animate-pulse" />
            ) : (
              <>
                <p className="text-lg font-bold text-white tabular-nums leading-tight">{value}</p>
                {d && (
                  <p className={`flex items-center gap-0.5 text-[9px] font-semibold ${d.up ? "text-emerald-100" : "text-rose-100"}`}>
                    {d.up ? <ArrowTrendingUpIcon className="w-2.5 h-2.5" /> : <ArrowTrendingDownIcon className="w-2.5 h-2.5" />}
                    {d.value}%
                  </p>
                )}
              </>
            )}
          </div>
        );
      })}

      <div className="snap-start shrink-0 w-[7.5rem] sm:w-auto rounded-lg bg-gradient-to-br from-green-400 to-emerald-600 px-3 py-2 shadow-md border border-white/20">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute animate-ping rounded-full h-2 w-2 bg-white opacity-75" />
            <span className="relative rounded-full h-2 w-2 bg-white" />
          </span>
          <p className="text-[10px] font-semibold text-white/90">Live</p>
        </div>
        {loading ? <div className="h-6 w-10 bg-white/25 rounded animate-pulse" /> : (
          <p className="text-lg font-bold text-white tabular-nums">{activeNow}</p>
        )}
      </div>

      <div className={`snap-start shrink-0 w-[7.5rem] sm:w-auto rounded-lg bg-gradient-to-br px-3 py-2 shadow-md border border-white/20 ${examsInProgress > 0 ? "from-fuchsia-500 to-violet-600 animate-pulse" : "from-slate-500 to-slate-600"}`}>
        <div className="flex items-center gap-1.5 mb-0.5">
          <ClipboardDocumentCheckIcon className="w-3.5 h-3.5 text-white/90" />
          <p className="text-[10px] font-semibold text-white/90">In Exam</p>
        </div>
        {loading ? <div className="h-6 w-10 bg-white/25 rounded animate-pulse" /> : (
          <p className="text-lg font-bold text-white tabular-nums">{examsInProgress}</p>
        )}
      </div>
    </div>
  );
}
