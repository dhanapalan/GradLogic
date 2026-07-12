import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  UserGroupIcon,
  AcademicCapIcon,
  ClipboardDocumentListIcon,
  ChartBarIcon,
  ArrowDownTrayIcon,
} from "@heroicons/react/24/outline";
import toast from "react-hot-toast";
import analyticsService, {
  PlatformAnalytics,
  CollegeAnalytics,
  StudentPerformance,
} from "../../../services/analyticsService";
import StatusBadge from "../../../components/superadmin/StatusBadge";
import ChartCard from "../../../components/superadmin/ChartCard";

type View = "platform" | "colleges" | "reports";

const VIEW_TITLES: Record<View, { title: string; subtitle: string }> = {
  platform: { title: "Platform Overview", subtitle: "Usage and growth across the whole platform" },
  colleges: { title: "College Performance", subtitle: "Engagement and results per college" },
  reports: { title: "Reports", subtitle: "Download platform data as CSV" },
};

function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers, ...rows].map((r) => r.map(escape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AnalyticsPage() {
  const [searchParams] = useSearchParams();
  const view: View = (searchParams.get("view") as View) || "platform";

  const [days, setDays] = useState(30);
  const [collegeId, setCollegeId] = useState("");
  const [platform, setPlatform] = useState<PlatformAnalytics | null>(null);
  const [colleges, setColleges] = useState<CollegeAnalytics[]>([]);
  const [students, setStudents] = useState<StudentPerformance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        // The colleges list doubles as the filter's options, so it's always needed.
        setColleges(await analyticsService.getColleges());
        if (view === "platform" || view === "reports") {
          setPlatform(await analyticsService.getPlatform(days, collegeId || undefined));
        }
        if (view === "reports") {
          setStudents(await analyticsService.getStudentPerformance(collegeId || undefined));
        }
      } catch (error) {
        toast.error("Failed to load analytics");
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [view, days, collegeId]);

  const meta = VIEW_TITLES[view] || VIEW_TITLES.platform;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold tracking-tight text-gray-900">{meta.title}</h2>
        <p className="text-gray-500 mt-1">{meta.subtitle}</p>
      </div>

      {loading ? (
        <div className="p-12 text-center text-gray-600">Loading analytics...</div>
      ) : view === "colleges" ? (
        <CollegesView colleges={colleges} />
      ) : view === "reports" ? (
        <ReportsView platform={platform} colleges={colleges} students={students} />
      ) : (
        <PlatformView
          platform={platform}
          days={days}
          setDays={setDays}
          collegeId={collegeId}
          setCollegeId={setCollegeId}
          colleges={colleges}
        />
      )}
    </div>
  );
}

function PlatformView({
  platform,
  days,
  setDays,
  collegeId,
  setCollegeId,
  colleges,
}: {
  platform: PlatformAnalytics | null;
  days: number;
  setDays: (d: number) => void;
  collegeId: string;
  setCollegeId: (id: string) => void;
  colleges: CollegeAnalytics[];
}) {
  const s = platform?.summary;
  const cards = [
    { title: "Total Users", value: s?.total_users, icon: UserGroupIcon, color: "text-blue-600 bg-blue-50" },
    { title: "Active Users", value: s?.active_users, icon: UserGroupIcon, color: "text-green-600 bg-green-50" },
    { title: "Colleges", value: s?.total_colleges, icon: AcademicCapIcon, color: "text-purple-600 bg-purple-50" },
    { title: "Questions", value: s?.total_questions, icon: ClipboardDocumentListIcon, color: "text-orange-600 bg-orange-50" },
    { title: "Exam Attempts", value: s?.total_attempts, icon: ChartBarIcon, color: "text-cyan-600 bg-cyan-50" },
    { title: "Average Score", value: s?.avg_score, icon: ChartBarIcon, color: "text-pink-600 bg-pink-50" },
  ];

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {[7, 30, 90, 365].map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              days === d
                ? "bg-navy-900 text-white"
                : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
          >
            Last {d} days
          </button>
        ))}
        <select
          value={collegeId}
          onChange={(e) => setCollegeId(e.target.value)}
          className="ml-auto px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-admin-accent"
        >
          <option value="">All Colleges</option>
          {colleges.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.title} className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">{card.title}</p>
                  <p className="text-2xl font-display font-semibold text-gray-900 mt-1">{card.value ?? 0}</p>
                </div>
                <div className={`rounded-lg p-2 ${card.color}`}>
                  <Icon className="w-6 h-6" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ChartCard
          title={`New Users (last ${days} days)`}
          data={(platform?.users_growth || []).map((r) => ({
            label: r.date,
            value: Number(r.new_users),
          }))}
        />
        <ChartCard
          title={`Exam Attempts (last ${days} days)`}
          data={(platform?.attempts_trend || []).map((r) => ({
            label: r.date,
            value: Number(r.attempts),
          }))}
        />
        <ChartCard
          title="Questions by Category"
          data={(platform?.questions_by_category || []).map((r) => ({
            label: r.category.replace(/_/g, " "),
            value: Number(r.count),
          }))}
        />
      </div>
    </>
  );
}

