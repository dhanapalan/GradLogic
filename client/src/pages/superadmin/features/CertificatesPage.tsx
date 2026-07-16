// =============================================================================
// Assessment Hub · Certificates
// Practice / Course / Placement Track completion → simple PDF.
// =============================================================================

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  GraduationCap,
  Search,
  Loader2,
  Download,
  Plus,
  FlaskConical,
  BookOpen,
  Route,
  FileText,
  ArrowRight,
} from "lucide-react";
import toast from "react-hot-toast";
import certificatesService, {
  type CertType,
  type CertificateRow,
  type StudentHit,
} from "../../../services/certificatesService";

const GENERATE_TYPES: Array<{
  type: CertType;
  title: string;
  blurb: string;
  icon: typeof FlaskConical;
  accent: string;
}> = [
  {
    type: "practice_completion",
    title: "Practice Completion",
    blurb: "When a practice assessment attempt is completed.",
    icon: FlaskConical,
    accent: "bg-sky-50 text-sky-700",
  },
  {
    type: "course_completion",
    title: "Course Completion",
    blurb: "When course enrollment progress reaches 100%.",
    icon: BookOpen,
    accent: "bg-violet-50 text-violet-700",
  },
  {
    type: "placement_track_completion",
    title: "Placement Track Completion",
    blurb: "When a Learning Journey track hits completion or readiness ≥ 70%.",
    icon: Route,
    accent: "bg-emerald-50 text-emerald-700",
  },
];

const TYPE_LABEL: Record<string, string> = {
  practice_completion: "Practice",
  course_completion: "Course",
  placement_track_completion: "Placement Track",
};

function displayTitle(c: CertificateRow) {
  return c.title || c.course_title || c.path_title || c.drive_name || "Certificate";
}

