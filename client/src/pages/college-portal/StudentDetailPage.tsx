/**
 * Sprint 2.1 — Student Details (read-only profile foundation).
 * Tabs: Overview · Academic · Placement · Documents (Sprint 2.4).
 */
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Edit2,
  Mail,
  Phone,
  Hash,
  User,
  Building2,
  GraduationCap,
  Calendar,
  Layers,
  BookOpen,
  Briefcase,
  Gauge,
  ShieldAlert,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import StudentDocumentsPanel from "../../components/college-portal/StudentDocumentsPanel";
import StudentEligibilityPanel from "../../components/college-portal/StudentEligibilityPanel";
import campusStudentsService, {
  type PlacementStatus,
  type RiskLevel,
  type StudentOverview,
} from "../../services/campusStudentsService";
import { formatCourseYears } from "../../lib/courseYears";
import { useAuthStore } from "../../stores/authStore";

type DetailTab = "overview" | "academic" | "placement" | "documents";

const TABS: { id: DetailTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "academic", label: "Academic" },
  { id: "placement", label: "Placement" },
  { id: "documents", label: "Documents" },
];

function placementVariant(status: PlacementStatus): "muted" | "info" | "success" | "warning" {
  if (status === "Joined" || status === "Offered") return "success";
  if (status === "Shortlisted" || status === "Interviewed") return "info";
  if (status === "Not Shortlisted") return "muted";
  return "warning";
}

function riskVariant(level: RiskLevel): "success" | "warning" | "danger" {
  if (level === "High") return "danger";
  if (level === "Medium") return "warning";
  return "success";
}

function formatGender(g: string | null | undefined) {
  if (!g) return "—";
  return g.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function canManageStudents(role: string) {
  return ["college_admin", "college", "college_staff", "super_admin", "hr"].includes(
    role.toLowerCase()
  );
}

function canEditStudent(role: string) {
  return ["college_admin", "college", "placement_cell", "super_admin", "hr"].includes(
    role.toLowerCase()
  );
}

export default function CollegePortalStudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.user?.role ?? "");
  const [tab, setTab] = useState<DetailTab>("overview");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["college-portal-student", id],
    queryFn: () => campusStudentsService.get(id!),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="h-64 animate-pulse rounded-2xl bg-gray-100" />
      </div>
    );
  }

  if (isError || !data?.overview) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-8 sm:px-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-admin-accent"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <p className="text-center text-gray-500">Student not found or access denied.</p>
      </div>
    );
  }

  const s = data.overview;
  const showEdit = canEditStudent(role);
  const listHref = canManageStudents(role)
    ? "/app/college-portal/students"
    : role === "instructor"
      ? "/app/faculty-dashboard"
      : "/app/placement-cell-dashboard";

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      {/* Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate(listHref)}
          className="flex items-center gap-2 text-sm font-medium text-gray-500 transition-colors hover:text-admin-accent"
        >
          <ArrowLeft className="h-4 w-4" />{" "}
          {canManageStudents(role) ? "Back to Student List" : "Back to Dashboard"}
        </button>
        {showEdit && (
          <Link to={`/app/college-portal/students/${s.user_id}/edit`}>
            <Button variant="outline" size="sm" type="button">
              <Edit2 className="h-4 w-4" /> Edit Student
            </Button>
          </Link>
        )}
      </div>

      {/* Profile header */}
      <Card>
        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
          <StudentPhoto name={s.name} photoUrl={s.photo_url} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold text-gray-900">{s.name}</h1>
              <Badge variant={s.is_active ? "success" : "muted"}>
                {s.is_active ? "Active" : "Suspended"}
              </Badge>
            </div>
            <p className="mt-0.5 truncate text-sm text-gray-500">{s.email}</p>
            <p className="mt-1 text-xs text-gray-400">
              {[s.roll_number, s.department, s.program].filter(Boolean).join(" · ") || "—"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={placementVariant(s.placement_status)}>{s.placement_status}</Badge>
            <Badge variant={riskVariant(s.risk_level)}>{s.risk_level} risk</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Tabs — ready for future expansion */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-1 overflow-x-auto" aria-label="Student detail tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                tab === t.id
                  ? "border-admin-accent text-admin-accent"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {tab === "overview" && <OverviewTab student={s} />}
      {tab === "academic" && <AcademicTab student={s} />}
      {tab === "placement" && (
        <PlacementTab student={s} studentId={s.user_id} canWrite={showEdit} />
      )}
      {tab === "documents" && (
        <StudentDocumentsPanel studentId={s.user_id} canWrite={showEdit} />
      )}
    </div>
  );
}

