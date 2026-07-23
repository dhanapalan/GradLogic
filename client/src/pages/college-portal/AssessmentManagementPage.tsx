/**
 * Phase 2 Module 04 — Assessment Management (definitions only).
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  Filter,
  Plus,
  Eye,
  Pencil,
  Copy,
  MoreHorizontal,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Trash2,
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
import campusAssessmentsService, {
  type AssessmentPayload,
  type AssessmentQuestion,
  type AssessmentStatus,
  type CampusAssessment,
} from "../../services/campusAssessmentsService";
import campusQuestionsService, {
  type CampusQuestion,
} from "../../services/campusQuestionsService";
import { useAuthStore } from "../../stores/authStore";

const FALLBACK_META = {
  types: [
    { value: "practice_test", label: "Practice Test" },
    { value: "mock_test", label: "Mock Test" },
    { value: "placement_test", label: "Placement Test" },
  ],
  categories: [
    { value: "aptitude", label: "Aptitude" },
    { value: "logical_reasoning", label: "Logical Reasoning" },
    { value: "english", label: "English" },
    { value: "technical", label: "Technical" },
    { value: "domain", label: "Domain" },
  ],
  statuses: [
    { value: "draft", label: "Draft" },
    { value: "published", label: "Published" },
    { value: "archived", label: "Archived" },
  ],
};

function canWrite(role: string) {
  return ["college_admin", "college", "college_staff", "instructor", "super_admin", "hr"].includes(
    role.toLowerCase()
  );
}
function canManage(role: string) {
  return ["college_admin", "college", "super_admin", "hr"].includes(role.toLowerCase());
}

function statusVariant(s: AssessmentStatus): "muted" | "success" | "warning" | "info" {
  if (s === "published") return "success";
  if (s === "draft") return "warning";
  return "muted";
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

type SelectedQ = AssessmentQuestion & {
  question_code: string;
  title: string;
  category: string;
  difficulty: string;
  question_type: string;
};

const EMPTY_FORM = {
  name: "",
  description: "",
  assessment_type: "practice_test",
  category: "aptitude",
  duration_minutes: 60,
  passing_marks: 0,
  instructions: "",
  status: "draft",
};

export default function AssessmentManagementPage() {
  const qc = useQueryClient();
  const role = useAuthStore((s) => s.user?.role ?? "");
  const write = canWrite(role);
  const manage = canManage(role);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showFilters, setShowFilters] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [selected, setSelected] = useState<SelectedQ[]>([]);
  const [forceDup, setForceDup] = useState(false);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerCat, setPickerCat] = useState("");
  const [pickerDiff, setPickerDiff] = useState("");

  const [previewAsm, setPreviewAsm] = useState<CampusAssessment | null>(null);
  const [previewQ, setPreviewQ] = useState<CampusQuestion | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);

  const { data: meta } = useQuery({
    queryKey: ["campus-assessments-meta"],
    queryFn: () => campusAssessmentsService.meta(),
  });
  const catalog = meta ?? FALLBACK_META;

  const filters = { page, search, typeFilter, categoryFilter, statusFilter };
  const { data, isLoading } = useQuery({
    queryKey: ["campus-assessments", filters],
    queryFn: () =>
      campusAssessmentsService.list({
        page,
        limit: 20,
        ...(search && { search }),
        ...(typeFilter && { assessment_type: typeFilter }),
        ...(categoryFilter && { category: categoryFilter }),
        ...(statusFilter && { status: statusFilter }),
      }),
  });

  const { data: pickerData, isLoading: pickerLoading } = useQuery({
    queryKey: ["campus-questions-picker", pickerSearch, pickerCat, pickerDiff],
    queryFn: () =>
      campusQuestionsService.list({
        status: "active",
        limit: 50,
        ...(pickerSearch && { search: pickerSearch }),
        ...(pickerCat && { category: pickerCat }),
        ...(pickerDiff && { difficulty: pickerDiff }),
      }),
    enabled: pickerOpen,
  });

  const rows = data?.data ?? [];
  const pagination = data?.pagination;
  const totalMarks = useMemo(
    () => selected.reduce((s, q) => s + Number(q.marks || 0), 0),
    [selected]
  );

  const labelType = useMemo(() => {
    const m = Object.fromEntries(catalog.types.map((t) => [t.value, t.label]));
    return (v: string) => m[v] || v;
  }, [catalog]);
  const labelCat = useMemo(() => {
    const m = Object.fromEntries(catalog.categories.map((c) => [c.value, c.label]));
    return (v: string) => m[v] || v;
  }, [catalog]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["campus-assessments"] });

  const openCreate = () => {
    setEditingId(null);
    setForceDup(false);
    setForm({ ...EMPTY_FORM });
    setSelected([]);
    setFormOpen(true);
  };

  const openEdit = async (id: string) => {
    try {
      const a = await campusAssessmentsService.get(id);
      setEditingId(a.id);
      setForceDup(false);
      setForm({
        name: a.name,
        description: a.description || "",
        assessment_type: a.assessment_type,
        category: a.category,
        duration_minutes: a.duration_minutes,
        passing_marks: a.passing_marks,
        instructions: a.instructions || "",
        status: a.status,
      });
      setSelected(
        (a.questions || []).map((q) => ({
          question_id: q.question_id,
          display_order: q.display_order,
          marks: q.marks,
          question_code: q.question_code || "",
          title: q.title || "",
          category: q.category || "",
          difficulty: q.difficulty || "",
          question_type: q.question_type || "",
        }))
      );
      setFormOpen(true);
      setMenuId(null);
    } catch {
      toast.error("Could not load assessment");
    }
  };

  const openPreview = async (id: string) => {
    try {
      setPreviewAsm(await campusAssessmentsService.get(id));
      setMenuId(null);
    } catch {
      toast.error("Could not load preview");
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: AssessmentPayload = {
        ...form,
        duration_minutes: Number(form.duration_minutes),
        passing_marks: Number(form.passing_marks),
        force: forceDup,
        questions: selected.map((q, i) => ({
          question_id: q.question_id,
          display_order: i,
          marks: q.marks,
        })),
      };
      if (editingId) return campusAssessmentsService.update(editingId, payload);
      return campusAssessmentsService.create(payload);
    },
    onSuccess: () => {
      toast.success(editingId ? "Assessment updated" : "Assessment created");
      setFormOpen(false);
      setForceDup(false);
      invalidate();
    },
    onError: (err: { response?: { status?: number; data?: { error?: string } } }) => {
      const msg = err?.response?.data?.error || "Save failed";
      if (err?.response?.status === 409) {
        setForceDup(true);
        toast.error(msg);
      } else toast.error(msg);
    },
  });

  const runAction = async (
    action: "duplicate" | "publish" | "archive" | "delete",
    id: string
  ) => {
    try {
      if (action === "duplicate") await campusAssessmentsService.duplicate(id);
      if (action === "publish") await campusAssessmentsService.publish(id);
      if (action === "archive") await campusAssessmentsService.archive(id);
      if (action === "delete") {
        if (!confirm("Soft-delete this draft/archived assessment?")) return;
        await campusAssessmentsService.softDelete(id);
      }
      toast.success("Done");
      invalidate();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Action failed");
    } finally {
      setMenuId(null);
    }
  };

  const addQuestion = (q: CampusQuestion) => {
    if (selected.some((s) => s.question_id === q.id)) {
      toast.error("Question already selected");
      return;
    }
    setSelected((prev) => [
      ...prev,
      {
        question_id: q.id,
        display_order: prev.length,
        marks: q.marks,
        question_code: q.question_code,
        title: q.title,
        category: q.category,
        difficulty: q.difficulty,
        question_type: q.question_type,
      },
    ]);
  };

  const removeQuestion = (id: string) => {
    setSelected((prev) => prev.filter((x) => x.question_id !== id));
  };

  const togglePickerQuestion = (q: CampusQuestion) => {
    if (selected.some((s) => s.question_id === q.id)) removeQuestion(q.id);
    else addQuestion(q);
  };

  const moveSelected = (idx: number, dir: -1 | 1) => {
    setSelected((prev) => {
      const next = [...prev];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next.map((q, i) => ({ ...q, display_order: i }));
    });
  };

  const openQPreview = async (id: string) => {
    try {
      setPreviewQ(await campusQuestionsService.get(id));
    } catch {
      toast.error("Could not preview question");
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            Tests & Assessments
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Create reusable assessment definitions from your Question Bank
          </p>
        </div>
        {write && (
          <Button type="button" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Create Assessment
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Assessments</CardTitle>
              <CardDescription>
                {pagination?.total ?? 0} assessments · page {pagination?.page ?? 1} of{" "}
                {pagination?.pages ?? 1}
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={() => setShowFilters((v) => !v)}
            >
              <Filter className="h-4 w-4" />
              {showFilters ? "Hide filters" : "Show filters"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search name or code…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9"
            />
          </div>

          {showFilters && (
            <div className="grid gap-3 sm:grid-cols-3">
              <Select
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All types</option>
                {catalog.types.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
              <Select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All categories</option>
                {catalog.categories.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
              <Select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All status</option>
                {catalog.statuses.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </div>
          )}

          <div className="overflow-x-auto rounded-lg border border-gray-100">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden md:table-cell">Type</TableHead>
                  <TableHead className="hidden lg:table-cell">Category</TableHead>
                  <TableHead>Questions</TableHead>
                  <TableHead>Marks</TableHead>
                  <TableHead className="hidden sm:table-cell">Duration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden xl:table-cell">Last Updated</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={10}>
                        <div className="h-10 animate-pulse rounded bg-gray-100" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="py-12 text-center text-gray-500">
                      No assessments yet. Create one to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-mono text-xs">{a.assessment_code}</TableCell>
                      <TableCell>
                        <button
                          type="button"
                          className="text-left text-sm font-medium hover:text-admin-accent"
                          onClick={() => openPreview(a.id)}
                        >
                          {a.name}
                        </button>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-gray-600">
                        {labelType(a.assessment_type)}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-gray-600">
                        {labelCat(a.category)}
                      </TableCell>
                      <TableCell className="tabular-nums">{a.total_questions}</TableCell>
                      <TableCell className="tabular-nums">{a.total_marks}</TableCell>
                      <TableCell className="hidden sm:table-cell tabular-nums">
                        {a.duration_minutes}m
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(a.status)}>{a.status}</Badge>
                      </TableCell>
                      <TableCell className="hidden xl:table-cell text-xs text-gray-500">
                        {formatDate(a.updated_at)}
                      </TableCell>
                      <TableCell className="relative">
                        <button
                          type="button"
                          className="rounded p-1 text-gray-400 hover:bg-gray-100"
                          onClick={() => setMenuId(menuId === a.id ? null : a.id)}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                        {menuId === a.id && (
                          <div className="absolute right-2 z-20 mt-1 w-44 rounded-lg border bg-white py-1 shadow-lg">
                            <MenuBtn label="View" icon={Eye} onClick={() => openPreview(a.id)} />
                            {write && (
                              <MenuBtn label="Edit" icon={Pencil} onClick={() => openEdit(a.id)} />
                            )}
                            {write && (
                              <MenuBtn
                                label="Duplicate"
                                icon={Copy}
                                onClick={() => runAction("duplicate", a.id)}
                              />
                            )}
                            {write && a.status !== "published" && (
                              <MenuBtn label="Publish" onClick={() => runAction("publish", a.id)} />
                            )}
                            {write && a.status !== "archived" && (
                              <MenuBtn label="Archive" onClick={() => runAction("archive", a.id)} />
                            )}
                            {manage && a.status !== "published" && (
                              <MenuBtn
                                label="Soft Delete"
                                danger
                                onClick={() => runAction("delete", a.id)}
                              />
                            )}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {pagination && pagination.pages > 1 && (
            <div className="flex justify-between pt-2">
              <p className="text-xs text-gray-500">
                {(pagination.page - 1) * pagination.limit + 1}–
                {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
                {pagination.total}
              </p>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
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

      {/* Create / Edit builder */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-4">
          <div className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h2 className="text-lg font-semibold">
                {editingId ? "Edit Assessment" : "Create Assessment"}
              </h2>
              <button type="button" onClick={() => setFormOpen(false)}>
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-sm sm:col-span-2">
                  <span className="text-gray-600">Assessment Name *</span>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </label>
                <label className="space-y-1 text-sm sm:col-span-2">
                  <span className="text-gray-600">Description</span>
                  <textarea
                    className="min-h-[60px] w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-gray-600">Assessment Type *</span>
                  <Select
                    value={form.assessment_type}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, assessment_type: e.target.value }))
                    }
                  >
                    {catalog.types.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </Select>
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-gray-600">Category *</span>
                  <Select
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  >
                    {catalog.categories.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </Select>
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-gray-600">Duration (Minutes) *</span>
                  <Input
                    type="number"
                    min={1}
                    value={form.duration_minutes}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        duration_minutes: Number(e.target.value),
                      }))
                    }
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-gray-600">Passing Marks *</span>
                  <Input
                    type="number"
                    min={0}
                    value={form.passing_marks}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        passing_marks: Number(e.target.value),
                      }))
                    }
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-gray-600">Total Marks (auto)</span>
                  <Input value={totalMarks} readOnly className="bg-slate-50" />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-gray-600">Status</span>
                  <Select
                    value={form.status}
                    onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                  >
                    {catalog.statuses.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </Select>
                </label>
                <label className="space-y-1 text-sm sm:col-span-2">
                  <span className="text-gray-600">Instructions</span>
                  <textarea
                    className="min-h-[60px] w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
                    value={form.instructions}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, instructions: e.target.value }))
                    }
                  />
                </label>
              </div>

              <div className="rounded-lg border border-gray-200">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">Selected Questions</p>
                    <p className="text-xs text-gray-500">
                      {selected.length} questions · {totalMarks} marks
                    </p>
                  </div>
                  <Button type="button" size="sm" variant="outline" onClick={() => setPickerOpen(true)}>
                    Browse Question Bank
                  </Button>
                </div>
                {selected.length === 0 ? (
                  <p className="px-3 py-6 text-center text-sm text-gray-400">
                    No questions selected yet.
                  </p>
                ) : (
                  <ul className="divide-y">
                    {selected.map((q, idx) => (
                      <li
                        key={q.question_id}
                        className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm"
                      >
                        <span className="w-6 text-xs text-gray-400">{idx + 1}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{q.title}</p>
                          <p className="text-xs text-gray-500">
                            {q.question_code} · {q.difficulty} · {q.marks} marks
                          </p>
                        </div>
                        <button
                          type="button"
                          className="rounded p-1 text-gray-400 hover:bg-gray-100"
                          onClick={() => moveSelected(idx, -1)}
                        >
                          <ChevronUp className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="rounded p-1 text-gray-400 hover:bg-gray-100"
                          onClick={() => moveSelected(idx, 1)}
                        >
                          <ChevronDown className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="rounded p-1 text-gray-400 hover:bg-gray-100"
                          onClick={() => openQPreview(q.question_id)}
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="rounded p-1 text-rose-500 hover:bg-rose-50"
                          onClick={() =>
                            setSelected((prev) => prev.filter((x) => x.question_id !== q.question_id))
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {forceDup && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Duplicate name detected. Click Save again to continue.
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t px-5 py-3">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={saveMutation.isPending || !form.name.trim() || !selected.length}
                onClick={() => saveMutation.mutate()}
              >
                {saveMutation.isPending ? "Saving…" : forceDup ? "Save anyway" : "Save"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Question picker */}
      {pickerOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-3">
          <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <h3 className="font-semibold">Select Questions (Active only)</h3>
                <p className="text-xs text-gray-500">
                  {selected.length} selected · click a card to add or remove it
                </p>
              </div>
              <button type="button" onClick={() => setPickerOpen(false)}>
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>
            <div className="grid gap-2 border-b px-4 py-3 sm:grid-cols-3">
              <Input
                placeholder="Search…"
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
              />
              <Select value={pickerCat} onChange={(e) => setPickerCat(e.target.value)}>
                <option value="">All categories</option>
                {catalog.categories.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
              <Select value={pickerDiff} onChange={(e) => setPickerDiff(e.target.value)}>
                <option value="">All difficulty</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </Select>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {pickerLoading ? (
                <p className="text-sm text-gray-500">Loading…</p>
              ) : (pickerData?.data ?? []).length === 0 ? (
                <p className="text-sm text-gray-500">No questions match these filters.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {(pickerData?.data ?? []).map((q) => {
                    const already = selected.some((s) => s.question_id === q.id);
                    return (
                      <div
                        key={q.id}
                        role="checkbox"
                        aria-checked={already}
                        tabIndex={0}
                        onClick={() => togglePickerQuestion(q)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            togglePickerQuestion(q);
                          }
                        }}
                        className={`cursor-pointer rounded-lg border p-3 text-sm transition-colors ${
                          already
                            ? "border-admin-accent bg-admin-accent/5"
                            : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            checked={already}
                            readOnly
                            className="mt-1 shrink-0"
                            aria-label={`Select ${q.title}`}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{q.title}</p>
                            <p className="mt-1 text-xs text-gray-500">
                              {q.question_code} · {q.category} · {q.question_type}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                              <Badge variant="muted">{q.difficulty}</Badge>
                              <Badge variant="muted">{q.marks} marks</Badge>
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="mt-2 text-xs font-medium text-admin-accent hover:underline"
                          onClick={(e) => {
                            e.stopPropagation();
                            openQPreview(q.id);
                          }}
                        >
                          Preview
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="flex items-center justify-between border-t px-4 py-3">
              <p className="text-xs text-gray-500">
                {selected.length} question{selected.length === 1 ? "" : "s"} selected · {totalMarks} marks
              </p>
              <Button type="button" onClick={() => setPickerOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Assessment preview */}
      {previewAsm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-start justify-between">
              <div>
                <p className="font-mono text-xs text-gray-400">{previewAsm.assessment_code}</p>
                <h2 className="text-lg font-semibold">{previewAsm.name}</h2>
              </div>
              <button type="button" onClick={() => setPreviewAsm(null)}>
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>
            <div className="mb-3 flex flex-wrap gap-2">
              <Badge variant="info">{labelType(previewAsm.assessment_type)}</Badge>
              <Badge>{labelCat(previewAsm.category)}</Badge>
              <Badge variant={statusVariant(previewAsm.status)}>{previewAsm.status}</Badge>
            </div>
            <div className="mb-3 grid gap-2 text-sm sm:grid-cols-3">
              <Meta label="Duration" value={`${previewAsm.duration_minutes} min`} />
              <Meta label="Total Questions" value={String(previewAsm.total_questions)} />
              <Meta
                label="Marks"
                value={`${previewAsm.total_marks} (pass ${previewAsm.passing_marks})`}
              />
            </div>
            {previewAsm.description && (
              <p className="mb-2 text-sm text-gray-600">{previewAsm.description}</p>
            )}
            {previewAsm.instructions && (
              <div className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <p className="text-xs font-medium uppercase text-gray-400">Instructions</p>
                <p className="mt-1 text-gray-700">{previewAsm.instructions}</p>
              </div>
            )}
            <p className="mb-2 text-sm font-medium">Question list</p>
            <ul className="space-y-1 text-sm">
              {(previewAsm.questions || []).map((q, i) => (
                <li key={q.question_id} className="rounded border border-gray-100 px-3 py-2">
                  {i + 1}. {q.title}{" "}
                  <span className="text-xs text-gray-400">
                    ({q.question_code} · {q.marks} marks)
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex justify-end gap-2">
              {write && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPreviewAsm(null);
                    openEdit(previewAsm.id);
                  }}
                >
                  Edit
                </Button>
              )}
              <Button type="button" size="sm" onClick={() => setPreviewAsm(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Question preview */}
      {previewQ && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-3">
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
            <div className="mb-2 flex justify-between">
              <p className="font-mono text-xs text-gray-400">{previewQ.question_code}</p>
              <button type="button" onClick={() => setPreviewQ(null)}>
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>
            <h3 className="text-base font-semibold">{previewQ.title}</h3>
            {previewQ.description && (
              <p className="mt-1 text-sm text-gray-600">{previewQ.description}</p>
            )}
            {previewQ.options && previewQ.options.length > 0 && (
              <ul className="mt-3 space-y-1 text-sm">
                {previewQ.options.map((o) => (
                  <li
                    key={o.option_label}
                    className={`rounded border px-3 py-1.5 ${
                      o.is_correct ? "border-emerald-200 bg-emerald-50" : "border-gray-100"
                    }`}
                  >
                    {o.option_label}. {o.option_text}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 flex justify-end">
              <Button type="button" size="sm" onClick={() => setPreviewQ(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuBtn({
  label,
  onClick,
  icon: Icon,
  danger,
}: {
  label: string;
  onClick: () => void;
  icon?: typeof Eye;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-gray-50 ${
        danger ? "text-rose-600" : "text-gray-700"
      }`}
      onClick={onClick}
    >
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {label}
    </button>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-100 px-3 py-2">
      <div className="text-[11px] uppercase text-gray-400">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}
