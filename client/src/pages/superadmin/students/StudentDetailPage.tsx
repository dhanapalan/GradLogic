import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import StatusBadge from "../../../components/superadmin/StatusBadge";
import studentsService, { StudentDetail } from "../../../services/studentsService";

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<StudentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    studentsService
      .getStudentProfile(id)
      .then(setDetail)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="p-8">
        <div className="h-8 w-64 bg-gray-200 rounded animate-pulse" />
      </div>
    );
  }

  if (notFound || !detail) {
    return (
      <div className="p-8">
        <Link to="/app/superadmin/students" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-4">
          <ArrowLeftIcon className="w-4 h-4" />
          Back to Students
        </Link>
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-600">
          Student not found
        </div>
      </div>
    );
  }

  const { profile, examResults, certifications, moduleProgress } = detail;
  const avgScore =
    examResults.length > 0
      ? Math.round(examResults.reduce((sum, e) => sum + Number(e.final_score), 0) / examResults.length)
      : null;

  return (
    <div className="p-8">
      <Link to="/app/superadmin/students" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-4">
        <ArrowLeftIcon className="w-4 h-4" />
        Back to Students
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">{profile.name}</h2>
          <p className="text-gray-600 mt-1">
            {profile.email} {profile.college_name ? `· ${profile.college_name}` : ""}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {[profile.specialization, profile.passing_year ? `Batch ${profile.passing_year}` : null]
              .filter(Boolean)
              .join(" · ") || "No department/batch on file"}
          </p>
        </div>
        <StatusBadge status={profile.status} />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase">Avg Exam Score</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{avgScore !== null ? `${avgScore}%` : "N/A"}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase">CGPA</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{profile.cgpa ?? "N/A"}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase">Certifications</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{certifications.length}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase">Last Active</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {profile.last_login ? new Date(profile.last_login).toLocaleDateString() : "Never"}
          </p>
        </div>
      </div>

      {/* Profile details */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Profile</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-gray-500 uppercase">Student ID</p>
            <p className="text-sm font-medium text-gray-900">{profile.student_identifier || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase">Degree</p>
            <p className="text-sm font-medium text-gray-900">{profile.degree || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase">Percentage</p>
            <p className="text-sm font-medium text-gray-900">{profile.percentage ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase">LinkedIn</p>
            <p className="text-sm font-medium text-gray-900 truncate">{profile.linkedin_url || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase">GitHub</p>
            <p className="text-sm font-medium text-gray-900 truncate">{profile.github_url || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase">Registered</p>
            <p className="text-sm font-medium text-gray-900">{new Date(profile.created_at).toLocaleDateString()}</p>
          </div>
        </div>
      </div>

      {/* Exam results */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Exam Results ({examResults.length})</h3>
        {examResults.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-600">
            No exam attempts recorded yet
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Exam</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Score</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {examResults.map((exam) => (
                  <tr key={exam.id}>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{exam.title}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{exam.final_score}%</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{new Date(exam.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Learning progress */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Learning Progress ({moduleProgress.length})</h3>
        {moduleProgress.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-600">
            No learning modules started yet
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Module</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Score</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Completed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {moduleProgress.map((mp) => (
                  <tr key={mp.id}>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{mp.module_title}</td>
                    <td className="px-6 py-4">
                      <StatusBadge
                        status={mp.status === "completed" ? "active" : mp.status === "in_progress" ? "pending" : "inactive"}
                        label={mp.status.replace("_", " ")}
                        size="sm"
                      />
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{mp.score ?? "—"}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {mp.completed_at ? new Date(mp.completed_at).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Certifications */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Certifications ({certifications.length})</h3>
        {certifications.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-600">
            No certifications earned yet
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {certifications.map((cert) => (
              <div key={cert.id} className="bg-white rounded-lg border border-gray-200 p-4">
                <p className="font-medium text-gray-900">{cert.title}</p>
                <p className="text-sm text-gray-500 mt-1">
                  Issued {new Date(cert.issued_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
