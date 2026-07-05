import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  GraduationCap, Users, BookOpen, Award, Target,
  CheckCircle2, AlertTriangle, ChevronRight, Zap, BarChart3
} from "lucide-react";
import api from "../../lib/api";
import toast from "react-hot-toast";

const PROGRAM_TYPE_COLORS: Record<string, string> = {
  learning_path:  "bg-blue-100 text-blue-700",
  bootcamp:       "bg-violet-100 text-violet-700",
  workshop:       "bg-amber-100 text-amber-700",
  certification:  "bg-emerald-100 text-emerald-700",
};

const SKILL_LEVEL_COLOR: Record<string, string> = {
  beginner:     "bg-emerald-100 text-emerald-700",
  intermediate: "bg-amber-100 text-amber-700",
  advanced:     "bg-red-100 text-red-700",
  expert:       "bg-violet-100 text-violet-700",
};

type Tab = "overview" | "programs" | "students" | "skill-gap";

export default function CollegeSkillsPage() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [enrollProgramId, setEnrollProgramId] = useState("");
  const [showEnrollModal, setShowEnrollModal] = useState(false);

  const { data: overview, isLoading: loadingOverview } = useQuery<any>({
    queryKey: ["college-skills-overview"],
    queryFn: async () => (await api.get("/college-skills/overview")).data.data,
  });

  const { data: programs = [], isLoading: loadingPrograms } = useQuery<any[]>({
    queryKey: ["college-skills-programs"],
    queryFn: async () => (await api.get("/college-skills/programs")).data.data,
    enabled: activeTab === "programs" || activeTab === "overview",
  });

  const { data: students = [], isLoading: loadingStudents } = useQuery<any[]>({
    queryKey: ["college-skills-students"],
    queryFn: async () => (await api.get("/college-skills/students")).data.data,
    enabled: activeTab === "students",
  });

  const { data: skillGap = [], isLoading: loadingSkillGap } = useQuery<any[]>({
    queryKey: ["college-skills-gap"],
    queryFn: async () => (await api.get("/college-skills/skill-gap")).data.data,
    enabled: activeTab === "skill-gap",
  });

  const { data: availablePrograms = [] } = useQuery<any[]>({
    queryKey: ["student-available-programs"],
    queryFn: async () => (await api.get("/student-learning/available-programs")).data.data,
  });

  const batchEnrollMutation = useMutation({
    mutationFn: (program_id: string) => api.post("/college-skills/batch-enroll", { program_id }),
    onSuccess: (res) => {
      toast.success(res.data.message);
      qc.invalidateQueries({ queryKey: ["college-skills-overview"] });
      qc.invalidateQueries({ queryKey: ["college-skills-programs"] });
      qc.invalidateQueries({ queryKey: ["college-skills-students"] });
      setShowEnrollModal(false);
      setEnrollProgramId("");
    },
    onError: (e: any) => toast.error(e.response?.data?.error || "Failed to enroll"),
  });

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: "overview",   label: "Overview",   icon: BarChart3 },
    { key: "programs",   label: "Programs",   icon: BookOpen },
    { key: "students",   label: "Students",   icon: Users },
    { key: "skill-gap",  label: "Skill Gap",  icon: Target },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <GraduationCap className="h-7 w-7 text-indigo-500" />
            <h1 className="text-2xl font-black text-slate-900">Skills Development</h1>
          </div>
          <p className="text-sm text-slate-500 ml-10">Track your students' learning progress and skill coverage</p>
        </div>
        <button
          onClick={() => setShowEnrollModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-500 text-white rounded-xl text-sm font-bold hover:bg-indigo-600 transition-colors shadow-lg shadow-indigo-200"
        >
          <Users className="h-4 w-4" /> Batch Enroll Students
        </button>
      </div>

      {/* Tab Bar */}
      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === t.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}>
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {/* ── Overview Tab ── */}
      {activeTab === "overview" && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {loadingOverview ? Array(6).fill(0).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 h-28 animate-pulse" />
            )) : [
              { label: "Total Students",    value: overview?.total_students ?? 0,    icon: Users,        color: "bg-indigo-50 text-indigo-600" },
              { label: "Enrollments",       value: overview?.total_enrollments ?? 0, icon: BookOpen,     color: "bg-violet-50 text-violet-600" },
              { label: "Completions",       value: overview?.completions ?? 0,       icon: CheckCircle2, color: "bg-emerald-50 text-emerald-600" },
              { label: "Programs Accessed", value: overview?.programs_accessed ?? 0, icon: GraduationCap,color: "bg-amber-50 text-amber-600" },
              { label: "Avg Score",         value: overview?.avg_score ? `${overview.avg_score}%` : "—", icon: Award, color: "bg-rose-50 text-rose-600" },
              { label: "Skills Acquired",   value: overview?.skills_acquired ?? 0,   icon: Zap,          color: "bg-teal-50 text-teal-600" },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                <div className={`h-8 w-8 rounded-xl flex items-center justify-center mb-3 ${s.color}`}>
                  <s.icon className="h-4 w-4" />
                </div>
                <p className="text-2xl font-black text-slate-900">{s.value}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Top Programs Preview */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-black text-slate-900">Active Programs</h2>
              <button onClick={() => setActiveTab("programs")} className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1">
                View all <ChevronRight className="h-3 w-3" />
              </button>
            </div>
            {loadingPrograms ? (
              <div className="p-6 space-y-3">{Array(3).fill(0).map((_, i) => <div key={i} className="h-12 bg-slate-50 rounded-xl animate-pulse" />)}</div>
            ) : programs.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-slate-300 font-bold text-sm">No programs enrolled yet</div>
            ) : (
              <div className="divide-y divide-slate-50">
                {programs.slice(0, 5).map((p: any) => (
                  <div key={p.id} className="flex items-center gap-4 px-6 py-3">
                    <span className={`text-xs font-bold px-2 py-1 rounded-full capitalize ${PROGRAM_TYPE_COLORS[p.program_type] || "bg-slate-100 text-slate-600"}`}>
                      {p.program_type?.replace("_", " ")}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{p.name}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-black text-slate-900">{p.enrolled_students} enrolled</p>
                      <p className="text-xs text-slate-400">{p.completion_rate}% complete</p>
                    </div>
                    <div className="w-20">
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${p.completion_rate}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Programs Tab ── */}
      {activeTab === "programs" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in duration-300">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="font-black text-slate-900">Enrolled Programs</h2>
            <p className="text-xs text-slate-400 mt-0.5">Programs your students are participating in</p>
          </div>
          {loadingPrograms ? (
            <div className="p-6 space-y-4">{Array(4).fill(0).map((_, i) => <div key={i} className="h-16 bg-slate-50 rounded-xl animate-pulse" />)}</div>
          ) : programs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <BookOpen className="h-10 w-10 text-slate-300" />
              <p className="text-slate-400 font-bold">No programs yet</p>
              <button onClick={() => setShowEnrollModal(true)} className="text-sm text-indigo-600 font-bold hover:underline">
                Batch enroll students →
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-widest text-slate-400">Program</th>
                    <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-widest text-slate-400">Type</th>
                    <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-widest text-slate-400">Enrolled</th>
                    <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-widest text-slate-400">Completed</th>
                    <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-widest text-slate-400">Rate</th>
                    <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-widest text-slate-400">Avg Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {programs.map((p: any) => {
                    const rate = Number(p.completion_rate);
                    return (
                      <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-bold text-slate-900">{p.name}</p>
                          {p.duration_days && <p className="text-xs text-slate-400">{p.duration_days} days</p>}
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-bold capitalize ${PROGRAM_TYPE_COLORS[p.program_type] || "bg-slate-100 text-slate-600"}`}>
                            {p.program_type?.replace("_", " ")}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center font-bold text-slate-700">{p.enrolled_students}</td>
                        <td className="px-4 py-4 text-center font-bold text-emerald-600">{p.completed_students}</td>
                        <td className="px-4 py-4 text-center">
                          <div className="flex items-center gap-2 justify-center">
                            <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${rate >= 70 ? "bg-emerald-500" : rate >= 40 ? "bg-amber-500" : "bg-red-400"}`}
                                style={{ width: `${rate}%` }} />
                            </div>
                            <span className="font-black text-sm text-slate-900">{rate}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center font-bold text-slate-700">
                          {Number(p.avg_score) > 0 ? `${p.avg_score}%` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Students Tab ── */}
      {activeTab === "students" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in duration-300">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="font-black text-slate-900">Student Progress</h2>
            <p className="text-xs text-slate-400 mt-0.5">Individual skill development tracking</p>
          </div>
          {loadingStudents ? (
            <div className="p-6 space-y-3">{Array(5).fill(0).map((_, i) => <div key={i} className="h-12 bg-slate-50 rounded-xl animate-pulse" />)}</div>
          ) : students.length === 0 ? (
            <div className="flex items-center justify-center py-20 text-slate-300 font-bold text-sm">No student data</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-widest text-slate-400">Student</th>
                    <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-widest text-slate-400">Dept</th>
                    <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-widest text-slate-400">Year</th>
                    <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-widest text-slate-400">Programs</th>
                    <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-widest text-slate-400">Completed</th>
                    <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-widest text-slate-400">Skills</th>
                    <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-widest text-slate-400">Avg Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {students.map((s: any) => (
                    <tr key={s.student_id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-3">
                        <p className="font-bold text-slate-900">{s.student_name}</p>
                        <p className="text-xs text-slate-400">{s.email}</p>
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-slate-600">{s.department || "—"}</td>
                      <td className="px-4 py-3 text-center text-xs text-slate-600">{s.year_of_study || "—"}</td>
                      <td className="px-4 py-3 text-center font-bold text-slate-700">{s.enrolled_programs}</td>
                      <td className="px-4 py-3 text-center font-bold text-emerald-600">{s.completed_programs}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-black">{s.skills_acquired}</span>
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-slate-700">
                        {Number(s.avg_score) > 0 ? `${s.avg_score}%` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Skill Gap Tab ── */}
      {activeTab === "skill-gap" && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-amber-800">Skill Gap Analysis</p>
              <p className="text-xs text-amber-600 mt-0.5">Skills sorted by lowest coverage — focus on red/amber skills to improve employability</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {loadingSkillGap ? (
              <div className="p-6 space-y-3">{Array(8).fill(0).map((_, i) => <div key={i} className="h-10 bg-slate-50 rounded-xl animate-pulse" />)}</div>
            ) : skillGap.length === 0 ? (
              <div className="flex items-center justify-center py-20 text-slate-300 font-bold text-sm">No skill data</div>
            ) : (
              <div className="divide-y divide-slate-50">
                {skillGap.map((s: any) => {
                  const pct = Number(s.coverage_pct);
                  const barColor = pct >= 60 ? "bg-emerald-500" : pct >= 30 ? "bg-amber-500" : "bg-red-400";
                  const textColor = pct >= 60 ? "text-emerald-700" : pct >= 30 ? "text-amber-700" : "text-red-600";
                  return (
                    <div key={s.id} className="flex items-center gap-4 px-6 py-3">
                      <div className="flex-shrink-0 w-28">
                        <p className="text-xs font-bold text-slate-700 truncate">{s.skill_name}</p>
                        <p className="text-[10px] text-slate-400">{s.category_name}</p>
                      </div>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${SKILL_LEVEL_COLOR[s.skill_level] || "bg-slate-100 text-slate-600"}`}>
                        {s.skill_level}
                      </span>
                      <div className="flex-1">
                        <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 w-24">
                        <span className={`text-sm font-black ${textColor}`}>{pct}%</span>
                        <p className="text-[10px] text-slate-400">{s.students_with_skill} students</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Batch Enroll Modal ── */}
      {showEnrollModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-black text-slate-900 mb-1">Batch Enroll Students</h3>
            <p className="text-sm text-slate-500 mb-5">Enroll all college students into a skill program at once</p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Select Program</label>
                <select value={enrollProgramId} onChange={e => setEnrollProgramId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" aria-label="Select program">
                  <option value="">— Choose a program —</option>
                  {availablePrograms.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.program_type?.replace("_", " ")})</option>
                  ))}
                </select>
              </div>
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-xs text-indigo-700 font-bold">
                All students not yet enrolled in this program will be added automatically.
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setShowEnrollModal(false); setEnrollProgramId(""); }}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50">
                Cancel
              </button>
              <button
                onClick={() => enrollProgramId && batchEnrollMutation.mutate(enrollProgramId)}
                disabled={!enrollProgramId || batchEnrollMutation.isPending}
                className="flex-1 py-2.5 rounded-xl bg-indigo-500 text-white text-sm font-bold hover:bg-indigo-600 disabled:opacity-50">
                {batchEnrollMutation.isPending ? "Enrolling..." : "Enroll All Students"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
