/**
 * Phase 2 Module 05 — Assessment Campaigns (events over published assessments).
 * No attempt engine (Module 06).
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  Filter,
  Plus,
  Eye,
  Pencil,
  MoreHorizontal,
  X,
  ChevronLeft,
  ChevronRight,
  Trash2,
  BarChart3,
  LineChart,
  Shield,
} from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { Badge } from "../../components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import campusCampaignsService, {
  type CampaignPayload,
  type CampaignStatus,
  type CampusCampaign,
} from "../../services/campusCampaignsService";
import campusAssessmentsService from "../../services/campusAssessmentsService";
import campusStudentsService from "../../services/campusStudentsService";
import { useAuthStore } from "../../stores/authStore";

const FALLBACK_STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
  { value: "closed", label: "Closed" },
  { value: "archived", label: "Archived" },
];

function canWrite(role: string) {
  return ["college_admin", "college", "college_staff", "instructor", "super_admin", "hr"].includes(
    role.toLowerCase()
  );
}
function canManage(role: string) {
  return ["college_admin", "college", "super_admin", "hr"].includes(role.toLowerCase());
}

function statusVariant(s: CampaignStatus): "muted" | "success" | "warning" | "info" {
  if (s === "published") return "success";
  if (s === "draft") return "warning";
  if (s === "closed") return "info";
  return "muted";
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

/** ISO → datetime-local value */
function toLocalInput(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** datetime-local → ISO */
function fromLocalInput(local: string) {
  if (!local) return "";
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

function defaultWindow() {
  const start = new Date();
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 1);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start_at: toLocalInput(start.toISOString()), end_at: toLocalInput(end.toISOString()) };
}

type FormState = {
  name: string;
  assessment_id: string;
  instructions: string;
  start_at: string;
  end_at: string;
  max_attempts: number;
  duration_minutes: number | "";
  shuffle_questions: boolean;
  shuffle_options: boolean;
  allow_resume: boolean;
  show_result_immediately: boolean;
  negative_marking: boolean;
  target_department: string;
  target_batch: string;
  target_semester: string;
  target_section: string;
  student_ids: string[];
  notify_students: boolean;
  reminder_enabled: boolean;
  notify_email: boolean;
  notify_in_app: boolean;
  proctoring_enabled: boolean;
  require_fullscreen: boolean;
  detect_tab_switch: boolean;
  detect_window_blur: boolean;
  detect_copy_paste: boolean;
  detect_multi_monitor: boolean;
  require_camera: boolean;
  require_microphone: boolean;
  tab_switch_limit: number;
  integrity_auto_flag: boolean;
};

function emptyForm(): FormState {
  const w = defaultWindow();
  return {
    name: "",
    assessment_id: "",
    instructions: "",
    start_at: w.start_at,
    end_at: w.end_at,
    max_attempts: 1,
    duration_minutes: "",
    shuffle_questions: false,
    shuffle_options: false,
    allow_resume: true,
    show_result_immediately: false,
    negative_marking: false,
    target_department: "",
    target_batch: "",
    target_semester: "",
    target_section: "",
    student_ids: [],
    notify_students: true,
    reminder_enabled: false,
    notify_email: true,
    notify_in_app: true,
    proctoring_enabled: false,
    require_fullscreen: false,
    detect_tab_switch: true,
    detect_window_blur: true,
    detect_copy_paste: true,
    detect_multi_monitor: true,
    require_camera: false,
    require_microphone: false,
    tab_switch_limit: 5,
    integrity_auto_flag: true,
  };
}

