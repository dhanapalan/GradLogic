// =============================================================================
// Review panel for Flashcards / Lessons / Voice Lessons — the non-question
// counterpart to the Questions review flow in ReviewCenterPage. Same
// approve -> publish discipline: nothing goes live without an explicit
// Publish click. Lessons/voice lessons additionally need a target course +
// module chosen before they can publish (they land as real lesson rows).
// =============================================================================

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, UploadCloud, Layers } from "lucide-react";
import toast from "react-hot-toast";
import questionBankService, { AIContentItem } from "../../../services/questionBankService";
import lmsCourseService, { Course, CourseDetail } from "../../../services/lmsCourseService";

interface Props {
  contentType: "flashcard" | "lesson" | "voice_lesson";
}

export default function ContentItemsPanel({ contentType }: Props) {
  const [items, setItems] = useState<AIContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [busy, setBusy] = useState(false);

  const needsModule = contentType === "lesson" || contentType === "voice_lesson";
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState("");
  const [courseDetail, setCourseDetail] = useState<CourseDetail | null>(null);
  const [moduleId, setModuleId] = useState("");

  const load = () => {
    setLoading(true);
    questionBankService
      .listContentItems({ content_type: contentType })
      .then((rows) => setItems(rows.filter((r) => r.status !== "published" && r.status !== "rejected")))
      .catch(() => toast.error("Failed to load content"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    setSelectedId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentType]);

  useEffect(() => {
    if (needsModule) {
      lmsCourseService.listCourses().then(setCourses).catch(() => setCourses([]));
    }
  }, [needsModule]);

  useEffect(() => {
    if (!courseId) {
      setCourseDetail(null);
      return;
    }
    lmsCourseService.getCourse(courseId).then(setCourseDetail).catch(() => setCourseDetail(null));
  }, [courseId]);

  const selected = items.find((i) => i.id === selectedId) || null;

  const approve = async (id: string) => {
    setBusy(true);
    try {
      await questionBankService.approveContentItem(id);
      toast.success("Approved");
      load();
    } catch {
      toast.error("Failed to approve");
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    if (!selected || !rejectionReason.trim()) {
      toast.error("A rejection reason is required");
      return;
    }
    setBusy(true);
    try {
      await questionBankService.rejectContentItem(selected.id, rejectionReason.trim());
      toast.success("Rejected");
      setSelectedId(null);
      setRejecting(false);
      setRejectionReason("");
      load();
    } catch {
      toast.error("Failed to reject");
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    if (!selected) return;
    if (needsModule && !moduleId) {
      toast.error("Choose a course and module first");
      return;
    }
    setBusy(true);
    try {
      await questionBankService.publishContentItem(selected.id, needsModule ? moduleId : undefined);
      toast.success("Published");
      setSelectedId(null);
      setModuleId("");
      load();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to publish");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="p-12 text-center text-gray-500">Loading…</div>;

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-16 text-center">
        <Layers className="w-8 h-8 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-600 font-medium">Nothing pending review.</p>
        <p className="text-sm text-gray-400 mt-1">
          Generate this content type in{" "}
          <a href="/app/superadmin/learning-companion/studio" className="text-admin-accent underline">
            AI Content Studio
          </a>{" "}
          first.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1">
        <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card overflow-hidden">
          <div className="bg-gray-50 border-b border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900">Pending ({items.length})</h3>
          </div>
          <div className="max-h-[36rem] overflow-y-auto divide-y divide-gray-100">
            {items.map((it) => (
              <button
                key={it.id}
                onClick={() => setSelectedId(it.id)}
                className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${selectedId === it.id ? "bg-navy-900/[0.06]" : ""}`}
              >
                <p className="text-sm font-medium text-gray-900 line-clamp-2">{it.title}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs px-2 py-0.5 bg-gray-100 rounded capitalize">{it.category.replace(/_/g, " ")}</span>
                  {it.status === "approved" && (
                    <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-medium">Ready to publish</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="lg:col-span-2">
        {!selected ? (
          <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-16 text-center text-gray-400">
            Select an item to review
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-6 space-y-4">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase mb-1">
                {contentType === "flashcard" ? "Front" : "Title"}
              </p>
              <p className="font-medium text-gray-900">{selected.title}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase mb-1">
                {contentType === "flashcard" ? "Back" : "Body"}
              </p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-lg px-3 py-2">{selected.body}</p>
            </div>
            {selected.explanation && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase mb-1">Notes</p>
                <p className="text-sm text-gray-600">{selected.explanation}</p>
              </div>
            )}

            {needsModule && selected.status === "approved" && (
              <div className="border border-gray-200 rounded-lg p-4 space-y-2">
                <p className="text-xs font-medium text-gray-500 uppercase">Publish into</p>
                <select
                  value={courseId}
                  onChange={(e) => {
                    setCourseId(e.target.value);
                    setModuleId("");
                  }}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                >
                  <option value="">Select course…</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
                {courseDetail && (
                  <select
                    value={moduleId}
                    onChange={(e) => setModuleId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  >
                    <option value="">Select module…</option>
                    {courseDetail.modules.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.title}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {rejecting ? (
              <div className="space-y-2">
                <textarea
                  rows={2}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Rejection reason (required)"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
                <div className="flex gap-2">
                  <button onClick={reject} disabled={busy} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                    Confirm Reject
                  </button>
                  <button onClick={() => setRejecting(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 pt-2">
                {selected.status !== "approved" && (
                  <button
                    onClick={() => approve(selected.id)}
                    disabled={busy}
                    className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Approve
                  </button>
                )}
                <button
                  onClick={() => setRejecting(true)}
                  disabled={busy}
                  className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-100"
                >
                  <XCircle className="w-4 h-4" /> Reject
                </button>
                <button
                  onClick={publish}
                  disabled={selected.status !== "approved" || busy}
                  title={selected.status !== "approved" ? "Approve first — nothing publishes automatically" : undefined}
                  className="ml-auto flex items-center gap-2 px-5 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <UploadCloud className="w-4 h-4" /> Publish
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
