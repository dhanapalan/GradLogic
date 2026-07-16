import { useState, useEffect, useMemo } from "react";
import {
  CheckCircle2,
  XCircle,
  Check,
  AlertTriangle,
  RefreshCw,
  Pencil,
  Loader2,
} from "lucide-react";
import toast from "react-hot-toast";
import questionBankService from "../../../services/questionBankService";
import { PHASE1_BANK_CATEGORIES } from "../../../lib/phase1PlacementDomains";

interface AIQuestion {
  id: string;
  text: string;
  options?: string[];
  correctAnswer?: string;
  explanation?: string;
  category: string;
  difficulty: "easy" | "medium" | "hard";
  source: string;
  generatedAt: string;
  status: "pending" | "approved" | "rejected" | string;
  bloomLevel?: string | null;
  tags?: string[];
}

const CATEGORIES = [...PHASE1_BANK_CATEGORIES];
const DIFFICULTIES = ["easy", "medium", "hard"] as const;

export default function ReviewQueuePage() {
  const [questions, setQuestions] = useState<AIQuestion[]>([]);
  const [selectedQuestion, setSelectedQuestion] = useState<AIQuestion | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [rejectionReason, setRejectionReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [bulkActing, setBulkActing] = useState(false);

  const [dupLoading, setDupLoading] = useState(false);
  const [dupInfo, setDupInfo] = useState<{
    level: "low" | "medium" | "high";
    matches: Array<{ id: string; question_text: string; overlap: number }>;
  } | null>(null);

  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editDifficulty, setEditDifficulty] = useState<string>("medium");
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const loadQueue = async () => {
    setLoading(true);
    try {
      const data = await questionBankService.getReviewQueue();
      setQuestions(data.questions);
      setSelectedIds(new Set());
      if (data.questions.length > 0) {
        setSelectedQuestion((prev) => {
          const stillThere = data.questions.find((q) => q.id === prev?.id);
          return stillThere || data.questions[0];
        });
      } else {
        setSelectedQuestion(null);
      }
    } catch (error) {
      toast.error("Failed to load review queue");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
  }, []);

  useEffect(() => {
    if (!selectedQuestion) {
      setDupInfo(null);
      setEditing(false);
      return;
    }
    setEditing(false);
    setEditText(selectedQuestion.text);
    setEditCategory(selectedQuestion.category);
    setEditDifficulty(selectedQuestion.difficulty);
    setDupLoading(true);
    setDupInfo(null);
    questionBankService
      .checkDuplicateRisk(selectedQuestion.id, selectedQuestion.text)
      .then(setDupInfo)
      .catch(() => setDupInfo(null))
      .finally(() => setDupLoading(false));
  }, [selectedQuestion?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const pendingQuestions = useMemo(
    () => questions.filter((q) => q.status === "pending"),
    [questions]
  );
  const approvedCount = questions.filter(
    (q) => q.status === "approved" || q.status === "published"
  ).length;
  const rejectedCount = questions.filter((q) => q.status === "rejected").length;

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllPending = () => {
    setSelectedIds((prev) =>
      prev.size === pendingQuestions.length
        ? new Set()
        : new Set(pendingQuestions.map((q) => q.id))
    );
  };

  const handleApprove = async (id: string) => {
    try {
      await questionBankService.approveQuestion(id);
      setQuestions((prev) =>
        prev.map((q) => (q.id === id ? { ...q, status: "approved" as const } : q))
      );
      toast.success("Question approved");
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      if (selectedQuestion?.id === id) {
        const rest = pendingQuestions.filter((q) => q.id !== id);
        setSelectedQuestion(rest[0] || null);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to approve");
    }
  };

  const handleReject = async (id: string, reason?: string) => {
    const why = reason ?? rejectionReason;
    if (!why.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }
    try {
      await questionBankService.rejectQuestion(id, why);
      setQuestions((prev) =>
        prev.map((q) => (q.id === id ? { ...q, status: "rejected" as const } : q))
      );
      toast.success("Question rejected");
      setRejectionReason("");
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      if (selectedQuestion?.id === id) {
        const rest = pendingQuestions.filter((q) => q.id !== id);
        setSelectedQuestion(rest[0] || null);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to reject");
    }
  };

  const bulkApprove = async () => {
    const ids = Array.from(selectedIds).filter((id) =>
      pendingQuestions.some((q) => q.id === id)
    );
    if (!ids.length) {
      toast.error("Select pending questions to approve");
      return;
    }
    setBulkActing(true);
    let ok = 0;
    let fail = 0;
    for (const id of ids) {
      try {
        await questionBankService.approveQuestion(id);
        ok++;
      } catch {
        fail++;
      }
    }
    toast.success(`Approved ${ok}${fail ? ` · ${fail} failed` : ""}`);
    setBulkActing(false);
    await loadQueue();
  };

  const bulkReject = async () => {
    const ids = Array.from(selectedIds).filter((id) =>
      pendingQuestions.some((q) => q.id === id)
    );
    if (!ids.length) {
      toast.error("Select pending questions to reject");
      return;
    }
    if (!rejectionReason.trim()) {
      toast.error("Provide a rejection reason for bulk reject");
      return;
    }
    setBulkActing(true);
    let ok = 0;
    let fail = 0;
    for (const id of ids) {
      try {
        await questionBankService.rejectQuestion(id, rejectionReason);
        ok++;
      } catch {
        fail++;
      }
    }
    toast.success(`Rejected ${ok}${fail ? ` · ${fail} failed` : ""}`);
    setRejectionReason("");
    setBulkActing(false);
    await loadQueue();
  };

  const saveEdit = async () => {
    if (!selectedQuestion) return;
    if (!editText.trim()) {
      toast.error("Question text is required");
      return;
    }
    setSaving(true);
    try {
      await questionBankService.updateQuestion(selectedQuestion.id, {
        question_text: editText,
        category: editCategory,
        difficulty_level: editDifficulty,
      });
      setQuestions((prev) =>
        prev.map((q) =>
          q.id === selectedQuestion.id
            ? {
                ...q,
                text: editText,
                category: editCategory,
                difficulty: editDifficulty as AIQuestion["difficulty"],
              }
            : q
        )
      );
      setSelectedQuestion((prev) =>
        prev
          ? {
              ...prev,
              text: editText,
              category: editCategory,
              difficulty: editDifficulty as AIQuestion["difficulty"],
            }
          : prev
      );
      toast.success("Saved");
      setEditing(false);
    } catch {
      toast.error("Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerate = async () => {
    if (!selectedQuestion) return;
    setRegenerating(true);
    try {
      const fresh = await questionBankService.regenerateItem({
        text: selectedQuestion.text,
        category: selectedQuestion.category,
        difficulty: selectedQuestion.difficulty,
      });
      if (!fresh) {
        toast.error("The engine returned nothing — is it running?");
        return;
      }
      await questionBankService.rejectQuestion(
        selectedQuestion.id,
        "Regenerated by reviewer"
      );
      toast.success("Replacement generated — original rejected");
      await loadQueue();
    } catch (error: any) {
      toast.error(
        error.response?.data?.error ||
          error.response?.data?.message ||
          "Regeneration failed"
      );
    } finally {
      setRegenerating(false);
    }
  };

  const riskColor =
    dupInfo?.level === "high"
      ? "text-rose-700 bg-rose-50 border-rose-200"
      : dupInfo?.level === "medium"
        ? "text-amber-800 bg-amber-50 border-amber-200"
        : "text-emerald-700 bg-emerald-50 border-emerald-200";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold tracking-tight text-gray-900">Review Queue</h2>
        <p className="text-gray-500 mt-1">
          Review AI-generated questions — edit, check duplicates, approve or reject before publish.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-4">
          <p className="text-sm text-gray-600 mb-1">Pending Review</p>
          <p className="text-3xl font-display font-semibold text-yellow-600">
            {pendingQuestions.length}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-4">
          <p className="text-sm text-gray-600 mb-1">Approved</p>
          <p className="text-3xl font-display font-semibold text-green-600">{approvedCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-4">
          <p className="text-sm text-gray-600 mb-1">Rejected</p>
          <p className="text-3xl font-display font-semibold text-red-600">{rejectedCount}</p>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-navy-900/10 bg-navy-900/[0.04] p-3">
          <span className="text-sm font-medium text-navy-900">
            {selectedIds.size} selected
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={bulkActing}
              onClick={bulkApprove}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50"
            >
              {bulkActing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              Bulk approve
            </button>
            <button
              type="button"
              disabled={bulkActing}
              onClick={bulkReject}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
            >
              <XCircle className="w-3.5 h-3.5" />
              Bulk reject
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-gray-600">Loading review queue...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card overflow-hidden">
              <div className="bg-gray-50 border-b border-gray-200 p-4 flex items-center justify-between gap-2">
                <h3 className="font-semibold text-gray-900">Pending Questions</h3>
                {pendingQuestions.length > 0 && (
                  <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={
                        pendingQuestions.length > 0 &&
                        selectedIds.size === pendingQuestions.length
                      }
                      onChange={toggleAllPending}
                    />
                    All
                  </label>
                )}
              </div>
              <div className="max-h-[28rem] overflow-y-auto">
                {pendingQuestions.length === 0 ? (
                  <div className="p-4 text-center text-gray-500 text-sm">No pending questions</div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {pendingQuestions.map((q) => (
                      <div
                        key={q.id}
                        className={`flex items-start gap-2 p-3 hover:bg-gray-50 ${
                          selectedQuestion?.id === q.id ? "bg-navy-900/[0.06]" : ""
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={selectedIds.has(q.id)}
                          onChange={() => toggleOne(q.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <button
                          type="button"
                          onClick={() => setSelectedQuestion(q)}
                          className="flex-1 text-left min-w-0"
                        >
                          <p className="text-sm font-medium text-gray-900 line-clamp-2">{q.text}</p>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 rounded capitalize">
                              {q.difficulty}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 rounded">
                              {q.category}
                            </span>
                          </div>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            {selectedQuestion ? (
              <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-6 space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    {editing ? (
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        rows={4}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    ) : (
                      <h3 className="text-lg font-semibold text-gray-900">
                        {selectedQuestion.text}
                      </h3>
                    )}
                    <div className="flex gap-2 flex-wrap mt-3">
                      {editing ? (
                        <>
                          <select
                            value={editDifficulty}
                            onChange={(e) => setEditDifficulty(e.target.value)}
                            className="text-xs px-2 py-1 border border-gray-300 rounded-lg"
                          >
                            {DIFFICULTIES.map((d) => (
                              <option key={d} value={d}>
                                {d}
                              </option>
                            ))}
                          </select>
                          <select
                            value={editCategory}
                            onChange={(e) => setEditCategory(e.target.value)}
                            className="text-xs px-2 py-1 border border-gray-300 rounded-lg"
                          >
                            {CATEGORIES.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </>
                      ) : (
                        <>
                          <span className="text-xs px-3 py-1 bg-navy-900/[0.06] text-navy-900 rounded-full font-medium capitalize">
                            {selectedQuestion.difficulty}
                          </span>
                          <span className="text-xs px-2 py-1 bg-gray-100 rounded">
                            {selectedQuestion.category}
                          </span>
                          <span className="text-xs px-2 py-1 bg-gray-100 rounded">
                            From: {selectedQuestion.source}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {editing ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setEditing(false)}
                          className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={saveEdit}
                          className="px-3 py-1.5 text-sm bg-navy-900 text-white rounded-lg hover:bg-navy-800 disabled:opacity-50"
                        >
                          {saving ? "Saving…" : "Save"}
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => setEditing(true)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={regenerating}
                          onClick={handleRegenerate}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-violet-300 text-violet-800 rounded-lg hover:bg-violet-50 disabled:opacity-50"
                        >
                          {regenerating ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="w-3.5 h-3.5" />
                          )}
                          Regenerate
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Duplicate risk — replaces fake quality_score */}
                <div className={`rounded-lg border p-3 ${riskColor}`}>
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    {dupLoading
                      ? "Checking duplicate risk…"
                      : dupInfo
                        ? `Duplicate risk: ${dupInfo.level}`
                        : "Duplicate check unavailable"}
                  </div>
                  {dupInfo?.matches?.length ? (
                    <ul className="mt-2 space-y-1">
                      {dupInfo.matches.slice(0, 3).map((m) => (
                        <li key={m.id} className="text-xs line-clamp-1 opacity-90">
                          {m.overlap}% — {m.question_text}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>

                {selectedQuestion.options && (
                  <div className="pb-5 border-b border-gray-200">
                    <h4 className="font-semibold text-gray-900 mb-3">Options</h4>
                    <div className="space-y-2">
                      {selectedQuestion.options.map((option, idx) => (
                        <div
                          key={idx}
                          className={`p-3 rounded-lg border ${
                            option === selectedQuestion.correctAnswer
                              ? "bg-green-50 border-green-200"
                              : "bg-gray-50 border-gray-200"
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <span className="font-semibold text-sm text-gray-900">
                              {String.fromCharCode(65 + idx)}.
                            </span>
                            <span className="text-sm text-gray-900">{option}</span>
                            {option === selectedQuestion.correctAnswer && (
                              <Check className="w-4 h-4 text-green-600 ml-auto" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedQuestion.explanation && (
                  <div className="pb-5 border-b border-gray-200">
                    <h4 className="font-semibold text-gray-900 mb-2">Explanation</h4>
                    <p className="text-sm text-gray-700">{selectedQuestion.explanation}</p>
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Rejection reason (single or bulk reject)
                    </label>
                    <textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Why are you rejecting this question?"
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-admin-accent focus:border-transparent"
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => handleApprove(selectedQuestion.id)}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReject(selectedQuestion.id)}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
                    >
                      <XCircle className="w-4 h-4" />
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-12 text-center">
                <p className="text-gray-600">Select a question from the list to review</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
