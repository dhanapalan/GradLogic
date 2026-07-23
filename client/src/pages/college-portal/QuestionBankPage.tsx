/**
 * Phase 2 Module 03 — College Portal Question Bank.
 * List · Create/Edit dialog · Preview · Bulk import · Soft delete.
 */
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  Filter,
  Plus,
  Upload,
  Download,
  Eye,
  Pencil,
  Copy,
  MoreHorizontal,
  X,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";
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
import campusQuestionsService, {
  type BulkActionResult,
  type CampusQuestion,
  type CollegeQuestionStatus,
  type QuestionOption,
  type QuestionPayload,
} from "../../services/campusQuestionsService";
import { useAuthStore } from "../../stores/authStore";
import { usePortalFeatures } from "../../hooks/usePortalFeatures";

const FALLBACK_META = {
  categories: [
    { value: "aptitude", label: "Aptitude" },
    { value: "logical_reasoning", label: "Logical Reasoning" },
    { value: "english", label: "English" },
    { value: "technical", label: "Technical" },
    { value: "domain", label: "Domain" },
  ],
  types: [
    { value: "mcq_single", label: "Multiple Choice (Single Answer)" },
    { value: "mcq_multiple", label: "Multiple Choice (Multiple Answers)" },
    { value: "true_false", label: "True / False" },
    { value: "short_answer", label: "Short Answer" },
  ],
  difficulties: [
    { value: "easy", label: "Easy" },
    { value: "medium", label: "Medium" },
    { value: "hard", label: "Hard" },
  ],
  statuses: [
    { value: "draft", label: "Draft" },
    { value: "active", label: "Active" },
    { value: "inactive", label: "Inactive" },
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

function statusVariant(s: CollegeQuestionStatus): "muted" | "success" | "warning" {
  if (s === "active") return "success";
  if (s === "draft") return "warning";
  return "muted";
}

function difficultyVariant(d: string): "success" | "warning" | "danger" {
  if (d === "easy") return "success";
  if (d === "hard") return "danger";
  return "warning";
}

function truncate(s: string, n = 100) {
  const t = s.trim();
  return t.length <= n ? t : `${t.slice(0, n)}…`;
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

const EMPTY_FORM: QuestionPayload & { options: QuestionOption[] } = {
  title: "",
  description: "",
  category: "aptitude",
  question_type: "mcq_single",
  difficulty: "medium",
  marks: 1,
  correct_answer: "",
  status: "draft",
  options: [
    { option_label: "A", option_text: "", is_correct: false },
    { option_label: "B", option_text: "", is_correct: false },
    { option_label: "C", option_text: "", is_correct: false },
    { option_label: "D", option_text: "", is_correct: false },
  ],
};

export default function CollegePortalQuestionBankPage() {
  const qc = useQueryClient();
  const role = useAuthStore((s) => s.user?.role ?? "");
  const write = canWrite(role);
  const manage = canManage(role);
  const { hasFeature } = usePortalFeatures("college");

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [questionType, setQuestionType] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [status, setStatus] = useState("");
  const [showFilters, setShowFilters] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [forceDup, setForceDup] = useState(false);

  const [preview, setPreview] = useState<CampusQuestion | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importResult, setImportResult] = useState<Awaited<
    ReturnType<typeof campusQuestionsService.importExcel>
  > | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkResult, setBulkResult] = useState<BulkActionResult | null>(null);

  const { data: meta } = useQuery({
    queryKey: ["campus-questions-meta"],
    queryFn: () => campusQuestionsService.meta(),
  });
  const catalog = meta ?? FALLBACK_META;

  const filters = { page, search, category, questionType, difficulty, status };
  const { data, isLoading } = useQuery({
    queryKey: ["campus-questions", filters],
    queryFn: () =>
      campusQuestionsService.list({
        page,
        limit: 20,
        ...(search && { search }),
        ...(category && { category }),
        ...(questionType && { question_type: questionType }),
        ...(difficulty && { difficulty }),
        ...(status && { status }),
      }),
  });

  const rows = data?.data ?? [];
  const pagination = data?.pagination;

  const labelCat = useMemo(() => {
    const m = Object.fromEntries(catalog.categories.map((c) => [c.value, c.label]));
    return (v: string) => m[v] || v;
  }, [catalog]);
  const labelType = useMemo(() => {
    const m = Object.fromEntries(catalog.types.map((c) => [c.value, c.label]));
    return (v: string) => m[v] || v;
  }, [catalog]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["campus-questions"] });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: QuestionPayload = {
        ...form,
        force: forceDup,
        marks: Number(form.marks),
        options:
          form.question_type === "mcq_single" || form.question_type === "mcq_multiple"
            ? form.options
            : undefined,
        correct_answer:
          form.question_type === "true_false" || form.question_type === "short_answer"
            ? form.correct_answer
            : undefined,
      };
      if (editingId) return campusQuestionsService.update(editingId, payload);
      return campusQuestionsService.create(payload);
    },
    onSuccess: () => {
      toast.success(editingId ? "Question updated" : "Question created");
      setFormOpen(false);
      setEditingId(null);
      setForceDup(false);
      setForm(EMPTY_FORM);
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

  const openCreate = () => {
    setEditingId(null);
    setForceDup(false);
    setForm({ ...EMPTY_FORM, options: EMPTY_FORM.options.map((o) => ({ ...o })) });
    setFormOpen(true);
  };

  const openEdit = async (id: string) => {
    try {
      const q = await campusQuestionsService.get(id);
      setEditingId(q.id);
      setForceDup(false);
      setForm({
        title: q.title,
        description: q.description || "",
        category: q.category,
        question_type: q.question_type,
        difficulty: q.difficulty,
        marks: q.marks,
        correct_answer: q.correct_answer || "",
        status: q.status,
        options:
          q.options && q.options.length
            ? q.options.map((o) => ({
                option_label: o.option_label,
                option_text: o.option_text,
                is_correct: o.is_correct,
              }))
            : EMPTY_FORM.options.map((o) => ({ ...o })),
      });
      setFormOpen(true);
      setMenuId(null);
    } catch {
      toast.error("Could not load question");
    }
  };

  const openPreview = async (id: string) => {
    try {
      setPreview(await campusQuestionsService.get(id));
      setMenuId(null);
    } catch {
      toast.error("Could not load preview");
    }
  };

  const runAction = async (
    action: "duplicate" | "activate" | "deactivate" | "delete",
    id: string
  ) => {
    try {
      if (action === "duplicate") await campusQuestionsService.duplicate(id);
      if (action === "activate") await campusQuestionsService.setStatus(id, "active");
      if (action === "deactivate") await campusQuestionsService.setStatus(id, "inactive");
      if (action === "delete") {
        if (!confirm("Soft-delete this question? It cannot be permanently removed.")) return;
        await campusQuestionsService.softDelete(id);
      }
      toast.success("Done");
      invalidate();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Action failed");
    } finally {
      setMenuId(null);
    }
  };

  const pageIds = rows.map((q) => q.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllOnPage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const bulkMutation = useMutation({
    mutationFn: (action: "activate" | "deactivate" | "delete") =>
      campusQuestionsService.bulkAction(Array.from(selectedIds), action),
    onSuccess: (res) => {
      setBulkResult(res);
      setSelectedIds(new Set());
      invalidate();
      toast.success(`${res.summary.successful} of ${res.summary.total} question(s) updated`);
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      toast.error(err?.response?.data?.error || "Bulk action failed");
    },
  });

  const runBulkAction = (action: "activate" | "deactivate" | "delete") => {
    if (!selectedIds.size) return;
    if (
      action === "delete" &&
      !confirm(`Soft-delete ${selectedIds.size} question(s)? They cannot be permanently removed.`)
    ) {
      return;
    }
    setBulkResult(null);
    bulkMutation.mutate(action);
  };

  const importMutation = useMutation({
    mutationFn: (file: File) => campusQuestionsService.importExcel(file),
    onSuccess: (res) => {
      setImportResult(res);
      invalidate();
      toast.success(
        `Imported ${res.summary.successful} · Failed ${res.summary.failed} · Skipped ${res.summary.skipped}`
      );
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      toast.error(err?.response?.data?.error || "Import failed");
    },
  });

  const isMcq =
    form.question_type === "mcq_single" || form.question_type === "mcq_multiple";

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Question Bank</h1>
          <p className="mt-1 text-sm text-gray-500">
            Central repository of reusable assessment questions for your campus
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {write && hasFeature("ai_question_generation") && (
            <Link to="/app/college-portal/question-bank/ai-generate">
              <Button variant="outline" type="button">
                <Sparkles className="h-4 w-4" />
                Generate with AI
              </Button>
            </Link>
          )}
          {manage && (
            <Button variant="outline" type="button" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4" />
              Bulk Import
            </Button>
          )}
          {write && (
            <Button type="button" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Create Question
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Questions</CardTitle>
              <CardDescription>
                {pagination?.total ?? 0} questions · page {pagination?.page ?? 1} of{" "}
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
              placeholder="Search title or keywords…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9"
            />
          </div>

          {showFilters && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Select
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
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
                value={questionType}
                onChange={(e) => {
                  setQuestionType(e.target.value);
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
                value={difficulty}
                onChange={(e) => {
                  setDifficulty(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All difficulty</option>
                {catalog.difficulties.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </Select>
              <Select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
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

          {manage && selectedIds.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-admin-accent/20 bg-admin-accent/5 px-3 py-2">
              <span className="text-sm font-medium text-gray-700">
                {selectedIds.size} selected
              </span>
              <div className="ml-auto flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={bulkMutation.isPending}
                  onClick={() => runBulkAction("activate")}
                >
                  Activate
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={bulkMutation.isPending}
                  onClick={() => runBulkAction("deactivate")}
                >
                  Deactivate
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={bulkMutation.isPending}
                  onClick={() => runBulkAction("delete")}
                  className="text-rose-600 hover:bg-rose-50"
                >
                  Soft Delete
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedIds(new Set())}
                >
                  Clear
                </Button>
              </div>
            </div>
          )}

          {bulkResult && (bulkResult.failed.length > 0) && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
              {bulkResult.failed.length} question(s) failed to update:{" "}
              {bulkResult.failed.map((f) => f.error).join("; ")}
            </div>
          )}

          <div className="overflow-x-auto rounded-lg border border-gray-100">
            <Table>
              <TableHeader>
                <TableRow>
                  {manage && (
                    <TableHead className="w-8">
                      <input
                        type="checkbox"
                        checked={allPageSelected}
                        onChange={toggleSelectAllOnPage}
                        aria-label="Select all on page"
                      />
                    </TableHead>
                  )}
                  <TableHead>Question ID</TableHead>
                  <TableHead>Question Title</TableHead>
                  <TableHead className="hidden md:table-cell">Category</TableHead>
                  <TableHead className="hidden lg:table-cell">Type</TableHead>
                  <TableHead className="hidden sm:table-cell">Difficulty</TableHead>
                  <TableHead>Marks</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden xl:table-cell">Created By</TableHead>
                  <TableHead className="hidden lg:table-cell">Last Modified</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={manage ? 11 : 10}>
                        <div className="h-10 animate-pulse rounded bg-gray-100" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={manage ? 11 : 10} className="py-12 text-center text-gray-500">
                      No questions match your filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((q) => (
                    <TableRow key={q.id}>
                      {manage && (
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(q.id)}
                            onChange={() => toggleSelect(q.id)}
                            aria-label={`Select ${q.title}`}
                          />
                        </TableCell>
                      )}
                      <TableCell className="font-mono text-xs text-gray-600">
                        {q.question_code}
                      </TableCell>
                      <TableCell className="max-w-[280px]">
                        <button
                          type="button"
                          className="text-left text-sm font-medium text-gray-900 hover:text-admin-accent"
                          onClick={() => openPreview(q.id)}
                        >
                          {truncate(q.title)}
                        </button>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-gray-600">
                        {labelCat(q.category)}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-gray-600">
                        {labelType(q.question_type)}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant={difficultyVariant(q.difficulty)}>
                          {q.difficulty}
                        </Badge>
                      </TableCell>
                      <TableCell className="tabular-nums">{q.marks}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(q.status)}>{q.status}</Badge>
                      </TableCell>
                      <TableCell className="hidden xl:table-cell text-sm text-gray-600">
                        {q.created_by_name || "—"}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-gray-500">
                        {formatDate(q.updated_at)}
                      </TableCell>
                      <TableCell className="relative">
                        <button
                          type="button"
                          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                          onClick={() => setMenuId(menuId === q.id ? null : q.id)}
                          aria-label="Actions"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                        {menuId === q.id && (
                          <div className="absolute right-2 z-20 mt-1 w-44 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                            <MenuBtn
                              icon={Eye}
                              label="View"
                              onClick={() => openPreview(q.id)}
                            />
                            {write && (
                              <MenuBtn
                                icon={Pencil}
                                label="Edit"
                                onClick={() => openEdit(q.id)}
                              />
                            )}
                            {write && (
                              <MenuBtn
                                icon={Copy}
                                label="Duplicate"
                                onClick={() => runAction("duplicate", q.id)}
                              />
                            )}
                            {write && q.status !== "active" && (
                              <MenuBtn
                                label="Activate"
                                onClick={() => runAction("activate", q.id)}
                              />
                            )}
                            {write && q.status === "active" && (
                              <MenuBtn
                                label="Deactivate"
                                onClick={() => runAction("deactivate", q.id)}
                              />
                            )}
                            {manage && (
                              <MenuBtn
                                label="Soft Delete"
                                danger
                                onClick={() => runAction("delete", q.id)}
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
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-gray-500">
                Showing {(pagination.page - 1) * pagination.limit + 1}–
                {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
                {pagination.total}
              </p>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
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

      {/* Create / Edit dialog */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <h2 className="text-lg font-semibold">
                {editingId ? "Edit Question" : "Create Question"}
              </h2>
              <button type="button" onClick={() => setFormOpen(false)} aria-label="Close">
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <label className="block space-y-1 text-sm">
                <span className="text-gray-600">Question Title *</span>
                <Input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="text-gray-600">Question Description</span>
                <textarea
                  className="min-h-[72px] w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
                  value={form.description || ""}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span className="text-gray-600">Question Type *</span>
                  <Select
                    value={form.question_type}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        question_type: e.target.value,
                        correct_answer: "",
                        options: EMPTY_FORM.options.map((o) => ({ ...o, is_correct: false })),
                      }))
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
                  <span className="text-gray-600">Difficulty *</span>
                  <Select
                    value={form.difficulty}
                    onChange={(e) => setForm((f) => ({ ...f, difficulty: e.target.value }))}
                  >
                    {catalog.difficulties.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </Select>
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-gray-600">Marks *</span>
                  <Input
                    type="number"
                    min={0.5}
                    step={0.5}
                    value={form.marks}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, marks: Number(e.target.value) }))
                    }
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-gray-600">Status</span>
                  <Select
                    value={form.status || "draft"}
                    onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                  >
                    {catalog.statuses.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </Select>
                </label>
              </div>

              {isMcq && (
                <div className="space-y-2 rounded-lg border border-gray-100 p-3">
                  <p className="text-sm font-medium text-gray-800">Answer options</p>
                  {form.options.map((opt, idx) => (
                    <div key={opt.option_label} className="flex items-center gap-2">
                      <span className="w-6 text-sm font-semibold text-gray-500">
                        {opt.option_label}
                      </span>
                      <Input
                        value={opt.option_text}
                        onChange={(e) => {
                          const options = [...form.options];
                          options[idx] = { ...options[idx], option_text: e.target.value };
                          setForm((f) => ({ ...f, options }));
                        }}
                        placeholder={`Option ${opt.option_label}`}
                      />
                      <label className="flex shrink-0 items-center gap-1 text-xs text-gray-600">
                        <input
                          type={form.question_type === "mcq_single" ? "radio" : "checkbox"}
                          name="correct"
                          checked={opt.is_correct}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            const options = form.options.map((o, i) => {
                              if (form.question_type === "mcq_single") {
                                return { ...o, is_correct: i === idx };
                              }
                              return i === idx ? { ...o, is_correct: checked } : o;
                            });
                            setForm((f) => ({ ...f, options }));
                          }}
                        />
                        Correct
                      </label>
                    </div>
                  ))}
                </div>
              )}

              {form.question_type === "true_false" && (
                <label className="block space-y-1 text-sm">
                  <span className="text-gray-600">Correct Answer *</span>
                  <Select
                    value={form.correct_answer || ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, correct_answer: e.target.value }))
                    }
                  >
                    <option value="">Select…</option>
                    <option value="True">True</option>
                    <option value="False">False</option>
                  </Select>
                </label>
              )}

              {form.question_type === "short_answer" && (
                <label className="block space-y-1 text-sm">
                  <span className="text-gray-600">Expected Answer *</span>
                  <Input
                    value={form.correct_answer || ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, correct_answer: e.target.value }))
                    }
                  />
                </label>
              )}

              {forceDup && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Duplicate title detected. Click Save again to create/update anyway.
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-3">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={saveMutation.isPending || !form.title.trim()}
                onClick={() => saveMutation.mutate()}
              >
                {saveMutation.isPending ? "Saving…" : forceDup ? "Save anyway" : "Save"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Preview dialog */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <p className="font-mono text-xs text-gray-400">{preview.question_code}</p>
                <h2 className="text-lg font-semibold text-gray-900">{preview.title}</h2>
              </div>
              <button type="button" onClick={() => setPreview(null)} aria-label="Close">
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>
            <div className="mb-3 flex flex-wrap gap-2">
              <Badge>{labelCat(preview.category)}</Badge>
              <Badge variant="info">{labelType(preview.question_type)}</Badge>
              <Badge variant={difficultyVariant(preview.difficulty)}>{preview.difficulty}</Badge>
              <Badge variant={statusVariant(preview.status)}>{preview.status}</Badge>
              <Badge variant="muted">{preview.marks} marks</Badge>
            </div>
            {preview.description && (
              <p className="mb-3 text-sm text-gray-600">{preview.description}</p>
            )}
            {preview.options && preview.options.length > 0 && (
              <ul className="space-y-1.5 text-sm">
                {preview.options.map((o) => (
                  <li
                    key={o.id || o.option_label}
                    className={`rounded-lg border px-3 py-2 ${
                      o.is_correct
                        ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                        : "border-gray-100 text-gray-700"
                    }`}
                  >
                    <span className="font-semibold">{o.option_label}.</span> {o.option_text}
                    {o.is_correct ? " ✓" : ""}
                  </li>
                ))}
              </ul>
            )}
            {preview.question_type === "short_answer" && (
              <p className="mt-2 text-sm text-gray-700">
                <span className="font-medium">Expected:</span> {preview.correct_answer}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              {write && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPreview(null);
                    openEdit(preview.id);
                  }}
                >
                  Edit
                </Button>
              )}
              <Button type="button" size="sm" onClick={() => setPreview(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Import dialog */}
      {importOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Bulk Import Questions</h2>
              <button
                type="button"
                onClick={() => {
                  setImportOpen(false);
                  setImportResult(null);
                }}
                aria-label="Close"
              >
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>
            <p className="mb-3 text-sm text-gray-500">
              Excel columns: Question, Category, Type, Difficulty, Marks, Option A–D, Correct
              Answer
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => campusQuestionsService.downloadImportTemplate().catch(() => toast.error("Template download failed"))}
              >
                <Download className="h-4 w-4" />
                Download Template
              </Button>
              <Button
                type="button"
                disabled={importMutation.isPending}
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="h-4 w-4" />
                {importMutation.isPending ? "Importing…" : "Upload Excel"}
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) importMutation.mutate(f);
                  e.target.value = "";
                }}
              />
            </div>
            {importResult && (
              <div className="mt-4 space-y-3">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Stat label="Total" value={importResult.summary.total} />
                  <Stat label="Successful" value={importResult.summary.successful} tone="success" />
                  <Stat label="Failed" value={importResult.summary.failed} tone="danger" />
                  <Stat label="Skipped" value={importResult.summary.skipped} />
                </div>
                {(importResult.failed.length > 0 || importResult.skipped.length > 0) && (
                  <div className="max-h-56 overflow-y-auto rounded-lg border border-gray-200">
                    <table className="w-full text-left text-xs">
                      <thead className="sticky top-0 bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 font-semibold text-gray-600">Row</th>
                          <th className="px-3 py-2 font-semibold text-gray-600">Status</th>
                          <th className="px-3 py-2 font-semibold text-gray-600">Reason</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {importResult.failed.map((f) => (
                          <tr key={`failed-${f.row}`}>
                            <td className="px-3 py-2 text-gray-700">{f.row}</td>
                            <td className="px-3 py-2 font-medium text-rose-700">Failed</td>
                            <td className="px-3 py-2 text-gray-600">{f.error}</td>
                          </tr>
                        ))}
                        {importResult.skipped.map((s) => (
                          <tr key={`skipped-${s.row}`}>
                            <td className="px-3 py-2 text-gray-700">{s.row}</td>
                            <td className="px-3 py-2 font-medium text-amber-700">Skipped</td>
                            <td className="px-3 py-2 text-gray-600">{s.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
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

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "success" | "danger";
}) {
  const color =
    tone === "success" ? "text-emerald-700" : tone === "danger" ? "text-rose-700" : "text-gray-900";
  return (
    <div className="rounded-lg border border-gray-200 px-2 py-2 text-center">
      <p className={`text-lg font-semibold tabular-nums ${color}`}>{value}</p>
      <p className="text-[10px] uppercase text-gray-400">{label}</p>
    </div>
  );
}
