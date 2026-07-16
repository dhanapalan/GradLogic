import { useEffect, useState } from "react";
import {
  ShieldCheck, CheckCircle2, XCircle, Pencil, RotateCcw, UploadCloud,
  AlertTriangle, HelpCircle, Loader2, Sparkles,
} from "lucide-react";
import toast from "react-hot-toast";
import questionBankService, { AIQuestion, isSystemTag } from "../../../services/questionBankService";
import ContentItemsPanel from "./ContentItemsPanel";

// =============================================================================
// AI Review Center — Phase 3
//
// Replaces Review Queue. Reuses the SAME endpoints (GET /review-queue,
// POST /review-queue/:id/approve, POST /review-queue/:id/reject,
// PUT /question-bank/:id) plus the search/generate/import endpoints already
// used by Content Studio — no new backend beyond making /qb-ai/import insert
// pending content as 'pending' instead of auto-publishing it (see
// questionBankAI.routes.ts) so this page has something real to review.
//
// "Approve" here is a LOCAL staging flag only — it does not call the API.
// The only action that actually changes anything server-side (sets
// status='published') is "Publish". This is deliberate: the brief says
// content must never publish automatically, so approving and publishing are
// kept as two distinct, explicit steps even though the underlying API only
// exposes one real transition.
// =============================================================================

const CATEGORIES = [
  "aptitude", "reasoning", "maths", "data_structures",
  "programming", "python_coding", "java_coding", "data_science",
];

const NOT_AVAILABLE_DIMENSIONS = [
  { key: "grammar", label: "Grammar" },
  { key: "confidence", label: "Confidence" },
  { key: "voice_ready", label: "Voice Ready" },
] as const;

interface DuplicateInfo {
  level: "low" | "medium" | "high";
  matches: Array<{ id: string; question_text: string; overlap: number }>;
}

function NotAvailableBadge({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="flex items-center gap-1 text-xs text-gray-400 italic">
        <HelpCircle className="w-3.5 h-3.5" /> Not available
      </span>
    </div>
  );
}

