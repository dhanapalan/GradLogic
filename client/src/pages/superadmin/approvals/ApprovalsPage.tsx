import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { CheckIcon, XMarkIcon } from "@heroicons/react/24/outline";
import collegeService, { CollegeRequest } from "../../../services/collegeService";
import questionBankService, { AIQuestion } from "../../../services/questionBankService";

type Tab = "colleges" | "questions" | "other";

const TABS: { key: Tab; label: string }[] = [
  { key: "colleges", label: "Pending College Registrations" },
  { key: "questions", label: "Pending AI Questions" },
  { key: "other", label: "Other Requests" },
];

// Which item (by composite key "colleges:id" or "questions:id") currently has its
// comment box open, and whether that box is in approve or reject mode.
interface ActiveComment {
  key: string;
  mode: "approve" | "reject";
}

export default function ApprovalsPage() {
  const [tab, setTab] = useState<Tab>("colleges");

  const [collegeRequests, setCollegeRequests] = useState<CollegeRequest[]>([]);
  const [loadingColleges, setLoadingColleges] = useState(true);

  const [questions, setQuestions] = useState<AIQuestion[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(true);

  const [active, setActive] = useState<ActiveComment | null>(null);
  const [comment, setComment] = useState("");
  const [acting, setActing] = useState(false);

  const loadColleges = () => {
    setLoadingColleges(true);
    collegeService
      .getPendingRequests()
      .then(setCollegeRequests)
      .catch(() => setCollegeRequests([]))
      .finally(() => setLoadingColleges(false));
  };

  const loadQuestions = () => {
    setLoadingQuestions(true);
    questionBankService
      .getReviewQueue()
      .then((res) => setQuestions(res.questions.filter((q) => q.status === "pending")))
      .catch(() => setQuestions([]))
      .finally(() => setLoadingQuestions(false));
  };

  useEffect(() => {
    loadColleges();
    loadQuestions();
  }, []);

  const openComment = (key: string, mode: "approve" | "reject") => {
    setActive({ key, mode });
    setComment("");
  };

  const closeComment = () => {
    setActive(null);
    setComment("");
  };

  const confirmCollege = async (id: string) => {
    if (!active) return;
    if (active.mode === "reject" && !comment.trim()) {
      toast.error("A reason is required to reject");
      return;
    }
    setActing(true);
    try {
      if (active.mode === "approve") {
        const res = await collegeService.approveCollege(id, comment.trim() || undefined);
        toast.success(res.message);
      } else {
        const res = await collegeService.rejectCollege(id, comment.trim());
        toast.success(res.message);
      }
      closeComment();
      loadColleges();
    } catch {
      toast.error(`Failed to ${active.mode} college`);
    } finally {
      setActing(false);
    }
  };

  const confirmQuestion = async (id: string) => {
    if (!active) return;
    if (active.mode === "reject" && !comment.trim()) {
      toast.error("A reason is required to reject");
      return;
    }
    setActing(true);
    try {
      if (active.mode === "approve") {
        const res = await questionBankService.approveQuestion(id, comment.trim() || undefined);
        toast.success(res.message);
      } else {
        const res = await questionBankService.rejectQuestion(id, comment.trim());
        toast.success(res.message);
      }
      closeComment();
      loadQuestions();
    } catch {
      toast.error(`Failed to ${active.mode} question`);
    } finally {
      setActing(false);
    }
  };

  const pendingCollegeCount = collegeRequests.length;
  const pendingQuestionCount = questions.length;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900">Approvals</h2>
        <p className="text-gray-600 mt-1">Review and act on pending requests across the platform</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-6">
          {TABS.map((t) => {
            const count =
              t.key === "colleges" ? pendingCollegeCount : t.key === "questions" ? pendingQuestionCount : 0;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`pb-3 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2 ${
                  tab === t.key
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {t.label}
                {count > 0 && (
                  <span className="px-2 py-0.5 bg-red-100 text-red-800 rounded-full text-xs font-semibold">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Pending College Registrations */}
      {tab === "colleges" && (
        <div>
          {loadingColleges ? (
            <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-600">
              Loading...
            </div>
          ) : collegeRequests.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-600">
              No pending college registrations
            </div>
          ) : (
            <div className="space-y-4">
              {collegeRequests.map((request) => {
                const key = `colleges:${request.id}`;
                return (
                  <div key={request.id} className="bg-white rounded-lg border border-gray-200 p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h4 className="text-lg font-semibold text-gray-900">{request.name}</h4>
                        <p className="text-sm text-gray-600 mt-1">
                          Submitted {new Date(request.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-xs text-gray-500 uppercase">Email</p>
                        <p className="text-sm font-medium text-gray-900">{request.email || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase">City</p>
                        <p className="text-sm font-medium text-gray-900">{request.city || "—"}</p>
                      </div>
                    </div>

                    {active?.key === key ? (
                      <div className="border-t border-gray-100 pt-4">
                        <textarea
                          rows={2}
                          value={comment}
                          onChange={(e) => setComment(e.target.value)}
                          placeholder={
                            active.mode === "approve"
                              ? "Optional comment..."
                              : "Reason for rejection (required)..."
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-2"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => confirmCollege(request.id)}
                            disabled={acting}
                            className={`px-4 py-2 rounded-lg font-medium text-white disabled:opacity-50 ${
                              active.mode === "approve" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"
                            }`}
                          >
                            Confirm {active.mode === "approve" ? "Approval" : "Rejection"}
                          </button>
                          <button
                            onClick={closeComment}
                            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={() => openComment(key, "approve")}
                          className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-lg font-medium hover:bg-green-100 transition-colors"
                        >
                          <CheckIcon className="w-4 h-4" />
                          Approve
                        </button>
                        <button
                          onClick={() => openComment(key, "reject")}
                          className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 rounded-lg font-medium hover:bg-red-100 transition-colors"
                        >
                          <XMarkIcon className="w-4 h-4" />
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Pending AI Questions */}
      {tab === "questions" && (
        <div>
          {loadingQuestions ? (
            <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-600">
              Loading...
            </div>
          ) : questions.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-600">
              No pending AI-generated questions
            </div>
          ) : (
            <div className="space-y-4">
              {questions.map((q) => {
                const key = `questions:${q.id}`;
                return (
                  <div key={q.id} className="bg-white rounded-lg border border-gray-200 p-6">
                    <div className="flex items-start justify-between mb-3">
                      <p className="text-sm font-medium text-gray-900 flex-1">{q.text}</p>
                      <span className="ml-3 px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded whitespace-nowrap">
                        {q.category} · {q.difficulty}
                      </span>
                    </div>
                    {q.options && q.options.length > 0 && (
                      <ul className="text-sm text-gray-600 mb-3 space-y-1">
                        {q.options.map((opt, i) => (
                          <li key={i} className={opt === q.correctAnswer ? "font-semibold text-green-700" : ""}>
                            {String.fromCharCode(65 + i)}. {opt}
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="text-xs text-gray-500 mb-4">
                      Generated {new Date(q.generatedAt).toLocaleDateString()}
                    </p>

                    {active?.key === key ? (
                      <div className="border-t border-gray-100 pt-4">
                        <textarea
                          rows={2}
                          value={comment}
                          onChange={(e) => setComment(e.target.value)}
                          placeholder={
                            active.mode === "approve"
                              ? "Optional comment..."
                              : "Reason for rejection (required)..."
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-2"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => confirmQuestion(q.id)}
                            disabled={acting}
                            className={`px-4 py-2 rounded-lg font-medium text-white disabled:opacity-50 ${
                              active.mode === "approve" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"
                            }`}
                          >
                            Confirm {active.mode === "approve" ? "Approval" : "Rejection"}
                          </button>
                          <button
                            onClick={closeComment}
                            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={() => openComment(key, "approve")}
                          className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-lg font-medium hover:bg-green-100 transition-colors"
                        >
                          <CheckIcon className="w-4 h-4" />
                          Approve
                        </button>
                        <button
                          onClick={() => openComment(key, "reject")}
                          className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 rounded-lg font-medium hover:bg-red-100 transition-colors"
                        >
                          <XMarkIcon className="w-4 h-4" />
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Other Requests */}
      {tab === "other" && (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-600">
          No other pending request types yet. This tab is reserved for future approval workflows
          (e.g. content flags, role change requests).
        </div>
      )}
    </div>
  );
}