export default function CertificatesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [generateType, setGenerateType] = useState<CertType>("practice_completion");
  const [studentQ, setStudentQ] = useState("");
  const [studentHits, setStudentHits] = useState<StudentHit[]>([]);
  const [student, setStudent] = useState<StudentHit | null>(null);
  const [driveId, setDriveId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [pathId, setPathId] = useState("");
  const [force, setForce] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (studentQ.trim().length < 2) {
      setStudentHits([]);
      return;
    }
    const t = setTimeout(() => {
      certificatesService
        .searchStudents(studentQ.trim())
        .then(setStudentHits)
        .catch(() => setStudentHits([]));
    }, 250);
    return () => clearTimeout(t);
  }, [studentQ]);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["assessment-hub-certificates", debounced, typeFilter],
    queryFn: () =>
      certificatesService.list({
        search: debounced || undefined,
        certType: typeFilter || undefined,
      }),
  });

  const { data: options } = useQuery({
    queryKey: ["assessment-hub-cert-options"],
    queryFn: () => certificatesService.options(),
  });

  const generate = useMutation({
    mutationFn: () => {
      if (!student) throw new Error("Select a student");
      return certificatesService.generate({
        cert_type: generateType,
        student_id: student.id,
        drive_id: generateType === "practice_completion" ? driveId || undefined : undefined,
        course_id: generateType === "course_completion" ? courseId || undefined : undefined,
        path_id:
          generateType === "placement_track_completion" ? pathId || undefined : undefined,
        force,
      });
    },
    onSuccess: async (cert) => {
      toast.success("Certificate issued");
      qc.invalidateQueries({ queryKey: ["assessment-hub-certificates"] });
      setShowForm(false);
      try {
        await certificatesService.downloadPdf(cert.id, `${displayTitle(cert)}.pdf`);
      } catch {
        toast.error("Issued, but PDF download failed — retry from the list.");
      }
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || err?.message || "Failed to issue certificate");
    },
  });

  const filteredMeta = useMemo(() => GENERATE_TYPES, []);

  return (
    <div className="min-h-full bg-slate-50/80">
      <div className="border-b border-gray-200/80 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 pb-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Assessment Hub · Credentials
          </p>
          <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 flex items-center gap-2">
                <GraduationCap className="w-6 h-6 text-navy-900" />
                Certificates
              </h1>
              <p className="mt-1 text-sm text-gray-500 max-w-2xl">
                Generate Practice, Course, and Placement Track completion certificates as a simple
                PDF.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-navy-900 px-4 py-2.5 text-sm font-medium text-white"
            >
              <Plus className="w-4 h-4" />
              Generate certificate
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-8">
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Generate</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {filteredMeta.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.type}
                  type="button"
                  onClick={() => {
                    setGenerateType(t.type);
                    setShowForm(true);
                  }}
                  className="text-left rounded-xl border border-gray-200/70 bg-white p-4 shadow-admin-card hover:border-navy-900/30 transition-colors"
                >
                  <div className={`inline-flex rounded-lg p-2.5 ${t.accent}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <p className="mt-3 text-sm font-semibold text-gray-900">{t.title}</p>
                  <p className="mt-1 text-xs text-gray-500">{t.blurb}</p>
                  <p className="mt-2 text-[11px] text-admin-accent inline-flex items-center gap-1">
                    <FileText className="w-3 h-3" /> Simple PDF
                  </p>
                </button>
              );
            })}
          </div>
        </section>

        {showForm ? (
          <section className="rounded-xl border border-gray-200/70 bg-white p-5 shadow-admin-card space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-gray-900">Issue certificate</h2>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-xs text-gray-500 hover:text-gray-800"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {GENERATE_TYPES.map((t) => (
                <button
                  key={t.type}
                  type="button"
                  onClick={() => setGenerateType(t.type)}
                  className={`rounded-lg border px-3 py-2 text-xs font-medium ${
                    generateType === t.type
                      ? "border-navy-900 bg-navy-900 text-white"
                      : "border-gray-200 text-gray-600"
                  }`}
                >
                  {t.title}
                </button>
              ))}
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600">Student</label>
              {student ? (
                <div className="mt-1 flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-sm">
                  <span>
                    {student.name}{" "}
                    <span className="text-gray-400 text-xs">({student.email})</span>
                  </span>
                  <button
                    type="button"
                    className="text-xs text-admin-accent"
                    onClick={() => setStudent(null)}
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div className="relative mt-1">
                  <input
                    value={studentQ}
                    onChange={(e) => setStudentQ(e.target.value)}
                    placeholder="Search by name or email…"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  />
                  {studentHits.length > 0 ? (
                    <ul className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-48 overflow-y-auto">
                      {studentHits.map((s) => (
                        <li key={s.id}>
                          <button
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                            onClick={() => {
                              setStudent(s);
                              setStudentQ("");
                              setStudentHits([]);
                            }}
                          >
                            {s.name}{" "}
                            <span className="text-xs text-gray-400">{s.email}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              )}
            </div>

            {generateType === "practice_completion" ? (
              <div>
                <label className="text-xs font-medium text-gray-600">Practice set</label>
                <select
                  value={driveId}
                  onChange={(e) => setDriveId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                >
                  <option value="">Select practice assessment…</option>
                  {(options?.practiceDrives || []).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
                <Link
                  to="/app/superadmin/practice-sets"
                  className="inline-flex items-center gap-1 mt-1 text-[11px] text-admin-accent hover:underline"
                >
                  Manage practice sets <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            ) : null}

            {generateType === "course_completion" ? (
              <div>
                <label className="text-xs font-medium text-gray-600">Course</label>
                <select
                  value={courseId}
                  onChange={(e) => setCourseId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                >
                  <option value="">Select course…</option>
                  {(options?.courses || []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {generateType === "placement_track_completion" ? (
              <div>
                <label className="text-xs font-medium text-gray-600">Placement track</label>
                <select
                  value={pathId}
                  onChange={(e) => setPathId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                >
                  <option value="">Select track…</option>
                  {(options?.tracks || []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                      {t.domain ? ` (${t.domain})` : ""}
                    </option>
                  ))}
                </select>
                <Link
                  to="/app/superadmin/learning-journey"
                  className="inline-flex items-center gap-1 mt-1 text-[11px] text-admin-accent hover:underline"
                >
                  AI Learning Journey <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            ) : null}

            <label className="flex items-center gap-2 text-xs text-gray-600">
              <input
                type="checkbox"
                checked={force}
                onChange={(e) => setForce(e.target.checked)}
                className="rounded border-gray-300"
              />
              Force issue (skip completion checks)
            </label>

            <button
              type="button"
              disabled={generate.isPending || !student}
              onClick={() => generate.mutate()}
              className="inline-flex items-center gap-2 rounded-lg bg-navy-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {generate.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
              Issue & download PDF
            </button>
          </section>
        ) : null}

        <section className="rounded-xl border border-gray-200/70 bg-white p-5 shadow-admin-card">
          <div className="flex flex-wrap gap-2 mb-4">
            <div className="relative flex-1 min-w-[12rem]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search student or certificate…"
                className="w-full rounded-lg border border-gray-200 pl-9 pr-3 py-2 text-sm"
              />
            </div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
            >
              <option value="">All types</option>
              {GENERATE_TYPES.map((t) => (
                <option key={t.type} value={t.type}>
                  {t.title}
                </option>
              ))}
            </select>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-16 text-gray-300">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 px-6 py-10 text-center">
              <p className="text-sm text-gray-500">No certificates issued yet.</p>
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="mt-3 text-sm text-admin-accent hover:underline"
              >
                Generate the first one
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-xs uppercase text-gray-500 border-b border-gray-100">
                  <tr>
                    <th className="px-2 py-2 font-medium">Student</th>
                    <th className="px-2 py-2 font-medium">Certificate</th>
                    <th className="px-2 py-2 font-medium">Type</th>
                    <th className="px-2 py-2 font-medium">Issued</th>
                    <th className="px-2 py-2 font-medium">PDF</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => (
                    <tr key={c.id} className="border-t border-gray-50">
                      <td className="px-2 py-3">
                        <div className="font-medium text-gray-900">{c.student_name}</div>
                        <div className="text-xs text-gray-500">{c.student_email}</div>
                      </td>
                      <td className="px-2 py-3 text-gray-700">{displayTitle(c)}</td>
                      <td className="px-2 py-3">
                        <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                          {TYPE_LABEL[c.cert_type || ""] || c.cert_type || "Course"}
                        </span>
                      </td>
                      <td className="px-2 py-3 text-gray-600 whitespace-nowrap">
                        {c.issued_at ? new Date(c.issued_at).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-2 py-3">
                        <button
                          type="button"
                          onClick={() =>
                            certificatesService
                              .downloadPdf(c.id, `${displayTitle(c)}.pdf`)
                              .catch(() => toast.error("PDF download failed"))
                          }
                          className="inline-flex items-center gap-1 text-xs text-admin-accent hover:underline"
                        >
                          <Download className="w-3.5 h-3.5" />
                          PDF
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <p className="text-xs text-gray-400">
          Pipeline: Completion event →{" "}
          <strong className="font-medium text-gray-500">Certificates</strong> → simple PDF
          (Practice / Course / Placement Track).
        </p>
      </div>
    </div>
  );
}
