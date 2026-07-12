import { useState, useEffect } from "react";
import { CheckCircle2, XCircle, Check } from "lucide-react";
import toast from "react-hot-toast";
import questionBankService from "../../../services/questionBankService";

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
  status: "pending" | "approved" | "rejected";
  quality_score: number;
}

export default function ReviewQueuePage() {
  const [questions, setQuestions] = useState<AIQuestion[]>([]);
  const [selectedQuestion, setSelectedQuestion] = useState<AIQuestion | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadQueue = async () => {
      setLoading(true);
      try {
        const data = await questionBankService.getReviewQueue();
        setQuestions(data.questions);
        if (data.questions.length > 0) {
          setSelectedQuestion(data.questions[0]);
        }
      } catch (error) {
        toast.error("Failed to load review queue");
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    loadQueue();
  }, []);

  const pendingQuestions = questions.filter((q) => q.status === "pending");
  const approvedCount = questions.filter((q) => q.status === "approved").length;
  const rejectedCount = questions.filter((q) => q.status === "rejected").length;

  const handleApprove = async (id: string) => {
    try {
      await questionBankService.approveQuestion(id);
      setQuestions((prev) =>
        prev.map((q) => (q.id === id ? { ...q, status: "approved" as const } : q))
      );
      toast.success("Question approved!");
      setSelectedQuestion(null);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to approve");
      console.error(error);
    }
  };

  const handleReject = async (id: string) => {
    if (!rejectionReason.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }
    try {
      await questionBankService.rejectQuestion(id, rejectionReason);
      setQuestions((prev) =>
        prev.map((q) => (q.id === id ? { ...q, status: "rejected" as const } : q))
      );
      toast.success("Question rejected");
      setRejectionReason("");
      setSelectedQuestion(null);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to reject");
      console.error(error);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-semibold tracking-tight text-gray-900">Review Queue</h2>
        <p className="text-gray-500 mt-1">Review and approve AI-generated questions before publishing.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-4">
          <p className="text-sm text-gray-600 mb-1">Pending Review</p>
          <p className="text-3xl font-display font-semibold text-yellow-600">{pendingQuestions.length}</p>
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

      {/* Main Review Area */}
      {loading ? (
        <div className="p-12 text-center">
          <p className="text-gray-600">Loading review queue...</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-6">
        {/* Questions List */}
        <div className="col-span-1">
          <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card overflow-hidden">
            <div className="bg-gray-50 border-b border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900">Pending Questions</h3>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {pendingQuestions.length === 0 ? (
                <div className="p-4 text-center text-gray-500 text-sm">No pending questions</div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {pendingQuestions.map((q) => (
                    <button
                      key={q.id}
                      onClick={() => setSelectedQuestion(q)}
                      className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${
                        selectedQuestion?.id === q.id ? "bg-navy-900/[0.06]" : ""
                      }`}
                    >
                      <p className="text-sm font-medium text-gray-900 line-clamp-2">{q.text}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs px-2 py-1 bg-gray-100 rounded">
                          Score: {q.quality_score}%
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Question Detail Review */}
        <div className="col-span-2">
          {selectedQuestion ? (
            <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-6">
              {/* Question Text */}
              <div className="mb-6">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-lg font-semibold text-gray-900 flex-1">{selectedQuestion.text}</h3>
                  <div className="text-right">
                    <p className="text-xs text-gray-500 mb-1">Quality Score</p>
                    <div className="text-2xl font-bold text-green-600">{selectedQuestion.quality_score}%</div>
                  </div>
                </div>

                {/* Metadata */}
                <div className="flex gap-2 flex-wrap">
                  <span className="text-xs px-3 py-1 bg-navy-900/[0.06] text-navy-900 rounded-full font-medium capitalize">
                    {selectedQuestion.difficulty}
                  </span>
                  <span className="text-xs px-2 py-1 bg-gray-100 rounded">{selectedQuestion.category}</span>
                  <span className="text-xs px-2 py-1 bg-gray-100 rounded">From: {selectedQuestion.source}</span>
                </div>
              </div>

              {/* Options */}
              {selectedQuestion.options && (
                <div className="mb-6 pb-6 border-b border-gray-200">
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

              {/* Explanation */}
              {selectedQuestion.explanation && (
                <div className="mb-6 pb-6 border-b border-gray-200">
                  <h4 className="font-semibold text-gray-900 mb-2">Explanation</h4>
                  <p className="text-sm text-gray-700">{selectedQuestion.explanation}</p>
                </div>
              )}

              {/* Action Section */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Rejection Reason (if rejecting)
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
                    onClick={() => handleApprove(selectedQuestion.id)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Approve
                  </button>
                  <button
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
