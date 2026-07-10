import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  ArrowLeft, Mail, Hash, Building2, GraduationCap, Calendar,
  Edit2, Save, X, ShieldCheck, ClipboardList, AlertTriangle,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "../../components/ui/table";
import campusStudentsService, {
  type PlacementStatus, type RiskLevel, type UpdateStudentPayload,
} from "../../services/campusStudentsService";

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

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

export default function CollegePortalStudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<UpdateStudentPayload>({});

  const { data, isLoading } = useQuery({
    queryKey: ["college-portal-student", id],
    queryFn: () => campusStudentsService.get(id!),
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: (payload: UpdateStudentPayload) => campusStudentsService.update(id!, payload),
    onSuccess: () => {
      toast.success("Student updated");
      queryClient.invalidateQueries({ queryKey: ["college-portal-student", id] });
      queryClient.invalidateQueries({ queryKey: ["college-portal-students"] });
      queryClient.invalidateQueries({ queryKey: ["college-portal-students-analytics"] });
      setIsEditing(false);
    },
    onError: () => toast.error("Failed to update student"),
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="h-64 animate-pulse rounded-2xl bg-gray-100" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 text-center text-gray-500">
        Student not found.
      </div>
    );
  }

  const { overview, assessments, violations } = data;

  const startEdit = () => {
    setForm({
      placement_status: overview.placement_status,
      risk_level: overview.risk_level,
      phone_number: overview.phone_number ?? "",
      degree: overview.degree ?? "",
      specialization: overview.specialization ?? "",
      passing_year: overview.passing_year ?? undefined,
      cgpa: overview.cgpa ?? undefined,
    });
    setIsEditing(true);
  };

  const save = () => updateMutation.mutate(form);

  const avgAssessmentScore =
    assessments.length > 0
      ? Math.round(assessments.reduce((a, x) => a + Number(x.score || 0), 0) / assessments.length)
      : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate("/app/college-portal/students")}
          className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-admin-accent transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Students
        </button>
        {isEditing ? (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsEditing(false)}>
              <X className="h-4 w-4" /> Cancel
            </Button>
            <Button size="sm" type="button" onClick={save} disabled={updateMutation.isPending}>
              <Save className="h-4 w-4" /> {updateMutation.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" type="button" onClick={startEdit}>
            <Edit2 className="h-4 w-4" /> Edit Student
          </Button>
        )}
      </div>

      {/* Identity card */}
      <Card>
        <CardContent className="p-6 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-admin-accent/10 text-lg font-semibold text-admin-accent">
            {initials(overview.name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-semibold text-gray-900">{overview.name}</h1>
              <Badge variant={overview.is_active ? "success" : "muted"}>
                {overview.is_active ? "Active" : "Suspended"}
              </Badge>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">{overview.email}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {isEditing ? (
              <select
                value={form.placement_status}
                onChange={(e) => setForm((f) => ({ ...f, placement_status: e.target.value as PlacementStatus }))}
                className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium"
              >
                {["Not Shortlisted", "Shortlisted", "Interviewed", "Offered", "Joined"].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            ) : (
              <Badge variant={placementVariant(overview.placement_status)}>{overview.placement_status}</Badge>
            )}
            {isEditing ? (
              <select
                value={form.risk_level}
                onChange={(e) => setForm((f) => ({ ...f, risk_level: e.target.value as RiskLevel }))}
                className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium"
              >
                {["Low", "Medium", "High"].map((r) => (
                  <option key={r} value={r}>{r} risk</option>
                ))}
              </select>
            ) : (
              <Badge variant={riskVariant(overview.risk_level)}>{overview.risk_level} risk</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stat tiles */}
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{overview.cgpa?.toFixed(2) ?? "—"}</p>
          <p className="text-xs text-gray-500 mt-1">CGPA</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{avgAssessmentScore != null ? `${avgAssessmentScore}%` : "—"}</p>
          <p className="text-xs text-gray-500 mt-1">Avg Assessment Score</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{overview.avg_integrity?.toFixed(0) ?? "—"}%</p>
          <p className="text-xs text-gray-500 mt-1">Integrity Score</p>
        </CardContent></Card>
      </div>

      {/* Academic details */}
      <Card>
        <CardHeader><CardTitle>Academic Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field icon={Building2} label="Department" value={overview.department} />
          <Field
            icon={GraduationCap}
            label="Degree"
            value={isEditing ? (
              <input
                value={form.degree ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, degree: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm"
              />
            ) : overview.degree || "—"}
          />
          <Field
            icon={Hash}
            label="Specialization"
            value={isEditing ? (
              <input
                value={form.specialization ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, specialization: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm"
              />
            ) : overview.specialization || "—"}
          />
          <Field
            icon={Calendar}
            label="Passing Year"
            value={isEditing ? (
              <input
                type="number"
                value={form.passing_year ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, passing_year: Number(e.target.value) }))}
                className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm"
              />
            ) : overview.passing_year || "—"}
          />
          <Field
            icon={GraduationCap}
            label="CGPA"
            value={isEditing ? (
              <input
                type="number"
                step="0.01"
                value={form.cgpa ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, cgpa: Number(e.target.value) }))}
                className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm"
              />
            ) : overview.cgpa?.toFixed(2) || "—"}
          />
          <Field
            icon={Mail}
            label="Phone"
            value={isEditing ? (
              <input
                value={form.phone_number ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, phone_number: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm"
              />
            ) : overview.phone_number || "—"}
          />
        </CardContent>
      </Card>

      {isEditing && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 flex items-center justify-between">
          <span className="text-sm text-gray-600">Account status</span>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              checked={form.is_active ?? overview.is_active}
              onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
              className="rounded border-gray-300"
            />
            Active
          </label>
        </div>
      )}

      {/* Assessments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ClipboardList className="h-4 w-4" /> Assessments</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {assessments.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-gray-500">No assessments taken yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Exam</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assessments.map((a) => (
                  <TableRow key={a.drive_id}>
                    <TableCell className="font-medium text-gray-900">{a.title}</TableCell>
                    <TableCell className="text-gray-500">{new Date(a.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right font-semibold">{Number(a.score).toFixed(1)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Integrity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Integrity & Proctoring</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {violations.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-gray-500">No integrity violations recorded.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Violation</TableHead>
                  <TableHead>When</TableHead>
                  <TableHead className="text-right">Risk Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {violations.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="flex items-center gap-2 font-medium text-gray-900">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> {v.violation_type}
                    </TableCell>
                    <TableCell className="text-gray-500">{new Date(v.timestamp).toLocaleString()}</TableCell>
                    <TableCell className="text-right font-semibold">{v.risk_score}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-gray-100 p-3">
      <Icon className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-[11px] text-gray-400 uppercase tracking-wide">{label}</div>
        <div className="text-sm font-medium text-gray-900 mt-0.5">{value}</div>
      </div>
    </div>
  );
}
