import { useEffect, useState } from "react";
import { BarChart3, Loader2, Mic, Users } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../../lib/api";
import superadminFeaturesService from "../../../services/superadminFeaturesService";
import { EmptyState, PageHeader, StatTile } from "./FeatureUi";

export function LearningAnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    superadminFeaturesService
      .learningAnalytics()
      .then(setData)
      .catch(() => toast.error("Failed to load learning analytics"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-300" /></div>;
  if (!data) return <div className="p-6 text-sm text-red-600">Could not load learning analytics.</div>;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <PageHeader icon={BarChart3} title="Learning Analytics" description="Practice engagement and knowledge coverage." />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatTile label="Practice sessions" value={data.practice?.sessions ?? 0} />
        <StatTile label="Practice minutes" value={Math.round(data.practice?.minutes ?? 0)} />
        <StatTile label="Categories covered" value={(data.questionCoverage || []).length} />
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-semibold mb-3">Question coverage</h2>
          {(data.questionCoverage || []).length === 0 ? (
            <p className="text-sm text-gray-400">No data</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {data.questionCoverage.map((c: any) => (
                <li key={c.category} className="flex justify-between"><span className="capitalize">{String(c.category).replace(/_/g, " ")}</span><span>{c.questions}</span></li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-semibold mb-3">Lesson coverage</h2>
          {(data.lessonCoverage || []).length === 0 ? (
            <p className="text-sm text-gray-400">No data</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {data.lessonCoverage.map((c: any) => (
                <li key={c.category} className="flex justify-between"><span className="capitalize">{String(c.category).replace(/_/g, " ")}</span><span>{c.lessons}</span></li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export function StudentAnalyticsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/analytics/readiness").then((r) => r.data?.data || []).catch(() => []),
      api.get("/analytics/cohort").then((r) => r.data?.data || null).catch(() => null),
    ])
      .then(([readiness]) => {
        setRows(Array.isArray(readiness) ? readiness : readiness?.students || []);
      })
      .catch(() => toast.error("Failed to load student analytics"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
      <PageHeader icon={Users} title="Student Analytics" description="Readiness and intervention signals by student." />
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-300" /></div>
      ) : rows.length === 0 ? (
        <EmptyState message="No student readiness data yet." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Score / readiness</th>
                <th className="px-4 py-3">Details</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 100).map((r, i) => (
                <tr key={r.student_id || r.id || i} className="border-t border-gray-100">
                  <td className="px-4 py-3 font-medium text-gray-900">{r.student_name || r.name || r.email || "Student"}</td>
                  <td className="px-4 py-3 text-gray-700">
                    {r.readiness_score ?? r.score ?? r.avg_score ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {r.college_name || r.status || JSON.stringify(r).slice(0, 80)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function CourseAnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    superadminFeaturesService
      .courseAnalytics()
      .then(setData)
      .catch(() => toast.error("Failed to load course analytics"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-300" /></div>;
  if (!data) return <div className="p-6 text-sm text-red-600">Could not load course analytics.</div>;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <PageHeader icon={BarChart3} title="Course Analytics" description="Enrollment, progress, and completion by course." />
      <div className="grid grid-cols-3 gap-3">
        <StatTile label="Courses" value={data.totals?.courses ?? 0} />
        <StatTile label="Enrollments" value={data.totals?.enrollments ?? 0} />
        <StatTile label="Completions" value={data.totals?.completions ?? 0} />
      </div>
      {(data.courses || []).length === 0 ? (
        <EmptyState message="No course activity yet." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Course</th>
                <th className="px-4 py-3">Enrollments</th>
                <th className="px-4 py-3">Avg progress</th>
                <th className="px-4 py-3">Completions</th>
              </tr>
            </thead>
            <tbody>
              {data.courses.map((c: any) => (
                <tr key={c.id} className="border-t border-gray-100">
                  <td className="px-4 py-3 font-medium text-gray-900">{c.title}</td>
                  <td className="px-4 py-3">{c.enrollments}</td>
                  <td className="px-4 py-3">{Math.round(c.avg_progress || 0)}%</td>
                  <td className="px-4 py-3">{c.completions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function VoiceAnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    superadminFeaturesService
      .voiceAnalytics()
      .then(setData)
      .catch(() => toast.error("Failed to load voice analytics"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-300" /></div>;
  if (!data) return <div className="p-6 text-sm text-red-600">Could not load voice analytics.</div>;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <PageHeader icon={Mic} title="Voice Analytics" description="Voice tutor and mock-interview usage." />
      <div className="grid grid-cols-2 gap-3">
        <StatTile label="AI events" value={data.totals?.events ?? 0} />
        <StatTile label="Voice events" value={data.totals?.voiceEvents ?? 0} />
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-semibold mb-3">By feature</h2>
          {(data.byFeature || []).length === 0 ? <p className="text-sm text-gray-400">No voice usage yet.</p> : (
            <ul className="space-y-2 text-sm">
              {data.byFeature.map((f: any) => (
                <li key={f.feature} className="flex justify-between"><span>{f.feature}</span><span>{f.count}</span></li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-semibold mb-3">Mock interviews by status</h2>
          {(data.interviews || []).length === 0 ? <p className="text-sm text-gray-400">No interviews yet.</p> : (
            <ul className="space-y-2 text-sm">
              {data.interviews.map((f: any) => (
                <li key={f.status} className="flex justify-between"><span className="capitalize">{f.status}</span><span>{f.count}</span></li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
