import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ChartBarIcon,
  ArrowDownTrayIcon,
  FunnelIcon,
  AcademicCapIcon,
  BriefcaseIcon,
  AdjustmentsVerticalIcon
} from "@heroicons/react/24/outline";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend
} from "recharts";

const MOCK_DEPARTMENT_DATA = [
  { name: "Computer Science", employability: 85, skill_score: 82, students: 450 },
  { name: "Information Tech", employability: 82, skill_score: 79, students: 380 },
  { name: "Electronics", employability: 76, skill_score: 74, students: 320 },
  { name: "Mechanical", employability: 68, skill_score: 65, students: 290 },
  { name: "Civil", employability: 62, skill_score: 60, students: 210 },
];

const MOCK_SKILL_DISTRIBUTION = [
  { name: "Frontend Dev", value: 35, color: "#3b82f6" },
  { name: "Backend Dev", value: 25, color: "#8b5cf6" },
  { name: "Data Science", value: 20, color: "#10b981" },
  { name: "DevOps", value: 10, color: "#f59e0b" },
  { name: "Cybersecurity", value: 10, color: "#ef4444" },
];

const MOCK_GROWTH_TREND = [
  { month: "Jan", participation: 45, completion: 30 },
  { month: "Feb", participation: 52, completion: 38 },
  { month: "Mar", participation: 68, completion: 45 },
  { month: "Apr", participation: 75, completion: 56 },
  { month: "May", participation: 85, completion: 65 },
  { month: "Jun", participation: 92, completion: 78 },
];

export default function CollegeInsightsPage() {
  const [department, setDepartment] = useState("all");

  const { data: insights, isLoading } = useQuery({
    queryKey: ["college", "insights", department],
    queryFn: async () => {
      // Mocking the backend call
      // const res = await api.get(`/college/insights?dept=${department}`);
      // return res.data.data;
      return {
        departments: MOCK_DEPARTMENT_DATA,
        skills: MOCK_SKILL_DISTRIBUTION,
        trend: MOCK_GROWTH_TREND
      };
    }
  });

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-12">
      {/* ── Header ── */}
      <div className="bg-white border-b border-slate-200">
        <div className="px-8 py-6 max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">College Insights</h1>
            <p className="text-sm font-semibold text-slate-500 mt-1">Deep-dive into skill metrics and employability</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="appearance-none pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm"
              >
                <option value="all">All Departments</option>
                <option value="Computer Science">Computer Science</option>
                <option value="Information Tech">Information Technology</option>
                <option value="Electronics">Electronics</option>
              </select>
              <FunnelIcon className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
            </div>

            <button className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 border border-slate-200 shadow-sm transition-colors">
              <ArrowDownTrayIcon className="h-4 w-4" />
              Export Report
            </button>
          </div>
        </div>
      </div>

      <div className="p-8 max-w-7xl mx-auto space-y-8">
        
        {/* ── Top Level Context ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
            <AcademicCapIcon className="absolute -right-4 -bottom-4 h-32 w-32 text-indigo-500/30" />
            <h3 className="text-blue-100 font-bold text-sm mb-1 relative z-10">Total Enrolled</h3>
            <p className="text-3xl font-black relative z-10">1,650</p>
            <p className="text-xs font-bold text-blue-200 mt-2 bg-white/10 inline-block px-2 py-1 rounded-md relative z-10">+24% this semester</p>
          </div>
          
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
            <BriefcaseIcon className="absolute -right-4 -bottom-4 h-32 w-32 text-emerald-400/30" />
            <h3 className="text-emerald-100 font-bold text-sm mb-1 relative z-10">Avg. Employability Index</h3>
            <p className="text-3xl font-black relative z-10">72.4</p>
            <p className="text-xs font-bold text-emerald-200 mt-2 bg-white/10 inline-block px-2 py-1 rounded-md relative z-10">Top 15% nationally</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-center">
            <h3 className="text-slate-500 font-bold text-sm mb-1">Skill Program Completion</h3>
            <p className="text-3xl font-black text-slate-900">58%</p>
            <div className="w-full bg-slate-100 h-2 rounded-full mt-3">
              <div className="bg-blue-500 h-full rounded-full" style={{ width: '58%' }}></div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-center">
            <h3 className="text-slate-500 font-bold text-sm mb-1">Active Skill Assessments</h3>
            <p className="text-3xl font-black text-slate-900">12</p>
            <p className="text-xs font-bold text-slate-400 mt-2">Next due: Web Dev Fundamentals</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Department Comparison */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <AdjustmentsVerticalIcon className="h-5 w-5 text-indigo-500" strokeWidth={2} />
                Departmental Employability
              </h2>
            </div>
            <div className="h-72">
              {isLoading ? (
                <div className="h-full flex items-center justify-center text-slate-400 font-bold">Loading...</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={insights?.departments} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b', fontWeight: 600 }} />
                    <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }} />
                    <Bar dataKey="employability" name="Employability Index" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="skill_score" name="Avg Skill Score" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Skill Distribution */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <ChartBarIcon className="h-5 w-5 text-emerald-500" strokeWidth={2} />
                Skill Distribution
              </h2>
            </div>
            <div className="h-72 flex items-center">
              {isLoading ? (
                <div className="w-full text-center text-slate-400 font-bold">Loading...</div>
              ) : (
                <>
                  <div className="w-1/2 h-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={insights?.skills}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {insights?.skills.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="w-1/2 pl-4 flex flex-col justify-center space-y-4">
                    {insights?.skills.map((skill: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between">
                        <div className="flex items-center gap-2 relative">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: skill.color }}></div>
                          <span className="text-sm font-bold text-slate-700">{skill.name}</span>
                        </div>
                        <span className="text-sm font-black text-slate-900">{skill.value}%</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Learning Trajectory */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <AcademicCapIcon className="h-5 w-5 text-blue-500" strokeWidth={2} />
              Skill Program Participation & Completion Trend
            </h2>
          </div>
          <div className="h-80">
            {isLoading ? (
              <div className="h-full flex items-center justify-center text-slate-400 font-bold">Loading...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={insights?.trend} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b', fontWeight: 600 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b', fontWeight: 600 }} />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }} />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontWeight: 'bold', fontSize: '13px' }} />
                  <Line type="monotone" name="Participation (%)" dataKey="participation" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6, strokeWidth: 0 }} />
                  <Line type="monotone" name="Completion Rate (%)" dataKey="completion" stroke="#10b981" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6, strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