function CollegesView({ colleges }: { colleges: CollegeAnalytics[] }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card overflow-hidden">
      {colleges.length === 0 ? (
        <div className="p-12 text-center text-gray-600">No colleges found</div>
      ) : (
        <table className="w-full">
          <thead className="bg-gray-50/70 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">College</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
              <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Students</th>
              <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Attempts</th>
              <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Avg Score</th>
              <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Paid Students</th>
              <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Fees Collected</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {colleges.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm font-medium text-gray-900">{c.name}</td>
                <td className="px-6 py-4 text-sm">
                  <StatusBadge status={c.status || "pending"} size="sm" label={c.status || "pending"} />
                </td>
                <td className="px-6 py-4 text-sm text-right text-gray-600">{c.student_count}</td>
                <td className="px-6 py-4 text-sm text-right text-gray-600">{c.attempts}</td>
                <td className="px-6 py-4 text-sm text-right text-gray-600">{c.avg_score}</td>
                <td className="px-6 py-4 text-sm text-right text-gray-600">{c.paid_students}</td>
                <td className="px-6 py-4 text-sm text-right font-medium text-gray-900">
                  ₹{Number(c.collected).toLocaleString("en-IN")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function ReportsView({
  platform,
  colleges,
  students,
}: {
  platform: PlatformAnalytics | null;
  colleges: CollegeAnalytics[];
  students: StudentPerformance[];
}) {
  const reports = [
    {
      name: "Student Performance",
      description: "Per-student exams taken, average score, and last exam date across all colleges.",
      disabled: students.length === 0,
      onDownload: () =>
        downloadCsv(
          "student-performance.csv",
          ["Student", "Email", "College", "Exams Taken", "Avg Score", "Last Exam"],
          students.map((s) => [
            s.name,
            s.email,
            s.college_name || "",
            s.exams_taken,
            s.avg_score,
            s.last_exam_at ? new Date(s.last_exam_at).toLocaleDateString() : "",
          ])
        ),
    },
    {
      name: "Question Usage",
      description: "Question bank distribution per category.",
      disabled: !platform || platform.questions_by_category.length === 0,
      onDownload: () =>
        downloadCsv(
          "question-usage.csv",
          ["Category", "Questions"],
          platform!.questions_by_category.map((r) => [r.category, r.count])
        ),
    },
    {
      name: "College Comparison",
      description: "Per-college students, attempts, average score and fees collected.",
      disabled: colleges.length === 0,
      onDownload: () =>
        downloadCsv(
          "college-comparison.csv",
          ["College", "Status", "Students", "Attempts", "Avg Score", "Paid Students", "Collected (INR)"],
          colleges.map((c) => [
            c.name, c.status, c.student_count, c.attempts, c.avg_score, c.paid_students, c.collected,
          ])
        ),
    },
    {
      name: "Platform Summary",
      description: "Headline totals: users, colleges, questions, attempts, scores.",
      disabled: !platform,
      onDownload: () => {
        const s = platform!.summary;
        downloadCsv(
          "platform-summary.csv",
          ["Metric", "Value"],
          Object.entries(s).map(([k, v]) => [k.replace(/_/g, " "), String(v)])
        );
      },
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {reports.map((r) => (
        <div key={r.name} className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-6 flex flex-col">
          <h3 className="font-semibold text-gray-900">{r.name}</h3>
          <p className="text-sm text-gray-600 mt-1 flex-1">{r.description}</p>
          <button
            onClick={r.onDownload}
            disabled={r.disabled}
            className="mt-4 flex items-center justify-center gap-2 px-4 py-2 bg-navy-900 text-white rounded-lg text-sm font-medium hover:bg-navy-800 disabled:opacity-50"
          >
            <ArrowDownTrayIcon className="w-4 h-4" />
            Download CSV
          </button>
        </div>
      ))}
    </div>
  );
}