function toPayload(form: FormState): CampaignPayload {
  return {
    name: form.name.trim(),
    assessment_id: form.assessment_id,
    instructions: form.instructions.trim() || null,
    start_at: fromLocalInput(form.start_at),
    end_at: fromLocalInput(form.end_at),
    max_attempts: Math.max(1, Number(form.max_attempts) || 1),
    duration_minutes:
      form.duration_minutes === "" ? null : Math.max(1, Number(form.duration_minutes)),
    shuffle_questions: form.shuffle_questions,
    shuffle_options: form.shuffle_options,
    allow_resume: form.allow_resume,
    show_result_immediately: form.show_result_immediately,
    negative_marking: form.negative_marking,
    target_department: form.target_department.trim() || null,
    target_batch: form.target_batch.trim() || null,
    target_semester: form.target_semester.trim() || null,
    target_section: form.target_section.trim() || null,
    student_ids: form.student_ids,
    notify_students: form.notify_students,
    reminder_enabled: form.reminder_enabled,
    notify_email: form.notify_email,
    notify_in_app: form.notify_in_app,
    proctoring_enabled: form.proctoring_enabled,
    require_fullscreen: form.require_fullscreen,
    detect_tab_switch: form.detect_tab_switch,
    detect_window_blur: form.detect_window_blur,
    detect_copy_paste: form.detect_copy_paste,
    detect_multi_monitor: form.detect_multi_monitor,
    require_camera: form.require_camera,
    require_microphone: form.require_microphone,
    tab_switch_limit: Math.max(1, Number(form.tab_switch_limit) || 5),
    integrity_auto_flag: form.integrity_auto_flag,
  };
}

