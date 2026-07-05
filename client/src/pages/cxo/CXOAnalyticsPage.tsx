import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp, Users, GraduationCap, BookOpen, Award, Building2,
  Target, Zap, BarChart3, CheckCircle2, ArrowUpRight
} from "lucide-react";
import { useAuthStore } from "../../stores/authStore";
import api from "../../lib/api";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend
} from "recharts";

const PROGRAM_TYPE_COLORS: Record<string, string> = {
  learning_path: "#6366f1",
  bootcamp:      "#8b5cf6",
  workshop:      "#f59e0b",
  certification: "#10b981",
};

const PIE_COLORS = ["#6366f1", "#8b5cf6", "#f59e0b", "#10b981", "#ef4444", "#06b6d4"];

const SKILL_LEVEL_COLOR: Record<string, string> = {
  beginner:     "bg-emerald-100 text-emerald-700",
  intermediate: "bg-amber-100 text-amber-700",
  advanced:     "bg-red-100 text-red-700",
};

function StatCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string | number; sub?: string;
  icon: any; color: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-all">
      <div className="flex items-center justify-between mb-4">
        <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <ArrowUpRight className="h-4 w-4 text-slate-300" />
      </div>
      <p className="text-3xl font-black text-slate-900 leading-none">{value ?? "—"}</p>
      <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mt-2">{label}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function CXOAnalyticsPage() {
  const user = useAuthStore((s) => s.user);

  const { data: uplift, isLoading: loadingUplift } = useQuery<any>({
    queryKey: ["cxo-uplift"],
    queryFn: async () => (await api.get("/skill-partners/analytics/uplift")).data.data,
  });

  const { data: employability = [], isLoading: loadingEmp } = useQuery<any[]>({
    queryKey: ["cxo-employability"],
    queryFn: async () => (await api.get("/skill-partners/analytics/employability")).data.data,
  });

  const { data: programs = [], isLoading: loadingPrograms } = useQuery<any[]>({
    queryKey: ["cxo-programs"],
    queryFn: async () => (await api.get("/skill-partners/analytics/programs")).data.data,
  });

  const { data: skills = [], isLoading: loadingSkills } = useQuery<any[]>({
    queryKey: ["cxo-skills"],
    queryFn: async () => (await api.get("/skill-partners/analytics/skills")).data.data,
  });

  const { data: trend = [], isLoading: loadingTrend } = useQuery<any[]>({
    queryKey: ["cxo-trend"],
    queryFn: async () => (await api.get("/skill-partners/analytics/trend")).data.data,
  });

  const completionRate = uplift?.total_enrollments > 0
    ? Math.round((uplift.completions / uplift.total_enrollments) * 100)
    : 0;

  // Pie chart data: program type distribution
  const programTypePie = programs.reduce((acc: any[], p: any) => {
    const existing = acc.find(x => x.name === p.program_type);
    if (existing) existing.value += p.enrollments;
    else acc.push({ name: p.program_type?.replace("_", " "), value: p.enrollments });
    return acc;
  }, []);

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <BarChart3 className="h-8 w-8 text-indigo-500" />
            <h1 className="text-3xl font-black text-slate-900">CXO Dashboard</h1>
          </div>
          <p className="text-sm text-slate-500 ml-11">
            Skill uplift, employability & program analytics · Welcome, {user?.name}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Last updated</p>
          <p className="text-sm font-bold text-slate-600">{new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      {loadingUplift ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array(8).fill(0).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 h-32 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Active Programs"     value={uplift?.active_programs ?? 0}    icon={GraduationCap} color="bg-indigo-50 text-indigo-600" />
          <StatCard label="Total Enrollments"   value={uplift?.total_enrollments ?? 0}  icon={Users}         color="bg-violet-50 text-violet-600" />
          <StatCard label="Completions"         value={uplift?.completions ?? 0}        icon={CheckCircle2}  color="bg-emerald-50 text-emerald-600" />
          <StatCard label="Completion Rate"     value={`${completionRate}%`}            icon={Target}        color="bg-amber-50 text-amber-600" sub="of enrollments completed" />
          <StatCard label="Avg Completion Score" value={uplift?.avg_completion_score ? `${uplift.avg_completion_score}%` : "—"} icon={Award} color="bg-rose-50 text-rose-600" />
          <StatCard label="Published Modules"   value={uplift?.published_modules ?? 0}  icon={BookOpen}      color="bg-cyan-50 text-cyan-600" />
          <StatCard label="Active Skills"       value={uplift?.active_skills ?? 0}      icon={Zap}           color="bg-fuchsia-50 text-fuchsia-600" />
          <StatCard label="Active Partners"     value={uplift?.active_partners ?? 0}    icon={Building2}     color="bg-teal-50 text-teal-600" />
        </div>
      )}

      {/* ── Enrollment Trend + Program Type Pie ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend Line Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-black text-slate-900">Enrollment Trend</h2>
              <p className="text-xs text-slate-400 mt-0.5">Last 6 months · enrollments vs completions</p>
            </div>
            <TrendingUp className="h-5 w-5 text-indigo-400" />
          </div>
          {loadingTrend ? (
            <div className="h-52 bg-slate-50 rounded-xl animate-pulse" />
          ) : trend.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-slate-300 font-bold text-sm">No enrollment data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={trend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
                <Line type="monotone" dataKey="enrollments" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 4, fill: "#6366f1" }} name="Enrollments" />
                <Line type="monotone" dataKey="completions" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4, fill: "#10b981" }} name="Completions" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Program Type Pie */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-black text-slate-900">By Program Type</h2>
              <p className="text-xs text-slate-400 mt-0.5">Enrollment distribution</p>
            </div>
          </div>
          {loadingPrograms ? (
            <div className="h-52 bg-slate-50 rounded-xl animate-pulse" />
          ) : programTypePie.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-slate-300 font-bold text-sm">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={programTypePie} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                  dataKey="value" paddingAngle={3}>
                  {programTypePie.map((_: any, i: number) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Top Programs + Employability ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Programs Bar Chart */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-black text-slate-900">Top Programs</h2>
              <p className="text-xs text-slate-400 mt-0.5">By enrollments & completions</p>
            </div>
            <GraduationCap className="h-5 w-5 text-indigo-400" />
          </div>
          {loadingPrograms ? (
            <div className="h-56 bg-slate-50 rounded-xl animate-pulse" />
          ) : programs.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-slate-300 font-bold text-sm">No programs yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={programs.slice(0, 6)} layout="vertical" margin={{ left: 0, right: 20, top: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10, fill: "#64748b" }} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
                <Bar dataKey="enrollments" fill="#6366f1" radius={[0, 4, 4, 0]} name="Enrolled" barSize={10} />
                <Bar dataKey="completions" fill="#10b981" radius={[0, 4, 4, 0]} name="Completed" barSize={10} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Employability Index per Campus */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-black text-slate-900">Employability Index</h2>
              <p className="text-xs text-slate-400 mt-0.5">Per campus · completion rate based</p>
            </div>
            <Building2 className="h-5 w-5 text-indigo-400" />
          </div>
          {loadingEmp ? (
            <div className="space-y-3">
              {Array(5).fill(0).map((_, i) => <div key={i} className="h-10 bg-slate-50 rounded-xl animate-pulse" />)}
            </div>
          ) : employability.filter((c: any) => c.student_count > 0).length === 0 ? (
            <div className="h-56 flex items-center justify-center text-slate-300 font-bold text-sm">No campus data yet</div>
          ) : (
            <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
              {employability.filter((c: any) => c.student_count > 0).map((c: any) => {
                const idx = Number(c.employability_index);
                const color = idx >= 70 ? "bg-emerald-500" : idx >= 40 ? "bg-amber-500" : "bg-red-400";
                return (
                  <div key={c.college_id}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-700 truncate max-w-[160px]">{c.college_name}</span>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>{c.enrolled_students} enrolled</span>
                        <span className="font-black text-slate-900">{idx}%</span>
                      </div>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${idx}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Program Detail Table + Top Skills ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Program Table */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-black text-slate-900">Program Performance</h2>
            <span className="text-xs text-slate-400">{programs.length} programs</span>
          </div>
          {loadingPrograms ? (
            <div className="p-6 space-y-3">
              {Array(5).fill(0).map((_, i) => <div key={i} className="h-10 bg-slate-50 rounded-xl animate-pulse" />)}
            </div>
          ) : programs.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-slate-300 font-bold text-sm">No programs yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-widest text-slate-400">Program</th>
                    <th className="text-center px-4 py-3 text-xs font-bold uppercase tracking-widest text-slate-400">Type</th>
                    <th className="text-center px-4 py-3 text-xs font-bold uppercase tracking-widest text-slate-400">Enrolled</th>
                    <th className="text-center px-4 py-3 text-xs font-bold uppercase tracking-widest text-slate-400">Completed</th>
                    <th className="text-center px-4 py-3 text-xs font-bold uppercase tracking-widest text-slate-400">Rate</th>
                    <th className="text-center px-4 py-3 text-xs font-bold uppercase tracking-widest text-slate-400">Avg Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {programs.map((p: any) => {
                    const rate = Number(p.completion_rate);
                    const rateColor = rate >= 70 ? "text-emerald-600" : rate >= 40 ? "text-amber-600" : "text-red-500";
                    return (
                      <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-3">
                          <p className="font-bold text-slate-900 truncate max-w-[200px]">{p.name}</p>
                          <p className="text-xs text-slate-400">{p.module_count} modules</p>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="px-2 py-1 rounded-full text-xs font-bold"
                            style={{ background: PROGRAM_TYPE_COLORS[p.program_type] + "20", color: PROGRAM_TYPE_COLORS[p.program_type] }}>
                            {p.program_type?.replace("_", " ")}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-slate-700">{p.enrollments}</td>
                        <td className="px-4 py-3 text-center font-bold text-emerald-600">{p.completions}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`font-black text-sm ${rateColor}`}>{rate}%</span>
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-slate-700">
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

        {/* Top Skills */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="font-black text-slate-900">Top Skills</h2>
            <p className="text-xs text-slate-400 mt-0.5">By student acquisition</p>
          </div>
          {loadingSkills ? (
            <div className="p-4 space-y-3">
              {Array(8).fill(0).map((_, i) => <div key={i} className="h-8 bg-slate-50 rounded-xl animate-pulse" />)}
            </div>
          ) : skills.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-slate-300 font-bold text-sm">No skill data yet</div>
          ) : (
            <div className="divide-y divide-slate-50 max-h-[420px] overflow-y-auto">
              {skills.map((s: any, i: number) => (
                <div key={s.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="text-xs font-black text-slate-300 w-5">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">{s.name}</p>
                    <p className="text-[10px] text-slate-400">{s.category_name}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${SKILL_LEVEL_COLOR[s.skill_level] || "bg-slate-100 text-slate-600"}`}>
                      {s.skill_level}
                    </span>
                    <p className="text-xs font-black text-slate-700 mt-0.5">{s.student_count} <span className="font-normal text-slate-400">students</span></p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