function StudentPhoto({ name, photoUrl }: { name: string; photoUrl: string | null }) {
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        className="h-20 w-20 shrink-0 rounded-full border border-gray-200 object-cover"
      />
    );
  }
  return (
    <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-admin-accent/10 text-lg font-semibold text-admin-accent">
      {initials(name)}
    </div>
  );
}

function OverviewTab({ student: s }: { student: StudentOverview }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Field icon={User} label="Full Name" value={s.name} />
          <Field icon={Hash} label="Roll Number" value={s.roll_number} />
          <Field icon={Hash} label="Register Number" value={s.register_number} />
          <Field icon={Mail} label="Email" value={s.email} />
          <Field icon={Phone} label="Mobile" value={s.phone_number} />
          <Field icon={User} label="Gender" value={formatGender(s.gender)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">At a glance</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Field icon={Building2} label="Department" value={s.department} />
          <Field icon={GraduationCap} label="Program" value={s.program || s.degree} />
          <Field
            icon={Briefcase}
            label="Placement Status"
            value={<Badge variant={placementVariant(s.placement_status)}>{s.placement_status}</Badge>}
          />
          <Field
            icon={Gauge}
            label="Readiness Score"
            value={
              s.readiness_score != null ? s.readiness_score.toFixed(1) : "—"
            }
          />
          <Field
            icon={ShieldAlert}
            label="Risk Level"
            value={<Badge variant={riskVariant(s.risk_level)}>{s.risk_level}</Badge>}
          />
          <Field
            icon={GraduationCap}
            label="CGPA"
            value={s.cgpa != null ? s.cgpa.toFixed(2) : "—"}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function AcademicTab({ student: s }: { student: StudentOverview }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Academic Information</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field icon={Building2} label="Department" value={s.department} />
        <Field icon={GraduationCap} label="Program" value={s.program || s.degree} />
        <Field
          icon={Calendar}
          label="Academic Year"
          value={
            s.academic_year != null || s.passing_year != null
              ? formatCourseYears(s.program || s.degree, s.academic_year ?? s.passing_year)
              : "—"
          }
        />
        <Field icon={Layers} label="Batch" value={s.batch} />
        <Field icon={BookOpen} label="Semester" value={s.semester} />
        <Field icon={Hash} label="Section" value={s.section} />
        <Field
          icon={GraduationCap}
          label="CGPA"
          value={s.cgpa != null ? s.cgpa.toFixed(2) : "—"}
        />
      </CardContent>
    </Card>
  );
}

function PlacementTab({
  student: s,
  studentId,
  canWrite,
}: {
  student: StudentOverview;
  studentId: string;
  canWrite: boolean;
}) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Placement Information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <Field
            icon={Briefcase}
            label="Placement Status"
            value={
              <Badge variant={placementVariant(s.placement_status)}>{s.placement_status}</Badge>
            }
          />
          <Field
            icon={Gauge}
            label="Readiness Score"
            value={s.readiness_score != null ? s.readiness_score.toFixed(1) : "—"}
          />
          <Field
            icon={ShieldAlert}
            label="Risk Level"
            value={<Badge variant={riskVariant(s.risk_level)}>{s.risk_level}</Badge>}
          />
          <Field
            icon={Briefcase}
            label="Placement Eligible"
            value={
              <Badge variant={s.placement_eligible ? "success" : "danger"}>
                {s.placement_eligible ? "Eligible" : "Not Eligible"}
              </Badge>
            }
          />
        </CardContent>
      </Card>
      <StudentEligibilityPanel studentId={studentId} canWrite={canWrite} />
    </div>
  );
}

function Field({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Mail;
  label: string;
  value: React.ReactNode;
}) {
  const display = value == null || value === "" ? "—" : value;
  return (
    <div className="flex items-start gap-3 rounded-lg border border-gray-100 p-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
      <div className="min-w-0 flex-1">
        <div className="text-[11px] uppercase tracking-wide text-gray-400">{label}</div>
        <div className="mt-0.5 text-sm font-medium text-gray-900">{display}</div>
      </div>
    </div>
  );
}
