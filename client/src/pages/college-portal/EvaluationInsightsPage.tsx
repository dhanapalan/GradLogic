/**
 * College/department evaluation rollup — published assessment outcomes with
 * an AI-generated summary. Faculty (instructor role) are auto-scoped to
 * their own department server-side; admins can pick any department.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, TrendingUp, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Select } from "../../components/ui/select";
import { Badge } from "../../components/ui/badge";
import campusEvaluationRollupService from "../../services/campusEvaluationRollupService";
import campusDepartmentsService from "../../services/campusDepartmentsService";
import { useAuthStore } from "../../stores/authStore";

function StatCard({ label, value, tone }: { label: string; value: string | number; tone?: "success" | "danger" }) {
  const color = tone === "success" ? "text-emerald-700" : tone === "danger" ? "text-rose-700" : "text-gray-900";
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 text-center">
      <p className={`text-2xl font-black tabular-nums ${color}`}>{value}</p>
      <p className="mt-1 text-[11px] uppercase tracking-wide text-gray-400">{label}</p>
    </div>
  );
}

export default function EvaluationInsightsPage() {
  const role = useAuthStore((s) => s.user?.role ?? "");
  const isFaculty = role === "instructor";
  const [department, setDepartment] = useState("");

  const { data: departments = [] } = useQuery({
    queryKey: ["campus-departments"],
    queryFn: () => campusDepartmentsService.list(),
    enabled: !isFaculty,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["evaluation-rollup", department],
    queryFn: () => campusEvaluationRollupService.get(department || undefined),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Evaluation Insights</h1>
          <p className="mt-1 text-sm text-gray-500">
            {isFaculty
              ? "Published assessment outcomes for your department"
              : "Published assessment outcomes across your campus"}
          </p>
        </div>
        {!isFaculty && (
          <Select value={department} onChange={(e) => setDepartment(e.target.value)} className="w-56">
            <option value="">Entire college</option>
            {departments.map((d) => (
              <option key={d.id} value={d.name}>
                {d.name}
              </option>
            ))}
          </Select>
        )}
      </div>

      {isLoading ? (
        <div className="h-64 animate-pulse rounded-2xl bg-gray-100" />
      ) : !data || data.summary.total_attempts === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-gray-500">
            No published assessment results yet for this scope.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Published Attempts" value={data.summary.total_attempts} />
            <StatCard label="Avg. Score" value={`${data.summary.avg_percentage}%`} />
            <StatCard label="Pass Rate" value={`${data.summary.pass_rate}%`} tone="success" />
            <StatCard label="At-Risk Students" value={data.summary.at_risk_count} tone="danger" />
          </div>

          {data.ai_summary && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="h-4 w-4 text-admin-accent" />
                  AI Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-gray-700">{data.ai_summary}</p>
              </CardContent>
            </Card>
          )}

          {!isFaculty && data.by_department.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="h-4 w-4" />
                  Department Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-lg border border-gray-100">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                      <tr>
                        <th className="px-4 py-2">Department</th>
                        <th className="px-4 py-2">Attempts</th>
                        <th className="px-4 py-2">Avg. Score</th>
                        <th className="px-4 py-2">Pass Rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {data.by_department.map((d) => (
                        <tr key={d.department}>
                          <td className="px-4 py-2 font-medium text-gray-900">{d.department}</td>
                          <td className="px-4 py-2 tabular-nums text-gray-600">{d.attempts}</td>
                          <td className="px-4 py-2 tabular-nums text-gray-600">{d.avg_percentage}%</td>
                          <td className="px-4 py-2 tabular-nums text-gray-600">{d.pass_rate}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4 text-rose-500" />
                At-Risk Students
              </CardTitle>
              <CardDescription>Averaging below 40% across published assessments</CardDescription>
            </CardHeader>
            <CardContent>
              {data.at_risk_students.length === 0 ? (
                <p className="flex items-center gap-2 py-4 text-sm text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  No at-risk students in this scope.
                </p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {data.at_risk_students.map((s) => (
                    <li key={s.user_id} className="flex items-center justify-between py-2 text-sm">
                      <span className="font-medium text-gray-900">{s.name}</span>
                      <Badge variant="danger">{s.avg_percentage}%</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