function CheckRow({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-gray-700">
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-gray-300"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

export default function AssessmentCampaignsPage() {
  const qc = useQueryClient();
  const role = useAuthStore((s) => s.user?.role ?? "");
  const write = canWrite(role);
  const manage = canManage(role);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showFilters, setShowFilters] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [audiencePreview, setAudiencePreview] = useState<number | null>(null);

  const [detail, setDetail] = useState<CampusCampaign | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [studentPickerOpen, setStudentPickerOpen] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");

  const { data: meta } = useQuery({
    queryKey: ["campus-campaigns-meta"],
    queryFn: () => campusCampaignsService.meta(),
  });
  const statuses = meta?.statuses ?? FALLBACK_STATUSES;

  const filters = { page, search, statusFilter };
  const { data, isLoading } = useQuery({
    queryKey: ["campus-campaigns", filters],
    queryFn: () =>
      campusCampaignsService.list({
        page,
        limit: 20,
        ...(search && { search }),
        ...(statusFilter && { status: statusFilter }),
      }),
  });

  const { data: publishedAssessments } = useQuery({
    queryKey: ["campus-assessments-published-for-campaigns"],
    queryFn: () =>
      campusAssessmentsService.list({ status: "published", limit: 100, page: 1 }),
    enabled: formOpen,
  });

  const { data: studentPicker } = useQuery({
    queryKey: ["campus-students-campaign-picker", studentSearch],
    queryFn: () =>
      campusStudentsService.list({
        page: 1,
        limit: 40,
        ...(studentSearch && { search: studentSearch }),
      }),
    enabled: studentPickerOpen,
  });

  const rows = data?.data ?? [];
  const pagination = data?.pagination;
  const assessmentOptions = publishedAssessments?.data ?? [];

  const invalidate = () => qc.invalidateQueries({ queryKey: ["campus-campaigns"] });

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setAudiencePreview(null);
    setFormOpen(true);
  };

  const openEdit = async (id: string) => {
    try {
      const c = await campusCampaignsService.get(id);
      if (c.status === "closed" || c.status === "archived") {
        toast.error("Closed or archived campaigns cannot be edited");
        return;
      }
      setEditingId(c.id);
      setForm({
        name: c.name,
        assessment_id: c.assessment_id,
        instructions: c.instructions || "",
        start_at: toLocalInput(c.start_at),
        end_at: toLocalInput(c.end_at),
        max_attempts: c.max_attempts,
        duration_minutes: c.duration_minutes ?? "",
        shuffle_questions: c.shuffle_questions,
        shuffle_options: c.shuffle_options,
        allow_resume: c.allow_resume,
        show_result_immediately: c.show_result_immediately,
        negative_marking: c.negative_marking,
        proctoring_enabled: !!c.proctoring_enabled,
        require_fullscreen: !!c.require_fullscreen,
        detect_tab_switch: c.detect_tab_switch !== false,
        detect_window_blur: c.detect_window_blur !== false,
        detect_copy_paste: c.detect_copy_paste !== false,
        detect_multi_monitor: c.detect_multi_monitor !== false,
        require_camera: !!c.require_camera,
        require_microphone: !!c.require_microphone,
        tab_switch_limit: c.tab_switch_limit ?? 5,
        integrity_auto_flag: c.integrity_auto_flag !== false,
        target_department: c.target_department || "",
        target_batch: c.target_batch || "",
        target_semester: c.target_semester || "",
        target_section: c.target_section || "",
        student_ids: c.student_ids || [],
        notify_students: c.notify_students,
        reminder_enabled: c.reminder_enabled,
        notify_email: c.notify_email,
        notify_in_app: c.notify_in_app,
      });
      setAudiencePreview(c.dashboard?.assigned ?? null);
      setFormOpen(true);
      setMenuId(null);
    } catch {
      toast.error("Could not load campaign");
    }
  };

  const openDetail = async (id: string) => {
    try {
      setDetail(await campusCampaignsService.get(id));
      setMenuId(null);
    } catch {
      toast.error("Could not load campaign");
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = toPayload(form);
      if (!payload.assessment_id) throw { response: { data: { error: "Select a published assessment" } } };
      if (editingId) return campusCampaignsService.update(editingId, payload);
      return campusCampaignsService.create(payload);
    },
    onSuccess: () => {
      toast.success(editingId ? "Campaign updated" : "Campaign created");
      setFormOpen(false);
      invalidate();
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      toast.error(err?.response?.data?.error || "Save failed");
    },
  });

  const previewMutation = useMutation({
    mutationFn: () => campusCampaignsService.previewAudience(toPayload(form)),
    onSuccess: (r) => {
      setAudiencePreview(r.count);
      toast.success(`${r.count} student(s) match this audience`);
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      toast.error(err?.response?.data?.error || "Preview failed");
    },
  });

  const runAction = async (
    action: "publish" | "close" | "archive" | "delete",
    id: string
  ) => {
    try {
      if (action === "publish") await campusCampaignsService.publish(id);
      if (action === "close") await campusCampaignsService.close(id);
      if (action === "archive") await campusCampaignsService.archive(id);
      if (action === "delete") {
        if (!confirm("Soft-delete this campaign?")) return;
        await campusCampaignsService.softDelete(id);
      }
      toast.success("Done");
      invalidate();
      if (detail?.id === id) setDetail(await campusCampaignsService.get(id).catch(() => null));
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Action failed");
    } finally {
      setMenuId(null);
    }
  };

  const onAssessmentChange = (assessmentId: string) => {
    const a = assessmentOptions.find((x) => x.id === assessmentId);
    setForm((f) => ({
      ...f,
      assessment_id: assessmentId,
      duration_minutes:
        f.duration_minutes === "" && a ? a.duration_minutes : f.duration_minutes,
      instructions: f.instructions || a?.instructions || "",
    }));
  };

  const toggleStudent = (userId: string) => {
    setForm((f) => ({
      ...f,
      student_ids: f.student_ids.includes(userId)
        ? f.student_ids.filter((id) => id !== userId)
        : [...f.student_ids, userId],
    }));
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            Assessment Campaigns
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Schedule published assessments for batches, departments, or selected students
          </p>
        </div>
        {write && (
          <Button type="button" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            New Campaign
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                className="pl-9"
                placeholder="Search by name, code, or assessment…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowFilters((v) => !v)}
            >
              <Filter className="h-4 w-4" />
              Filters
            </Button>
          </div>
          {showFilters && (
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <Select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All statuses</option>
                {statuses.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Assessment</TableHead>
                <TableHead>Window</TableHead>
                <TableHead>Audience</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-gray-500">
                    Loading campaigns…
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-gray-500">
                    No campaigns yet. Create one from a published assessment.
                  </TableCell>
                </TableRow>
              )}
              {rows.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <button
                      type="button"
                      className="text-left"
                      onClick={() => openDetail(c.id)}
                    >
                      <div className="font-medium text-gray-900">{c.name}</div>
                      <div className="text-xs text-gray-500">{c.campaign_code}</div>
                    </button>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-gray-800">{c.assessment_name}</div>
                    <div className="text-xs text-gray-500">{c.assessment_code}</div>
                  </TableCell>
                  <TableCell className="text-xs text-gray-600">
                    <div>{formatDate(c.start_at)}</div>
                    <div className="text-gray-400">→ {formatDate(c.end_at)}</div>
                    <div className="mt-0.5 text-gray-500">
                      {c.max_attempts} attempt{c.max_attempts === 1 ? "" : "s"}
                      {c.duration_minutes != null ? ` · ${c.duration_minutes}m` : ""}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-gray-600">
                    {[c.target_department, c.target_batch, c.target_semester, c.target_section]
                      .filter(Boolean)
                      .join(" · ") || "All / selected"}
                  </TableCell>
                  <TableCell className="text-xs text-gray-600">
                    <div>{c.dashboard?.assigned ?? 0} assigned</div>
                    <div className="text-gray-400">
                      {c.dashboard?.completed ?? 0} done · {c.dashboard?.pending ?? 0} pending
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(c.status)}>
                      {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell className="relative">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setMenuId(menuId === c.id ? null : c.id)}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                    {menuId === c.id && (
                      <div className="absolute right-2 z-20 mt-1 w-44 rounded-md border bg-white py-1 shadow-lg">
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50"
                          onClick={() => openDetail(c.id)}
                        >
                          <Eye className="h-3.5 w-3.5" /> Dashboard
                        </button>
                        {write && c.status !== "closed" && c.status !== "archived" && (
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50"
                            onClick={() => openEdit(c.id)}
                          >
                            <Pencil className="h-3.5 w-3.5" /> Edit
                          </button>
                        )}
                        <Link
                          to={`/app/college-portal/campaigns/${c.id}/results`}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50"
                          onClick={() => setMenuId(null)}
                        >
                          <BarChart3 className="h-3.5 w-3.5" /> Results
                        </Link>
                        <Link
                          to={`/app/college-portal/campaigns/${c.id}/analytics`}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50"
                          onClick={() => setMenuId(null)}
                        >
                          <LineChart className="h-3.5 w-3.5" /> Analytics
                        </Link>
                        <Link
                          to={`/app/college-portal/campaigns/${c.id}/integrity`}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50"
                          onClick={() => setMenuId(null)}
                        >
                          <Shield className="h-3.5 w-3.5" /> Proctoring
                        </Link>
                        {write && c.status === "draft" && (
                          <button
                            type="button"
                            className="flex w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                            onClick={() => runAction("publish", c.id)}
                          >
                            Publish
                          </button>
                        )}
                        {write && c.status === "published" && (
                          <button
                            type="button"
                            className="flex w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                            onClick={() => runAction("close", c.id)}
                          >
                            Close
                          </button>
                        )}
                        {write && c.status !== "archived" && (
                          <button
                            type="button"
                            className="flex w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                            onClick={() => runAction("archive", c.id)}
                          >
                            Archive
                          </button>
                        )}
                        {manage && c.status !== "published" && (
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                            onClick={() => runAction("delete", c.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Delete
                          </button>
                        )}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {pagination && pagination.pages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3 text-sm text-gray-600">
              <span>
                Page {pagination.page} of {pagination.pages} ({pagination.total} total)
              </span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page >= pagination.pages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit drawer */}
      {formOpen && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/30">
          <div className="flex h-full w-full max-w-xl flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {editingId ? "Edit Campaign" : "New Campaign"}
                </h2>
                <p className="text-xs text-gray-500">
                  Campaigns are events — assessment + audience + schedule
                </p>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => setFormOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Campaign name</label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Java Placement Test — CSE 2026"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Published assessment</label>
                <Select
                  value={form.assessment_id}
                  onChange={(e) => onAssessmentChange(e.target.value)}
                >
                  <option value="">Select assessment…</option>
                  {assessmentOptions.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.assessment_code})
                    </option>
                  ))}
                </Select>
                {assessmentOptions.length === 0 && (
                  <p className="text-xs text-amber-600">
                    No published assessments. Publish one under Tests & Assessments first.
                  </p>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Starts</label>
                  <Input
                    type="datetime-local"
                    value={form.start_at}
                    onChange={(e) => setForm((f) => ({ ...f, start_at: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Ends</label>
                  <Input
                    type="datetime-local"
                    value={form.end_at}
                    onChange={(e) => setForm((f) => ({ ...f, end_at: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Max attempts</label>
                  <Input
                    type="number"
                    min={1}
                    value={form.max_attempts}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, max_attempts: Number(e.target.value) || 1 }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Duration (minutes)</label>
                  <Input
                    type="number"
                    min={1}
                    placeholder="From assessment"
                    value={form.duration_minutes}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        duration_minutes: e.target.value === "" ? "" : Number(e.target.value),
                      }))
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Instructions</label>
                <textarea
                  className="min-h-[80px] w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
                  value={form.instructions}
                  onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))}
                  placeholder="Shown to students when the campaign opens"
                />
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold text-gray-900">Delivery settings</h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  <CheckRow
                    label="Shuffle questions"
                    checked={form.shuffle_questions}
                    onChange={(v) => setForm((f) => ({ ...f, shuffle_questions: v }))}
                  />
                  <CheckRow
                    label="Shuffle options"
                    checked={form.shuffle_options}
                    onChange={(v) => setForm((f) => ({ ...f, shuffle_options: v }))}
                  />
                  <CheckRow
                    label="Allow resume"
                    checked={form.allow_resume}
                    onChange={(v) => setForm((f) => ({ ...f, allow_resume: v }))}
                  />
                  <CheckRow
                    label="Show result immediately"
                    checked={form.show_result_immediately}
                    onChange={(v) => setForm((f) => ({ ...f, show_result_immediately: v }))}
                  />
                  <CheckRow
                    label="Negative marking"
                    checked={form.negative_marking}
                    onChange={(v) => setForm((f) => ({ ...f, negative_marking: v }))}
                  />
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold text-gray-900">
                  Integrity (Proctoring Settings)
                </h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  <CheckRow
                    label="Enable proctoring"
                    checked={form.proctoring_enabled}
                    onChange={(v) => setForm((f) => ({ ...f, proctoring_enabled: v }))}
                  />
                  <CheckRow
                    label="Require fullscreen"
                    checked={form.require_fullscreen}
                    onChange={(v) => setForm((f) => ({ ...f, require_fullscreen: v }))}
                    disabled={!form.proctoring_enabled}
                  />
                  <CheckRow
                    label="Detect tab switch"
                    checked={form.detect_tab_switch}
                    onChange={(v) => setForm((f) => ({ ...f, detect_tab_switch: v }))}
                    disabled={!form.proctoring_enabled}
                  />
                  <CheckRow
                    label="Detect window blur"
                    checked={form.detect_window_blur}
                    onChange={(v) => setForm((f) => ({ ...f, detect_window_blur: v }))}
                    disabled={!form.proctoring_enabled}
                  />
                  <CheckRow
                    label="Detect copy / paste"
                    checked={form.detect_copy_paste}
                    onChange={(v) => setForm((f) => ({ ...f, detect_copy_paste: v }))}
                    disabled={!form.proctoring_enabled}
                  />
                  <CheckRow
                    label="Detect multi-monitor"
                    checked={form.detect_multi_monitor}
                    onChange={(v) => setForm((f) => ({ ...f, detect_multi_monitor: v }))}
                    disabled={!form.proctoring_enabled}
                  />
                  <CheckRow
                    label="Require camera"
                    checked={form.require_camera}
                    onChange={(v) => setForm((f) => ({ ...f, require_camera: v }))}
                    disabled={!form.proctoring_enabled}
                  />
                  <CheckRow
                    label="Require microphone"
                    checked={form.require_microphone}
                    onChange={(v) => setForm((f) => ({ ...f, require_microphone: v }))}
                    disabled={!form.proctoring_enabled}
                  />
                  <CheckRow
                    label="Auto-flag incidents"
                    checked={form.integrity_auto_flag}
                    onChange={(v) => setForm((f) => ({ ...f, integrity_auto_flag: v }))}
                    disabled={!form.proctoring_enabled}
                  />
                </div>
                <div className="mt-3 max-w-[200px] space-y-1">
                  <label className="text-sm font-medium text-gray-700">Tab switch limit</label>
                  <Input
                    type="number"
                    min={1}
                    disabled={!form.proctoring_enabled}
                    value={form.tab_switch_limit}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        tab_switch_limit: Math.max(1, Number(e.target.value) || 5),
                      }))
                    }
                  />
                </div>
                <p className="mt-2 text-xs text-gray-400">
                  Integrity events are logged separately from scoring (Module 09). Network
                  disconnects are always recorded when proctoring is on.
                </p>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold text-gray-900">Target audience</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    placeholder="Department"
                    value={form.target_department}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, target_department: e.target.value }))
                    }
                  />
                  <Input
                    placeholder="Batch / year"
                    value={form.target_batch}
                    onChange={(e) => setForm((f) => ({ ...f, target_batch: e.target.value }))}
                  />
                  <Input
                    placeholder="Semester"
                    value={form.target_semester}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, target_semester: e.target.value }))
                    }
                  />
                  <Input
                    placeholder="Section"
                    value={form.target_section}
                    onChange={(e) => setForm((f) => ({ ...f, target_section: e.target.value }))}
                  />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setStudentPickerOpen(true)}
                  >
                    Specific students ({form.student_ids.length})
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={previewMutation.isPending || !form.assessment_id}
                    onClick={() => previewMutation.mutate()}
                  >
                    Preview audience
                  </Button>
                  {audiencePreview != null && (
                    <span className="text-sm text-gray-600">{audiencePreview} matched</span>
                  )}
                </div>
                <p className="mt-2 text-xs text-gray-400">
                  Empty filters with no picks = all active students. Publish requires ≥1 student.
                </p>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold text-gray-900">Notifications</h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  <CheckRow
                    label="Notify students on publish"
                    checked={form.notify_students}
                    onChange={(v) => setForm((f) => ({ ...f, notify_students: v }))}
                  />
                  <CheckRow
                    label="Reminder"
                    checked={form.reminder_enabled}
                    onChange={(v) => setForm((f) => ({ ...f, reminder_enabled: v }))}
                  />
                  <CheckRow
                    label="Email"
                    checked={form.notify_email}
                    onChange={(v) => setForm((f) => ({ ...f, notify_email: v }))}
                  />
                  <CheckRow
                    label="In-app"
                    checked={form.notify_in_app}
                    onChange={(v) => setForm((f) => ({ ...f, notify_in_app: v }))}
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t px-5 py-4">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Cancel
              </Button>
              {write && (
                <Button
                  type="button"
                  disabled={saveMutation.isPending}
                  onClick={() => saveMutation.mutate()}
                >
                  {saveMutation.isPending ? "Saving…" : editingId ? "Save changes" : "Create draft"}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Student picker */}
      {studentPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="flex max-h-[80vh] w-full max-w-lg flex-col">
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
              <div>
                <CardTitle className="text-base">Pick students</CardTitle>
                <CardDescription>Optional explicit assignments (union with filters)</CardDescription>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setStudentPickerOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
              <Input
                placeholder="Search students…"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
              />
              <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
                {(studentPicker?.data ?? []).map((s) => (
                  <label
                    key={s.user_id}
                    className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={form.student_ids.includes(s.user_id)}
                      onChange={() => toggleStudent(s.user_id)}
                    />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-gray-900">{s.name}</div>
                      <div className="truncate text-xs text-gray-500">
                        {s.department || "—"} · {s.email}
                      </div>
                    </div>
                  </label>
                ))}
                {(studentPicker?.data ?? []).length === 0 && (
                  <p className="py-6 text-center text-sm text-gray-500">No students found</p>
                )}
              </div>
              <Button type="button" onClick={() => setStudentPickerOpen(false)}>
                Done ({form.student_ids.length} selected)
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Dashboard / detail */}
      {detail && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-lg">
            <CardHeader className="flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="text-lg">{detail.name}</CardTitle>
                <CardDescription>
                  {detail.campaign_code} · {detail.assessment_name}
                </CardDescription>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => setDetail(null)}>
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={statusVariant(detail.status)}>
                  {detail.status.charAt(0).toUpperCase() + detail.status.slice(1)}
                </Badge>
                <span className="text-xs text-gray-500">
                  {formatDate(detail.start_at)} → {formatDate(detail.end_at)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {(
                  [
                    ["Assigned", detail.dashboard?.assigned ?? 0],
                    ["Started", detail.dashboard?.started ?? 0],
                    ["Completed", detail.dashboard?.completed ?? 0],
                    ["Pending", detail.dashboard?.pending ?? 0],
                    ["Expired", detail.dashboard?.expired ?? 0],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label} className="rounded-lg border bg-gray-50 px-3 py-2 text-center">
                    <div className="text-lg font-semibold text-gray-900">{value}</div>
                    <div className="text-[11px] uppercase tracking-wide text-gray-500">{label}</div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400">
                Started / Completed stay at 0 until the Student Assessment Engine (Module 06).
              </p>
              <div className="flex flex-wrap gap-2">
                {write && detail.status === "draft" && (
                  <Button type="button" size="sm" onClick={() => runAction("publish", detail.id)}>
                    Publish
                  </Button>
                )}
                {write && detail.status === "published" && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => runAction("close", detail.id)}
                  >
                    Close
                  </Button>
                )}
                {write && detail.status !== "closed" && detail.status !== "archived" && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setDetail(null);
                      void openEdit(detail.id);
                    }}
                  >
                    Edit
                  </Button>
                )}
                <Link
                  to={`/app/college-portal/campaigns/${detail.id}/results`}
                  className="inline-flex h-9 items-center justify-center rounded-md border border-gray-200 bg-white px-3 text-sm font-medium hover:bg-gray-50"
                >
                  Evaluation & Results
                </Link>
                <Link
                  to={`/app/college-portal/campaigns/${detail.id}/analytics`}
                  className="inline-flex h-9 items-center justify-center rounded-md border border-gray-200 bg-white px-3 text-sm font-medium hover:bg-gray-50"
                >
                  Analytics & Reports
                </Link>
                <Link
                  to={`/app/college-portal/campaigns/${detail.id}/integrity`}
                  className="inline-flex h-9 items-center justify-center rounded-md border border-gray-200 bg-white px-3 text-sm font-medium hover:bg-gray-50"
                >
                  Proctoring
                </Link>
                <Button type="button" size="sm" variant="ghost" onClick={() => setDetail(null)}>
                  Close panel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
