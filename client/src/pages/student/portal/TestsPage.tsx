import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  ClipboardCheck,
  Clock,
  FileText,
  Calendar,
  Play,
  RotateCcw,
  Trophy,
  Gamepad2,
  Target,
  Sparkles,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuthStore } from "../../../stores/authStore";
import api from "../../../lib/api";
import { practiceTopicLabel } from "../../../services/studentPracticeService";

const BASE = "/app/student-portal";

interface Drive {
  drive_id: string;
  drive_name: string;
  drive_type?: string;
  rule_name?: string;
  duration_minutes: number;
  total_questions: number;
  total_marks?: number;
  scheduled_start: string | null;
  scheduled_end: string | null;
  session_status: string;
  score: number | null;
  completed_at?: string | null;
}

interface SelfServiceDrive {
  drive_id: string;
  drive_name: string;
  drive_type: string;
  duration_minutes: number;
  total_questions: number;
  phase1_domain?: string | null;
  bank_category?: string | null;
  placement_domain?: string | null;
}

type Tab = "upcoming" | "past" | "mocks";

export default function TestsPage() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("upcoming");
  const [enrollingId, setEnrollingId] = useState<string | null>(null);

  const { data: drives = [], isLoading } = useQuery({
    queryKey: ["student-drives"],
    queryFn: async () => (await api.get("/exam-sessions/my-drives")).data.data as Drive[],
    enabled: !!user?.id,
    staleTime: 30_000,
  });

  const { data: availableMocks = [], isLoading: loadingMocks } = useQuery({
    queryKey: ["student-available-mocks"],
    queryFn: async () => (await api.get("/exam-sessions/available-mocks")).data.data as SelfServiceDrive[],
    enabled: !!user?.id && tab === "mocks",
  });

  const enrollMutation = useMutation({
    mutationFn: async (driveId: string) => {
      setEnrollingId(driveId);
      await api.post(`/exam-sessions/${driveId}/enroll`);
      return driveId;
    },
    onSuccess: (driveId) => {
      queryClient.invalidateQueries({ queryKey: ["student-drives"] });
      queryClient.invalidateQueries({ queryKey: ["student-available-mocks"] });
      navigate(`${BASE}/exam/${driveId}/instructions`);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Failed to start test");
    },
    onSettled: () => setEnrollingId(null),
  });

  const upcoming = drives.filter((d) =>
    ["assigned", "registered", "in_progress"].includes(d.session_status) && d.drive_type !== "mock_test" && d.drive_type !== "practice_test"
  );
  const past = drives.filter((d) => d.session_status === "completed");
  const mockPast = past.filter((d) => d.drive_type === "mock_test");
  const availableMockOnly = availableMocks.filter((m) => m.drive_type === "mock_test");
  const inProgressMocks = drives.filter(
    (d) => d.drive_type === "mock_test" && d.session_status === "in_progress"
  );

  const avgPct =
    past.length > 0
      ? Math.round(past.reduce((a, d) => a + (Number(d.score) || 0), 0) / past.length)
      : 0;

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "upcoming", label: "Upcoming & Live", count: upcoming.length },
    { key: "past", label: "Past Attempts", count: past.length },
    { key: "mocks", label: "Mock Tests", count: availableMockOnly.length + inProgressMocks.length },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <ClipboardCheck className="h-4 w-4" /> Tests &amp; Mocks
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">Tests &amp; Mocks</h1>
        <p className="text-sm text-slate-500 mt-1">
          Full-length placement mocks with timer &amp; auto-submit — scores feed Placement Readiness.
        </p>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-4">
        <Stat label="Upcoming" value={upcoming.length} tint="text-indigo-600" />
        <Stat label="Completed" value={past.length} tint="text-emerald-600" />
        <Stat label="Avg Score" value={past.length ? `${avgPct}` : "—"} tint="text-amber-600" />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              tab === t.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
            }`}
          >
            {t.label}
            {t.count != null && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${tab === t.key ? "bg-indigo-100 text-indigo-600" : "bg-slate-200 text-slate-500"}`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-50 border border-slate-100" />)}
        </div>
      ) : tab === "upcoming" ? (
        upcoming.length === 0 ? (
          <Empty icon={ClipboardCheck} title="No upcoming exams" sub="Check back later or try a mock below." />
        ) : (
          <div className="space-y-4">
            {upcoming.map((d) => (
              <div key={d.drive_id} className="group bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-lg hover:border-indigo-100 transition-all">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 min-w-0">
                    <div className="h-12 w-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-500 border border-indigo-100 shrink-0 group-hover:bg-indigo-500 group-hover:text-white transition-all">
                      <ClipboardCheck className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base font-bold text-slate-900 truncate">{d.drive_name}</h3>
                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-1">{d.rule_name || "Assessment"}</p>
                    </div>
                  </div>
                  {d.session_status === "in_progress" ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-600 border border-amber-100 uppercase tracking-wider shrink-0">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" /> In progress
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-600 border border-emerald-100 uppercase tracking-wider shrink-0">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      {d.session_status === "registered" ? "Registered" : "Assigned"}
                    </span>
                  )}
                </div>
                <div className="mt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-slate-50">
                  <div className="flex flex-wrap items-center gap-5 text-[11px] font-bold text-slate-500">
                    {d.scheduled_start && (
                      <span className="flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5 text-slate-300" />
                        {new Date(d.scheduled_start).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </span>
                    )}
                    <span className="flex items-center gap-2"><Clock className="h-3.5 w-3.5 text-slate-300" /> {d.duration_minutes} min</span>
                    <span className="flex items-center gap-2"><FileText className="h-3.5 w-3.5 text-slate-300" /> {d.total_questions} questions</span>
                  </div>
                  <button
                    onClick={() => navigate(`${BASE}/exam/${d.drive_id}/instructions`)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-black hover:bg-indigo-700 shadow-lg shadow-indigo-600/15 transition-all active:scale-95 shrink-0"
                  >
                    {d.session_status === "in_progress" ? <><RotateCcw className="h-3.5 w-3.5" /> Resume</> : <><Play className="h-3.5 w-3.5" /> Start Exam</>}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : tab === "past" ? (
        past.length === 0 ? (
          <Empty icon={Trophy} title="No attempts yet" sub="Your completed exams will appear here." />
        ) : (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Exam</th>
                    <th className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Type</th>
                    <th className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Date</th>
                    <th className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {past.map((d) => (
                    <tr
                      key={d.drive_id}
                      className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                      onClick={() => navigate(`${BASE}/results/${d.drive_id}`)}
                    >
                      <td className="px-5 py-3.5 text-sm font-bold text-slate-900">{d.drive_name}</td>
                      <td className="px-5 py-3.5 text-center">
                        <span
                          className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                            d.drive_type === "mock_test"
                              ? "bg-violet-50 text-violet-600"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {d.drive_type === "mock_test" ? "Mock" : d.drive_type === "practice_test" ? "Practice" : "Exam"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-center text-xs font-medium text-slate-500">
                        {d.completed_at ? new Date(d.completed_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "Recently"}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className="text-base font-black text-indigo-600">{d.score ?? "—"}</span>
                        <span className="text-xs text-slate-400 ml-0.5">/ {d.total_marks || 100}</span>
                        <span className="block text-[10px] font-semibold text-indigo-500 mt-0.5">
                          View analysis →
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : loadingMocks ? (
        <div className="space-y-3">
          {[1, 2].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-50 border border-slate-100" />)}
        </div>
      ) : availableMockOnly.length === 0 && inProgressMocks.length === 0 ? (
        <Empty
          icon={Gamepad2}
          title="No mock tests available"
          sub="Full-length Phase-1 placement mocks appear here when published from Assessment Templates."
        />
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            Timed campus placement simulations · auto-submit · resume if interrupted · results update Placement Score.
          </p>
          {inProgressMocks.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-amber-700 uppercase tracking-wider">Resume</h3>
              {inProgressMocks.map((d) => (
                <div
                  key={d.drive_id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-100 bg-amber-50/40 p-4"
                >
                  <div>
                    <p className="text-sm font-bold text-slate-900">{d.drive_name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {d.duration_minutes} min · {d.total_questions} questions · in progress
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate(`${BASE}/exam/${d.drive_id}/instructions`)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-xs font-black text-white"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Resume mock
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {availableMockOnly.map((m) => {
              const topic = practiceTopicLabel(
                m.bank_category || m.placement_domain || m.phase1_domain || ""
              );
              return (
                <div
                  key={m.drive_id}
                  className="group bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-lg hover:border-violet-100 transition-all"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="h-10 w-10 rounded-xl bg-violet-50 flex items-center justify-center text-violet-500 border border-violet-100 group-hover:bg-violet-500 group-hover:text-white transition-all">
                      <Gamepad2 className="h-4 w-4" />
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg bg-violet-50 text-violet-500 border border-violet-100">
                      Mock
                    </span>
                  </div>
                  <h4 className="text-sm font-black text-slate-900 mb-1">{m.drive_name}</h4>
                  <p className="text-[11px] text-slate-400 font-medium">{topic}</p>
                  <div className="flex items-center justify-between pt-4 border-t border-slate-50 mt-5">
                    <div className="flex items-center gap-4 text-[11px] font-bold text-slate-400">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {m.duration_minutes}m timer
                      </span>
                      <span className="flex items-center gap-1">
                        <FileText className="h-3 w-3" /> {m.total_questions} Qs
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => enrollMutation.mutate(m.drive_id)}
                      disabled={enrollingId === m.drive_id}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-black hover:bg-violet-600 transition-all active:scale-95 disabled:opacity-50"
                    >
                      <Play className="h-3 w-3" />{" "}
                      {enrollingId === m.drive_id ? "Starting…" : "Start"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tint }: { label: string; value: number | string; tint: string }) {
  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm text-center">
      <p className={`text-2xl font-black leading-none ${tint}`}>{value}</p>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5">{label}</p>
    </div>
  );
}

function Empty({ icon: Icon, title, sub }: { icon: typeof ClipboardCheck; title: string; sub: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 bg-white rounded-2xl border border-dashed border-slate-200">
      <Icon className="h-10 w-10 text-slate-200 mb-3" />
      <p className="text-base font-bold text-slate-400">{title}</p>
      <p className="text-xs text-slate-300 mt-1">{sub}</p>
    </div>
  );
}
