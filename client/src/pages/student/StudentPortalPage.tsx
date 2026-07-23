import { useState } from "react";
import { useAuthStore } from "../../stores/authStore";
import { useQuery, useMutation } from "@tanstack/react-query";
import api from "../../lib/api";
import {
  Calendar,
  Clock,
  CheckCircle2,
  ArrowRight,
  BookOpen,
  Trophy,
  User,
  ShieldCheck,
  Play,
  RotateCcw,
  Award,
  Gamepad2,
  X,
  AlertTriangle,
  FileText,
  LayoutDashboard,
  GraduationCap,
  Zap,
  TrendingUp,
  ChevronRight,
  Wallet,
  Target,
} from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useRef } from "react";
import DailyTargetCard from "./DailyTargetCard";

type PortalTab = "dashboard" | "exams" | "learning";

export default function StudentPortalPage() {
  const user = useAuthStore((s) => s.user);
  const [instructionDrive, setInstructionDrive] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<PortalTab>("dashboard");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mockZoneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (searchParams.get("tab") === "mock") {
      setActiveTab("exams");
      setTimeout(() => mockZoneRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
    if (searchParams.get("tab") === "exams") {
      setActiveTab("exams");
    }
    if (searchParams.get("tab") === "learning") {
      setActiveTab("learning");
    }
  }, [searchParams]);

  // Queries
  const { data: profile, isLoading: loadingProfile } = useQuery({
    queryKey: ["student-profile"],
    queryFn: async () => {
      const { data } = await api.get("/auth/me");
      return data.data;
    },
  });

  const { data: drives, isLoading: loadingDrives } = useQuery({
    queryKey: ["student-drives"],
    queryFn: async () => {
      const { data } = await api.get("/exam-sessions/my-drives");
      return data.data;
    },
    enabled: !!user?.id,
  });

  const { data: enrollments = [], isLoading: loadingEnrollments } = useQuery<any[]>({
    queryKey: ["student-enrollments"],
    queryFn: async () => (await api.get("/student-learning/my-enrollments")).data.data,
    enabled: !!user?.id,
  });

  const { data: availablePrograms = [] } = useQuery<any[]>({
    queryKey: ["student-available-programs"],
    queryFn: async () => (await api.get("/student-learning/available-programs")).data.data,
    enabled: !!user?.id,
  });

  if (loadingProfile) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  const isProfileComplete = profile?.is_profile_complete;

  if (!isProfileComplete) {
    return (
      <div className="max-w-3xl mx-auto py-12 px-4 animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="bg-white/70 backdrop-blur-xl rounded-[2rem] shadow-xl overflow-hidden border border-white/50">
          <div className="bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 p-10 text-white text-center rounded-b-[2rem] relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(100,100,250,0.1),transparent_50%)]" />
            <div className="flex flex-col items-center gap-4 relative z-10">
              <div className="h-16 w-16 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/10 shadow-inner">
                <ShieldCheck className="h-8 w-8 text-indigo-300" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Almost There!</h1>
                <p className="text-indigo-200/80 font-medium max-w-md mx-auto leading-relaxed">
                  Before you can access your assessments, we need a few more details to complete your profile structure.
                </p>
              </div>
            </div>
          </div>
          <div className="p-10 text-center">
            <Link
              to="/student-onboarding"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 hover:shadow-indigo-500/30 hover:-translate-y-0.5 transition-all w-full max-w-sm"
            >
              Complete My Profile <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const now = new Date();
  const activeDrives = (drives || []).filter((d: any) => {
    const driveStatus = d.drive_status?.toUpperCase();
    const canStartDrive = ["PUBLISHED", "ACTIVE", "SCHEDULED"].includes(driveStatus);
    const isStatusActive =
      d.session_status === "in_progress" || // always show in-progress regardless of drive status
      ((d.session_status === "assigned" || d.session_status === "registered") && canStartDrive);
    const isNotExpired = !d.scheduled_end || new Date(d.scheduled_end) > now;
    return isStatusActive && isNotExpired;
  });
  const completedDrives = (drives || []).filter((d: any) => d.session_status === "completed");

  const mockExams = [
    { id: "mock-1", name: "General Aptitude Mock", duration: 30, questions: 20, difficulty: "Medium", description: "Test your logical reasoning & quantitative skills" },
    { id: "mock-2", name: "Technical Foundation Practice", duration: 45, questions: 30, difficulty: "Hard", description: "Master core CS fundamentals & problem solving" },
  ];

  const avgScore = completedDrives.length > 0
    ? Math.round(completedDrives.reduce((acc: number, d: any) => acc + (Number(d.score) || 0), 0) / completedDrives.length)
    : 0;

  const tabs: { id: PortalTab; label: string; icon: any }[] = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "exams", label: "Exams", icon: GraduationCap },
    { id: "learning", label: "Learning", icon: BookOpen },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500 pb-20 px-2">
      <InstructionsModal
        driveId={instructionDrive}
        onClose={() => setInstructionDrive(null)}
        drives={drives}
        navigate={navigate}
      />

      {/* ── Compact Welcome Bar ── */}
      <div className="flex items-center justify-between bg-white rounded-2xl px-6 py-4 border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
            <span className="text-lg font-black">{user?.name?.[0]?.toUpperCase()}</span>
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900 tracking-tight leading-tight">
              Welcome, <span className="text-indigo-600">{user?.name?.split(" ")[0]}</span>
            </h1>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              {activeDrives.length > 0
                ? <>{activeDrives.length} active exam{activeDrives.length !== 1 ? "s" : ""} · {completedDrives.length} completed</>
                : <>No active exams · {completedDrives.length} completed</>
              }
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/app/student-portal/payments"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-50 hover:bg-indigo-50 text-sm font-bold text-slate-600 hover:text-indigo-600 border border-slate-100 hover:border-indigo-100 transition-all"
          >
            <Wallet className="h-4 w-4" />
            <span className="hidden sm:inline">Payments</span>
          </Link>
          <Link
            to="/app/student-portal/profile"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-50 hover:bg-indigo-50 text-sm font-bold text-slate-600 hover:text-indigo-600 border border-slate-100 hover:border-indigo-100 transition-all group"
          >
            <User className="h-4 w-4" />
            Profile
            <ArrowRight className="h-3 w-3 opacity-0 -ml-1 group-hover:opacity-100 group-hover:ml-0 transition-all" />
          </Link>
        </div>
      </div>

      {/* ── Tab Switcher ── */}
      <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === tab.id
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-400 hover:text-slate-600"
              }`}
          >
            <tab.icon className={`h-4 w-4 ${activeTab === tab.id ? "text-indigo-500" : ""}`} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      {activeTab === "dashboard" && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Active Exams", value: activeDrives.length, icon: Zap, color: "indigo", bg: "bg-indigo-50", border: "border-indigo-100" },
              { label: "Completed", value: completedDrives.length, icon: CheckCircle2, color: "emerald", bg: "bg-emerald-50", border: "border-emerald-100" },
              { label: "Avg Score", value: avgScore || "—", icon: TrendingUp, color: "amber", bg: "bg-amber-50", border: "border-amber-100" },
              { label: "Mock Tests", value: mockExams.length, icon: Target, color: "violet", bg: "bg-violet-50", border: "border-violet-100" },
            ].map((stat) => (
              <div key={stat.label} className={`${stat.bg} ${stat.border} border rounded-2xl p-5 group hover:shadow-md transition-all`}>
                <div className="flex items-center justify-between mb-3">
                  <stat.icon className={`h-5 w-5 text-${stat.color}-500`} />
                </div>
                <p className="text-2xl font-black text-slate-900 leading-none">{stat.value}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Daily target (set by your college) */}
          <DailyTargetCard />

          {/* Learning Portal */}
          <Link to="/app/learn" className="block bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5 text-white hover:opacity-95 transition-opacity group">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <GraduationCap className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="font-black text-sm">Learning Portal</p>
                  <p className="text-emerald-100 text-xs">Courses, programs, certificates</p>
                </div>
              </div>
              <p className="text-emerald-100 text-xs leading-relaxed mb-4">
                Upskill with courses and programs. Earn certificates on completion.
              </p>
              <span className="inline-flex items-center gap-1.5 bg-white/20 group-hover:bg-white/30 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors">
                Open Learning Portal <ChevronRight className="h-3.5 w-3.5" />
              </span>
            </Link>

          {/* Two Column: Upcoming + Academic Info */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Upcoming Exams Quick View */}
            <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Upcoming Exams</h3>
                {activeDrives.length > 0 && (
                  <button onClick={() => setActiveTab("exams")} className="text-xs font-bold text-indigo-500 hover:text-indigo-700 transition-colors flex items-center gap-1">
                    View All <ArrowRight className="h-3 w-3" />
                  </button>
                )}
              </div>
              <div className="divide-y divide-slate-50">
                {loadingDrives ? (
                  <div className="p-6"><div className="h-16 animate-pulse bg-slate-50 rounded-xl" /></div>
                ) : activeDrives.length > 0 ? (
                  activeDrives.slice(0, 3).map((drive: any) => (
                    <div key={drive.drive_id} className="flex items-center justify-between px-6 py-4 hover:bg-slate-50/50 transition-colors group">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-500 border border-indigo-100 group-hover:bg-indigo-500 group-hover:text-white transition-all">
                          <BookOpen className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900 leading-tight">{drive.drive_name}</p>
                          <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                            {drive.duration_minutes}min · {drive.total_questions} questions
                            {drive.scheduled_start && <> · {new Date(drive.scheduled_start).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</>}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {drive.session_status === "in_progress" && (
                          <span className="text-[9px] font-black text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full uppercase tracking-wider">In Progress</span>
                        )}
                        <button
                          onClick={() => setInstructionDrive(drive.drive_id)}
                          className="p-2 rounded-xl bg-indigo-50 text-indigo-500 hover:bg-indigo-500 hover:text-white transition-all"
                        >
                          <Play className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
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

            {/* Academic Info + Performance */}
            <div className="lg:col-span-2 space-y-5">
              {/* Performance */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-4">Performance</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <span className="text-xs font-medium text-slate-500">Exams Taken</span>
                    <span className="text-lg font-black text-slate-900">{completedDrives.length}</span>
                  </div>
                  {completedDrives.length > 0 && (
                    <div className="flex items-center justify-between bg-indigo-50 rounded-xl p-3 border border-indigo-100">
                      <div className="flex items-center gap-2">
                        <Trophy className="h-3.5 w-3.5 text-indigo-500" />
                        <span className="text-xs font-medium text-indigo-800">Avg. Score</span>
                      </div>
                      <span className="text-lg font-black text-indigo-700">{avgScore}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Academic */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-4">Academic Info</h4>
                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Affiliation</p>
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-3.5 w-3.5 text-slate-400" />
                      <p className="text-sm font-semibold text-slate-800">{profile?.college_name || "N/A"}</p>
                    </div>
                  </div>
                  <div className="pt-3 border-t border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Course</p>
                    <p className="text-sm font-semibold text-slate-800">{profile?.specialization || "Undecided"}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{profile?.degree || "No Degree Set"}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "exams" && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

          {/* ── Live Exams Section ── */}
          <div>
            <div className="flex items-center gap-3 mb-5">
              <div className="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-500 border border-indigo-100">
                <Zap className="h-4 w-4" />
              </div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight">Live Exams</h2>
              {activeDrives.length > 0 && (
                <span className="flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-indigo-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500" />
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4">
              {loadingDrives ? (
                Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="h-32 animate-pulse rounded-2xl bg-slate-50 border border-slate-100" />
                ))
              ) : activeDrives.length > 0 ? (
                activeDrives.map((drive: any) => (
                  <div key={drive.drive_id} className="group bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-lg hover:border-indigo-100 transition-all duration-300">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4 flex-1 min-w-0">
                        <div className="h-12 w-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-500 border border-indigo-100 shrink-0 group-hover:bg-indigo-500 group-hover:text-white transition-all">
                          <BookOpen className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-base font-bold text-slate-900 leading-tight truncate">{drive.drive_name}</h3>
                          <p className="text-[11px] font-semibold text-slate-400 mt-1 uppercase tracking-wider">{drive.rule_name || "Assessment"}</p>
                        </div>
                      </div>
                      {drive.session_status === "in_progress" ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-600 border border-amber-100 uppercase tracking-wider shrink-0">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                          In Progress
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-600 border border-emerald-100 uppercase tracking-wider shrink-0">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          {drive.session_status === "registered" ? "Registered" : "Assigned"}
                        </span>
                      )}
                    </div>

                    <div className="mt-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-4 border-t border-slate-50">
                      <div className="flex flex-wrap items-center gap-5">
                        {drive.scheduled_start && (
                          <div className="flex items-center gap-2">
                            <Calendar className="h-3.5 w-3.5 text-slate-300" />
                            <span className="text-[11px] font-bold text-slate-500">
                              {new Date(drive.scheduled_start).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} {new Date(drive.scheduled_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              {drive.scheduled_end && <> <span className="text-slate-300">→</span> {new Date(drive.scheduled_end).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} {new Date(drive.scheduled_end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</>}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Clock className="h-3.5 w-3.5 text-slate-300" />
                          <span className="text-[11px] font-bold text-slate-500">{drive.duration_minutes} min</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <FileText className="h-3.5 w-3.5 text-slate-300" />
                          <span className="text-[11px] font-bold text-slate-500">{drive.total_questions} questions</span>
                        </div>
                      </div>
                      <button
                        onClick={() => setInstructionDrive(drive.drive_id)}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-black hover:bg-indigo-700 shadow-lg shadow-indigo-600/15 transition-all active:scale-95 shrink-0"
                      >
                        {drive.session_status === "in_progress" ? <><RotateCcw className="h-3.5 w-3.5" /> Resume</> : <><Play className="h-3.5 w-3.5" /> Start Exam</>}
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-14 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <CheckCircle2 className="h-10 w-10 text-slate-200 mb-3" />
                  <p className="text-base font-bold text-slate-400">No active exams</p>
                  <p className="text-xs text-slate-300 mt-1">Check back later or practice below.</p>
                </div>
              )}
            </div>
          </div>

          {/* ── Mock Exams Section ── */}
          <div ref={mockZoneRef}>
            <div className="flex items-center gap-3 mb-5">
              <div className="h-8 w-8 rounded-lg bg-violet-50 flex items-center justify-center text-violet-500 border border-violet-100">
                <Gamepad2 className="h-4 w-4" />
              </div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight">Mock Exams</h2>
              <span className="text-[10px] font-black text-violet-500 bg-violet-50 border border-violet-100 px-2 py-0.5 rounded-full uppercase tracking-widest">Practice</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {mockExams.map((mock) => (
                <div key={mock.id} className="group bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-lg hover:border-violet-100 transition-all duration-300">
                  <div className="flex items-center justify-between mb-4">
                    <div className="h-10 w-10 rounded-xl bg-violet-50 flex items-center justify-center text-violet-500 border border-violet-100 group-hover:bg-violet-500 group-hover:text-white transition-all">
                      <Gamepad2 className="h-4 w-4" />
                    </div>
                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg ${mock.difficulty === "Hard" ? "bg-red-50 text-red-500 border border-red-100" : "bg-emerald-50 text-emerald-500 border border-emerald-100"
                      }`}>
                      {mock.difficulty}
                    </span>
                  </div>
                  <h4 className="text-sm font-black text-slate-900 mb-1">{mock.name}</h4>
                  <p className="text-xs text-slate-400 font-medium mb-5 leading-relaxed">{mock.description}</p>
                  <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                    <div className="flex items-center gap-4 text-[11px] font-bold text-slate-400">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {mock.duration}m</span>
                      <span className="flex items-center gap-1"><FileText className="h-3 w-3" /> {mock.questions} Qs</span>
                    </div>
                    <Link
                      to={`/app/student-portal/mock/${mock.id}`}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-black hover:bg-violet-600 transition-all active:scale-95"
                    >
                      <Play className="h-3 w-3" /> Start
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Past Results Section ── */}
          {completedDrives.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-5">
                <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-500 border border-emerald-100">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <h2 className="text-lg font-black text-slate-900 tracking-tight">Past Results</h2>
              </div>

              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Exam Name</th>
                        <th className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Date</th>
                        <th className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Score</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {completedDrives.map((drive: any) => (
                        <tr key={drive.drive_id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-5 py-3.5">
                            <p className="text-sm font-bold text-slate-900">{drive.drive_name}</p>
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            <span className="text-xs font-medium text-slate-500">
                              {drive.completed_at ? new Date(drive.completed_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : "Recently"}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <span className="text-base font-black text-indigo-600">{drive.score ?? "—"}</span>
                            <span className="text-xs text-slate-400 ml-0.5">/ {drive.total_marks || "100"}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      {/* ── Learning Tab ── */}
      {activeTab === "learning" && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Enrolled Programs */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center border border-indigo-100">
                <BookOpen className="h-4 w-4 text-indigo-500" />
              </div>
              <h2 className="text-lg font-black text-slate-900">My Programs</h2>
            </div>
            {loadingEnrollments ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
              </div>
            ) : enrollments.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
                <GraduationCap className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                <p className="font-bold text-slate-400">No programs enrolled yet</p>
                <p className="text-sm text-slate-300 mt-1">Browse available programs below</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {enrollments.map((e: any) => {
                  const pct = e.total_modules > 0 ? Math.round((e.completed_modules / e.total_modules) * 100) : 0;
                  const isDone = e.status === "completed";
                  return (
                    <Link key={e.enrollment_id} to={`/app/student-portal/programs/${e.program_id}`}
                      className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-all group">
                      <div className="flex items-start justify-between mb-3">
                        <span className="text-xs font-bold px-2 py-1 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100 capitalize">
                          {e.program_type?.replace("_", " ")}
                        </span>
                        {isDone && (
                          <span className="flex items-center gap-1 text-xs font-bold text-emerald-600">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Completed
                          </span>
                        )}
                      </div>
                      <h3 className="font-black text-slate-900 mb-1 group-hover:text-indigo-600 transition-colors">{e.program_name}</h3>
                      {e.program_description && (
                        <p className="text-xs text-slate-400 line-clamp-2 mb-3">{e.program_description}</p>
                      )}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs text-slate-500 font-bold">
                          <span>{e.completed_modules} / {e.total_modules} modules</span>
                          <span>{pct}%</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${isDone ? "bg-emerald-500" : "bg-indigo-500"}`}
                            style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      {e.avg_score != null && (
                        <p className="text-xs text-slate-400 mt-2">Avg score: <span className="font-bold text-slate-600">{e.avg_score}%</span></p>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Available Programs to Explore */}
          {availablePrograms.filter((p: any) => !p.is_enrolled).length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center border border-emerald-100">
                  <Trophy className="h-4 w-4 text-emerald-500" />
                </div>
                <h2 className="text-lg font-black text-slate-900">Explore Programs</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {availablePrograms.filter((p: any) => !p.is_enrolled).map((p: any) => (
                  <Link key={p.id} to={`/app/student-portal/programs/${p.id}`}
                    className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-all group">
                    <div className="flex items-start justify-between mb-3">
                      <span className="text-xs font-bold px-2 py-1 rounded-full bg-slate-100 text-slate-600 capitalize">
                        {p.program_type?.replace("_", " ")}
                      </span>
                      <span className="text-xs text-slate-400">{p.module_count} modules</span>
                    </div>
                    <h3 className="font-black text-slate-900 mb-1 group-hover:text-indigo-600 transition-colors">{p.name}</h3>
                    {p.description && <p className="text-xs text-slate-400 line-clamp-2 mb-3">{p.description}</p>}
                    <div className="flex items-center gap-2 text-xs text-indigo-600 font-bold mt-3">
                      <Play className="h-3 w-3" /> Enroll & Start Learning
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InstructionsModal({
  driveId,
  onClose,
  drives,
  navigate,
}: {
  driveId: string | null;
  onClose: () => void;
  drives: any[];
  navigate: any;
}) {
  const session = drives?.find((d) => d.drive_id === driveId);

  const startMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/exam-sessions/${driveId}/start`);
      return data.data;
    },
    onSuccess: () => {
      navigate(`/app/student-portal/exam/${driveId}/play`);
    },
  });

  if (!driveId || !session) return null;

  const isResume = session.session_status === "in_progress";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className="relative bg-white rounded-[2.5rem] shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-white/20 animate-in zoom-in-95 duration-300">
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-2xl bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-900 transition-all z-10"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="p-8 pb-4 border-b border-slate-50 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
            <FileText className="h-40 w-40" />
          </div>
          <div className="flex items-center gap-5 relative z-10">
            <div className="h-16 w-16 rounded-3xl bg-indigo-600 flex items-center justify-center text-white shadow-xl shadow-indigo-600/20">
              <FileText className="h-8 w-8" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900">{session.drive_name}</h2>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mt-1.5">{session.rule_name || "Assessment"}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mt-8">
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100/50">
              <div className="flex items-center gap-2 text-indigo-500 mb-1">
                <Clock className="h-3.5 w-3.5" />
                <span className="text-[10px] font-black uppercase tracking-widest mt-0.5">Time</span>
              </div>
              <p className="text-xl font-black text-slate-900">{session.duration_minutes}m</p>
            </div>
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100/50">
              <div className="flex items-center gap-2 text-emerald-500 mb-1">
                <FileText className="h-3.5 w-3.5" />
                <span className="text-[10px] font-black uppercase tracking-widest mt-0.5">Tasks</span>
              </div>
              <p className="text-xl font-black text-slate-900">{session.total_questions}</p>
            </div>
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100/50">
              <div className="flex items-center gap-2 text-amber-500 mb-1">
                <Award className="h-3.5 w-3.5" />
                <span className="text-[10px] font-black uppercase tracking-widest mt-0.5">Marks</span>
              </div>
              <p className="text-xl font-black text-slate-900">{session.total_marks}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 pt-6 space-y-4">
          <h3 className="text-lg font-black text-slate-900 mb-4">Exam Guidelines</h3>
          <div className="space-y-3">
            {[
              `This is a timed assessment — the timer starts the moment you click Start.`,
              `You have ${session.duration_minutes} minutes to complete ${session.total_questions} questions worth ${session.total_marks} marks.`,
              "You can navigate freely between questions and flag any for review.",
              session.negative_marking_enabled
                ? `Negative marking is enabled: −${session.negative_marking_value} mark(s) deducted per wrong answer.`
                : "No negative marking — unanswered and wrong answers both score zero.",
              `Minimum cutoff to pass: ${session.overall_cutoff ?? "—"}%.`,
              "Your answers are auto-saved every 5 seconds. You can resume if you lose connection.",
              "The exam auto-submits when the timer reaches zero.",
              "Proctoring is active: camera, tab switching, copy/paste, and right-click are all monitored.",
            ].map((text, i) => (
              <div key={i} className="flex items-start gap-4 p-4 bg-slate-50/50 rounded-2xl border border-slate-100 font-medium text-slate-700 text-sm">
                <div className="h-5 w-5 rounded-full bg-white shadow-sm flex items-center justify-center text-[10px] font-black text-indigo-500 shrink-0 mt-0.5 border border-slate-100">
                  {i + 1}
                </div>
                {text}
              </div>
            ))}
          </div>

          <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex items-start gap-3 mt-4">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs font-bold text-amber-800 leading-relaxed">
              Once started, the timer cannot be paused. Ensure a stable internet connection and a quiet environment before proceeding.
            </p>
          </div>

          <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
            <p className="text-xs font-bold text-emerald-800 leading-relaxed">
              By starting this exam I confirm that I will complete it honestly, without assistance, and in accordance with the assessment rules.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-8 pt-4 border-t border-slate-50">
          <button
            onClick={() => startMutation.mutate()}
            disabled={startMutation.isPending}
            className="w-full h-14 flex items-center justify-center gap-3 rounded-2xl bg-indigo-600 text-white font-black hover:bg-indigo-700 shadow-xl shadow-indigo-600/20 transition-all disabled:opacity-70 group"
          >
            {startMutation.isPending ? (
              <div className="h-5 w-5 animate-spin rounded-full border-3 border-white border-t-transparent" />
            ) : (
              <>
                {isResume ? <RotateCcw className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                {isResume ? "Resume My Session" : "I Agree & Start Exam"}
                <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
          {startMutation.isError && (
            <p className="text-red-600 text-sm font-bold mt-3 text-center">
              {(startMutation.error as any)?.response?.data?.error || "Failed to start exam. Please try again."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