export default function ReviewCenterPage() {
  const [activeTab, setActiveTab] = useState<"questions" | "flashcard" | "lesson" | "voice_lesson">("questions");
  const [items, setItems] = useState<AIQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [approvedLocal, setApprovedLocal] = useState<Set<string>>(new Set());
  const [rejectionReason, setRejectionReason] = useState("");
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [editCategory, setEditCategory] = useState("aptitude");
  const [editDifficulty, setEditDifficulty] = useState<"easy" | "medium" | "hard">("medium");

  const [dupInfo, setDupInfo] = useState<DuplicateInfo | null>(null);
  const [dupLoading, setDupLoading] = useState(false);

  const [publishing, setPublishing] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  const selected = items.find((i) => i.id === selectedId) || null;

  const load = () => {
    setLoading(true);
    questionBankService
      .getReviewQueue()
      .then((res) => {
        setItems(res.questions);
        setSelectedId((prev) => prev && res.questions.some((q) => q.id === prev) ? prev : res.questions[0]?.id ?? null);
      })
      .catch(() => toast.error("Failed to load the review queue"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  useEffect(() => {
    if (!selected) {
      setDupInfo(null);
      return;
    }
    setEditing(false);
    setRejectionReason("");
    setDupInfo(null);
    setDupLoading(true);
    questionBankService
      .checkDuplicateRisk(selected.id, selected.text)
      .then(setDupInfo)
      .catch(() => setDupInfo(null))
      .finally(() => setDupLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const isApproved = selected ? approvedLocal.has(selected.id) : false;

  const handleApproveToggle = () => {
    if (!selected) return;
    setApprovedLocal((prev) => {
      const next = new Set(prev);
      next.has(selected.id) ? next.delete(selected.id) : next.add(selected.id);
      return next;
    });
  };

  const handlePublish = async () => {
    if (!selected) return;
    setPublishing(true);
    try {
      await questionBankService.approveQuestion(selected.id);
      toast.success("Published");
      setItems((prev) => prev.filter((i) => i.id !== selected.id));
      setApprovedLocal((prev) => {
        const next = new Set(prev);
        next.delete(selected.id);
        return next;
      });
      setSelectedId(null);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to publish");
    } finally {
      setPublishing(false);
    }
  };

  const handleReject = async () => {
    if (!selected) return;
    if (!rejectionReason.trim()) {
      toast.error("A rejection reason is required");
      return;
    }
    setRejecting(true);
    try {
      await questionBankService.rejectQuestion(selected.id, rejectionReason);
      toast.success("Rejected");
      setItems((prev) => prev.filter((i) => i.id !== selected.id));
      setSelectedId(null);
      setRejectionReason("");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to reject");
    } finally {
      setRejecting(false);
    }
  };

  const handleRegenerate = async () => {
    if (!selected) return;
    setRegenerating(true);
    try {
      const fresh = await questionBankService.regenerateItem({
        text: selected.text,
        category: selected.category,
        difficulty: selected.difficulty,
      });
      if (!fresh) {
        toast.error("The engine returned nothing — is it running?");
        return;
      }
      await questionBankService.rejectQuestion(selected.id, "Regenerated by reviewer");
      toast.success("Replacement generated — original rejected");
      setSelectedId(null);
      load();
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.response?.data?.message || "Regeneration failed");
    } finally {
      setRegenerating(false);
    }
  };

  const startEdit = () => {
    if (!selected) return;
    setEditText(selected.text);
    setEditCategory(selected.category);
    setEditDifficulty(selected.difficulty);
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await questionBankService.updateQuestion(selected.id, {
        question_text: editText,
        category: editCategory,
        difficulty_level: editDifficulty,
      });
      setItems((prev) =>
        prev.map((i) => (i.id === selected.id ? { ...i, text: editText, category: editCategory, difficulty: editDifficulty } : i))
      );
      toast.success("Saved");
      setEditing(false);
    } catch {
      toast.error("Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  const dupBadge = (level: DuplicateInfo["level"]) => {
    const cfg = {
      low: { text: "Low", cls: "bg-green-50 text-green-700" },
      medium: { text: "Possible match", cls: "bg-amber-50 text-amber-700" },
      high: { text: "High — likely duplicate", cls: "bg-red-50 text-red-700" },
    }[level];
    return <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${cfg.cls}`}>{cfg.text}</span>;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold tracking-tight text-gray-900 flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-admin-accent" />
          AI Review Center
        </h2>
        <p className="text-gray-500 mt-1">
          Every AI-generated item lands here first. Nothing publishes automatically.
        </p>
      </div>

      <div className="flex gap-2 mb-6">
        {(["questions", "flashcard", "lesson", "voice_lesson"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize ${
              activeTab === tab ? "bg-navy-900 text-white" : "bg-white border border-gray-200 text-gray-600"
            }`}
          >
            {tab === "questions" ? "Questions" : tab === "flashcard" ? "Flashcards" : tab === "lesson" ? "Lessons" : "Voice Lessons"}
          </button>
        ))}
      </div>

      {activeTab !== "questions" ? (
        <ContentItemsPanel contentType={activeTab} />
      ) : (
      <>
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-4">
          <p className="text-sm text-gray-600 mb-1">Pending Review</p>
          <p className="text-3xl font-display font-semibold text-amber-600">{items.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-4">
          <p className="text-sm text-gray-600 mb-1">Approved, awaiting publish</p>
          <p className="text-3xl font-display font-semibold text-blue-600">{approvedLocal.size}</p>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-gray-500">Loading…</div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-16 text-center">
          <ShieldCheck className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">Nothing pending review.</p>
          <p className="text-sm text-gray-400 mt-1">
            Content generated in <a href="/app/superadmin/learning-companion/studio" className="text-admin-accent underline">AI Content Studio</a> will appear here before it goes live.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Pending list */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card overflow-hidden">
              <div className="bg-gray-50 border-b border-gray-200 p-4">
                <h3 className="font-semibold text-gray-900">Pending ({items.length})</h3>
              </div>
              <div className="max-h-[36rem] overflow-y-auto divide-y divide-gray-100">
                {items.map((q) => (
                  <button
                    key={q.id}
                    onClick={() => setSelectedId(q.id)}
                    className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${selectedId === q.id ? "bg-navy-900/[0.06]" : ""}`}
                  >
                    <p className="text-sm font-medium text-gray-900 line-clamp-2">{q.text}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs px-2 py-0.5 bg-gray-100 rounded capitalize">{q.category.replace(/_/g, " ")}</span>
                      {approvedLocal.has(q.id) && (
                        <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-medium">Ready to publish</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Detail + quality card */}
          <div className="lg:col-span-2">
            {!selected ? (
              <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-12 text-center text-gray-500">
                Select an item to review
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-6">
                  {editing ? (
                    <div className="space-y-3">
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-admin-accent"
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <select value={editCategory} onChange={(e) => setEditCategory(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
                          {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
                        </select>
                        <select value={editDifficulty} onChange={(e) => setEditDifficulty(e.target.value as any)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
                          <option value="easy">Easy</option>
                          <option value="medium">Medium</option>
                          <option value="hard">Hard</option>
                        </select>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={saveEdit} disabled={saving} className="px-4 py-2 bg-navy-900 text-white rounded-lg text-sm font-medium hover:bg-navy-800 disabled:opacity-50">
                          {saving ? "Saving…" : "Save"}
                        </button>
                        <button onClick={() => setEditing(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <h3 className="text-lg font-semibold text-gray-900">{selected.text}</h3>
                        <button onClick={startEdit} className="p-2 text-gray-400 hover:text-admin-accent hover:bg-navy-900/[0.04] rounded-lg shrink-0" title="Edit">
                          <Pencil className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex gap-2 flex-wrap mb-4">
                        <span className="text-xs px-3 py-1 bg-navy-900/[0.06] text-navy-900 rounded-full font-medium capitalize">{selected.difficulty}</span>
                        <span className="text-xs px-2 py-1 bg-gray-100 rounded capitalize">{selected.category.replace(/_/g, " ")}</span>
                        <span className="text-xs px-2 py-1 bg-gray-100 rounded">{selected.source}</span>
                      </div>
                      {selected.options && selected.options.length > 0 && (
                        <div className="space-y-1.5 mb-4">
                          {selected.options.map((opt, i) => (
                            <div key={i} className={`text-sm px-3 py-1.5 rounded-lg border ${opt === selected.correctAnswer ? "bg-green-50 border-green-200 font-medium" : "bg-gray-50 border-gray-100"}`}>
                              {String.fromCharCode(65 + i)}. {opt}
                            </div>
                          ))}
                        </div>
                      )}
                      {selected.explanation && (
                        <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">{selected.explanation}</p>
                      )}
                    </>
                  )}
                </div>

                {/* AI Quality Card */}
                <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-6">
                  <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-admin-accent" /> AI Quality Card
                  </h4>
                  <div className="divide-y divide-gray-100">
                    <NotAvailableBadge label="Grammar" />
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm text-gray-500">Duplicate Risk</span>
                      {dupLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                      ) : dupInfo ? (
                        dupBadge(dupInfo.level)
                      ) : (
                        <span className="text-xs text-gray-400 italic">Not available</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm text-gray-500">Bloom</span>
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${selected.bloomLevel ? "bg-purple-50 text-purple-700" : "bg-gray-100 text-gray-500"}`}>
                        {selected.bloomLevel || "Not set"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm text-gray-500">Difficulty</span>
                      <span className="text-xs px-2.5 py-1 rounded-full font-medium capitalize bg-navy-900/[0.06] text-navy-900">{selected.difficulty}</span>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm text-gray-500">Skills</span>
                      <span className="text-xs text-gray-700 text-right max-w-[60%]">
                        {selected.tags.filter((t) => !isSystemTag(t)).join(", ") || "None tagged"}
                      </span>
                    </div>
                    {NOT_AVAILABLE_DIMENSIONS.slice(1).map((d) => <NotAvailableBadge key={d.key} label={d.label} />)}
                  </div>
                  {dupInfo && dupInfo.matches.length > 0 && (
                    <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                      <div className="flex items-center gap-1.5 font-medium mb-1"><AlertTriangle className="w-3.5 h-3.5" /> Similar existing question(s)</div>
                      <ul className="list-disc pl-4 space-y-0.5">
                        {dupInfo.matches.slice(0, 3).map((m) => (
                          <li key={m.id}>{m.overlap}% overlap — "{m.question_text.slice(0, 70)}{m.question_text.length > 70 ? "…" : ""}"</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-6">
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Rejection reason (required to reject)</label>
                    <textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      rows={2}
                      placeholder="Why is this being rejected?"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-admin-accent"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={handleApproveToggle}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${isApproved ? "bg-blue-50 text-blue-700 border border-blue-200" : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"}`}
                    >
                      <CheckCircle2 className="w-4 h-4" /> {isApproved ? "Approved" : "Approve"}
                    </button>
                    <button onClick={startEdit} className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
                      <Pencil className="w-4 h-4" /> Edit
                    </button>
                    <button
                      onClick={handleRegenerate}
                      disabled={regenerating}
                      className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <RotateCcw className={`w-4 h-4 ${regenerating ? "animate-spin" : ""}`} /> {regenerating ? "Regenerating…" : "Regenerate"}
                    </button>
                    <button
                      onClick={handleReject}
                      disabled={rejecting}
                      className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-100 disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4" /> {rejecting ? "Rejecting…" : "Reject"}
                    </button>
                    <button
                      onClick={handlePublish}
                      disabled={!isApproved || publishing}
                      title={!isApproved ? "Approve first — nothing publishes automatically" : undefined}
                      className="ml-auto flex items-center gap-2 px-5 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <UploadCloud className="w-4 h-4" /> {publishing ? "Publishing…" : "Publish"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
}
