/**
 * Faculty dashboard — department-scoped view for "instructor" role accounts.
 * The underlying /campus/students endpoint already restricts results to the
 * caller's department server-side (see resolveCallerDepartment in
 * campus.students.controller.ts) — this page just presents that data.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Users, TrendingUp, AlertTriangle, ShieldCheck } from "lucide-react";
import campusStudentsService from "../../services/campusStudentsService";
import { useAuthStore } from "../../stores/authStore";

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Users;
  label: string;
  value: string | number;
  tone: "indigo" | "emerald" | "amber" | "rose";
}) {
  const toneClass = {
    indigo: "bg-indigo-50 text-indigo-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    rose: "bg-rose-50 text-rose-600",
  }[tone];
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-4">
        <div className={`rounded-xl p-3 ${toneClass}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{label}</p>
          <p className="mt-1 text-2xl font-black leading-none text-slate-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

export default function FacultyDashboardPage() {
  const user = useAuthStore((s) => s.user);
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["faculty-students", page],
    queryFn: () => campusStudentsService.list({ page, limit: 20 }),
  });

  const rows = data?.data ?? [];
  const pagination = data?.pagination;

  const total = pagination?.total ?? rows.length;
  const avgScore = rows.length
    ? Math.round((rows.reduce((s, r) => s + (r.avg_score || 0), 0) / rows.length) * 10) / 10
    : 0;
  const highRisk = rows.filter((r) => r.risk_level === "High").length;
  const eligible = rows.filter((r) => r.eligible_for_hiring || r.placement_eligible).length;

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-8">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-slate-900">
          Welcome, {user?.name || "Faculty"}
        </h1>
        <p className="mt-1 font-medium text-slate-500">
          {user?.department ? (
            <>
              Showing student outcomes for <span className="font-bold text-slate-700">{user.department}</span>{" "}
              only
            </>
          ) : (
            "No department assigned — contact your college admin."
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        <StatCard icon={Users} label="Students" value={total} tone="indigo" />
        <StatCard icon={TrendingUp} label="Avg. Score (page)" value={`${avgScore}%`} tone="emerald" />
        <StatCard icon={ShieldCheck} label="Placement Eligible (page)" value={eligible} tone="emerald" />
        <StatCard icon={AlertTriangle} label="High Risk (page)" value={highRisk} tone="rose" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          to="/app/college-portal/question-bank"
          className="rounded-xl border border-slate-200 bg-white p-4 text-sm font-bold text-slate-700 shadow-sm hover:border-indigo-300 hover:bg-indigo-50/50"
        >
          Question Bank →
        </Link>
        <Link
          to="/app/college-portal/assessments"
          className="rounded-xl border border-slate-200 bg-white p-4 text-sm font-bold text-slate-700 shadow-sm hover:border-indigo-300 hover:bg-indigo-50/50"
        >
          Assessments →
        </Link>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-5">
          <h2 className="text-base font-black text-slate-900">Department Roster</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400">
                <th className="px-6 py-4 font-bold">Student</th>
                <th className="px-6 py-4 font-bold">Roll No.</th>
                <th className="px-6 py-4 font-bold text-center">Avg. Score</th>
                <th className="px-6 py-4 font-bold text-center">Risk</th>
                <th className="px-6 py-4 font-bold text-center">Placement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                    Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                    No students found in your department yet.
                  </td>
                </tr>
              ) : (
                rows.map((s) => (
                  <tr key={s.user_id} className="hover:bg-slate-50/50">
                    <td className="px-6 py-4 font-bold text-slate-900">{s.name}</td>
                    <td className="px-6 py-4 text-slate-600">{s.roll_number}</td>
                    <td className="px-6 py-4 text-center tabular-nums text-slate-700">
                      {s.avg_score?.toFixed(1) ?? "—"}%
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                          s.risk_level === "High"
                            ? "bg-rose-100 text-rose-700"
                            : s.risk_level === "Medium"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {s.risk_level}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center text-slate-600">{s.placement_status}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {pagination && pagination.pages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-6 py-3 text-xs text-slate-500">
            <span>
              Page {pagination.page} of {pagination.pages} · {pagination.total} students
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-lg border border-slate-200 px-3 py-1 font-bold disabled:opacity-40"
              >
                Prev
              </button>
              <button
                type="button"
                disabled={page >= pagination.pages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-slate-200 px-3 py-1 font-bold disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
