import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Zap,
  CheckCircle2,
  TrendingUp,
  Target,
  BookOpenCheck,
  Dumbbell,
  ClipboardCheck,
  Library,
  ArrowRight,
  Play,
  Sparkles,
} from "lucide-react";
import { useAuthStore } from "../../../stores/authStore";
import api from "../../../lib/api";
import DailyTargetCard from "../DailyTargetCard";
import CurrentStageCard from "../CurrentStageCard";
import ReadinessCard from "../ReadinessCard";
import StreakHeatmapCard from "../StreakHeatmapCard";
import WeeklyGoalCard from "../WeeklyGoalCard";
import { useGamificationSummary } from "../../../hooks/useGamificationSummary";

const BASE = "/app/student-portal";

interface Drive {
  drive_id: string;
  drive_name: string;
  duration_minutes: number;
  total_questions: number;
  scheduled_start: string | null;
  session_status: string;
  score: number | null;
}

export default function StudentDashboardPage() {
  const user = useAuthStore((s) => s.user);
  const { profile: gamification, myRank, totalParticipants } = useGamificationSummary();

  const { data: drives = [], isLoading } = useQuery({
    queryKey: ["student-drives"],
    queryFn: async () => (await api.get("/exam-sessions/my-drives")).data.data as Drive[],
    enabled: !!user?.id,
    staleTime: 30_000,
  });

  const activeDrives = drives.filter((d) =>
    ["assigned", "registered", "in_progress"].includes(d.session_status)
  );
  const completedDrives = drives.filter((d) => d.session_status === "completed");
  const avgScore =
    completedDrives.length > 0
      ? Math.round(
          completedDrives.reduce((a, d) => a + (Number(d.score) || 0), 0) / completedDrives.length
        )
      : 0;

  const kpis = [
    { label: "Active Exams", value: activeDrives.length, icon: Zap, tint: "bg-indigo-50 text-indigo-500 border-indigo-100" },
    { label: "Completed", value: completedDrives.length, icon: CheckCircle2, tint: "bg-emerald-50 text-emerald-500 border-emerald-100" },
    { label: "Avg Score", value: completedDrives.length ? `${avgScore}` : "—", icon: TrendingUp, tint: "bg-amber-50 text-amber-500 border-amber-100" },
    { label: "Streak Goal", value: <DailyTargetInline />, icon: Target, tint: "bg-violet-50 text-violet-500 border-violet-100", raw: true },
  ];

  const quickLinks = [
    { name: "Learn", href: `${BASE}/learn`, icon: BookOpenCheck, desc: "Concept tracks & programs" },
    { name: "Practice", href: `${BASE}/practice`, icon: Dumbbell, desc: "Topic-wise practice sets" },
    { name: "Tests & Mocks", href: `${BASE}/tests`, icon: ClipboardCheck, desc: "Drives & full-length mocks" },
    { name: "Question Bank", href: `${BASE}/question-bank`, icon: Library, desc: "Browse by topic" },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500">
      {/* Greeting */}
      <div className="flex items-center justify-between bg-white rounded-2xl px-6 py-4 border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
            <span className="text-lg font-black">{user?.name?.[0]?.toUpperCase() ?? "S"}</span>
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900 tracking-tight leading-tight">
              Welcome, <span className="text-indigo-600">{user?.name?.split(" ")[0]}</span>
            </h1>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              {gamification?.streak.current_streak
                ? `You're on a ${gamification.streak.current_streak}-day streak. Keep the momentum going!`
                : activeDrives.length > 0
                  ? `${activeDrives.length} active exam${activeDrives.length !== 1 ? "s" : ""} · ${completedDrives.length} completed`
                  : `No active exams · ${completedDrives.length} completed`}
            </p>
          </div>
        </div>
        {myRank != null && totalParticipants != null && (
          <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-100 px-3 py-1.5 text-xs font-bold text-amber-600">
            <Sparkles className="h-3.5 w-3.5" /> Rank #{myRank} of {totalParticipants}
          </span>
        )}
      </div>

      {/* Readiness + streak + weekly goal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ReadinessCard />
        <StreakHeatmapCard />
        <WeeklyGoalCard />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
            <div className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border ${k.tint}`}>
              <k.icon className="h-4.5 w-4.5" />
            </div>
            {k.raw ? (
              <div className="mt-3">{k.value}</div>
            ) : (
              <p className="mt-3 text-2xl font-black text-slate-900 leading-none">{k.value}</p>
            )}
            {!k.raw && (
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">{k.label}</p>
            )}
          </div>
        ))}
      </div>

      {/* Daily target + current workflow stage */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DailyTargetCard />
        <CurrentStageCard />
      </div>

      {/* Upcoming exams + quick links */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Upcoming Exams</h3>
            <Link to={`${BASE}/tests`} className="text-xs font-bold text-indigo-500 hover:text-indigo-700 flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="divide-y divide-slate-50">
            {isLoading ? (
              <div className="p-6"><div className="h-16 animate-pulse rounded-xl bg-slate-50" /></div>
            ) : activeDrives.length > 0 ? (
              activeDrives.slice(0, 4).map((d) => (
                <Link
                  key={d.drive_id}
                  to={`${BASE}/tests`}
                  className="flex items-center justify-between px-6 py-4 hover:bg-slate-50/60 transition-colors group"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-500 border border-indigo-100 group-hover:bg-indigo-500 group-hover:text-white transition-all">
                      <BookOpenCheck className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{d.drive_name}</p>
                      <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                        {d.duration_minutes}min · {d.total_questions} questions
                      </p>
                    </div>
                  </div>
                  <Play className="h-4 w-4 text-slate-300 group-hover:text-indigo-500" />
                </Link>
              ))
            ) : (
              <div className="p-10 text-center">
                <CheckCircle2 className="h-8 w-8 text-slate-200 mx-auto mb-3" />
                <p className="text-sm font-bold text-slate-400">No upcoming exams</p>
                <p className="text-xs text-slate-300 mt-1">You're all caught up!</p>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider mb-3">Jump back in</h3>
          <div className="space-y-2">
            {quickLinks.map((q) => (
              <Link
                key={q.href}
                to={q.href}
                className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:border-indigo-100 hover:bg-indigo-50/40"
              >
                <span className="flex items-center gap-2.5">
                  <q.icon className="h-4 w-4 text-indigo-500" />
                  <span>
                    {q.name}
                    <span className="block text-[11px] font-medium text-slate-400">{q.desc}</span>
                  </span>
                </span>
                <ArrowRight className="h-4 w-4 text-slate-300" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Compact daily-target value used inside the KPI tile. */
function DailyTargetInline() {
  const { data } = useQuery({
    queryKey: ["student-daily-target"],
    queryFn: async () => (await api.get("/practice/daily-target")).data.data,
    staleTime: 30_000,
  });
  if (!data) return <p className="text-2xl font-black text-slate-900 leading-none">—</p>;
  return (
    <>
      <p className="text-2xl font-black text-slate-900 leading-none">
        {data.completed_today}/{data.target}
      </p>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Daily Target</p>
    </>
  );
}
