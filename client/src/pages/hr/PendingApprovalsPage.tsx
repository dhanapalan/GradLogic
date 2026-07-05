import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import api from "../../lib/api";
import toast from "react-hot-toast";
import { CheckCircleIcon, XCircleIcon, EyeIcon } from "@heroicons/react/24/outline";

interface PendingCollege {
  id: string;
  name: string;
  college_code: string;
  city?: string;
  state?: string;
  tier?: string;
  created_at: string;
  approval_status: string;
  created_by_name?: string;
  created_by_email?: string;
}

export default function PendingApprovalsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [selectedCollege, setSelectedCollege] = useState<PendingCollege | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);

  const limit = 20;

  // Fetch pending colleges
  const { data, isLoading } = useQuery({
    queryKey: ["pendingColleges", page],
    queryFn: async () => {
      const { data } = await api.get(
        `/campuses/approval/pending?page=${page}&limit=${limit}`
      );
      return data;
    },
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async (collegeId: string) => {
      return api.post(`/campuses/${collegeId}/approve`, { notes: "" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pendingColleges"] });
      setSelectedCollege(null);
      toast.success("College approved successfully");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Failed to approve");
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: async (collegeId: string) => {
      return api.post(`/campuses/${collegeId}/reject`, {
        rejection_reason: rejectionReason,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pendingColleges"] });
      setSelectedCollege(null);
      setShowRejectModal(false);
      setRejectionReason("");
      toast.success("College rejected");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Failed to reject");
    },
  });

  const handleApprove = (college: PendingCollege) => {
    if (window.confirm(`Approve "${college.name}"?`)) {
      approveMutation.mutate(college.id);
    }
  };

  const handleReject = (college: PendingCollege) => {
    setSelectedCollege(college);
    setShowRejectModal(true);
  };

  const confirmReject = () => {
    if (!rejectionReason.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }
    if (selectedCollege) {
      rejectMutation.mutate(selectedCollege.id);
    }
  };

  const colleges = data?.data ?? [];
  const meta = data?.meta ?? { page: 1, limit, total: 0, totalPages: 1 };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">
            Pending College Approvals
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Review and approve or reject new college onboarding requests
          </p>
        </div>
        <div className="px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm font-bold text-amber-900">{meta.total} Pending</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-gray-500">Loading...</p>
          </div>
        ) : colleges.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <CheckCircleIcon className="h-12 w-12 text-green-500 mb-3" />
            <p className="text-gray-700 font-bold">All caught up!</p>
            <p className="text-sm text-gray-500">No pending approvals</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left font-bold text-slate-700">
                    College Name
                  </th>
                  <th className="px-6 py-3 text-left font-bold text-slate-700">
                    Location
                  </th>
                  <th className="px-6 py-3 text-left font-bold text-slate-700">
                    Requested By
                  </th>
                  <th className="px-6 py-3 text-left font-bold text-slate-700">
                    Date
                  </th>
                  <th className="px-6 py-3 text-right font-bold text-slate-700">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {colleges.map((college: PendingCollege) => (
                  <tr
                    key={college.id}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-bold text-gray-900">{college.name}</p>
                        <p className="text-xs text-gray-500">
                          Code: {college.college_code}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {[college.city, college.state, college.tier]
                        .filter(Boolean)
                        .join(", ") || "—"}
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-gray-900">
                          {college.created_by_name || "—"}
                        </p>
                        <p className="text-xs text-gray-500">
                          {college.created_by_email}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600 text-xs">
                      {new Date(college.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleApprove(college)}
                          disabled={approveMutation.isPending}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 font-bold text-xs rounded-lg hover:bg-green-100 border border-green-200 transition-colors disabled:opacity-50"
                        >
                          <CheckCircleIcon className="h-4 w-4" />
                          Approve
                        </button>
                        <button
                          onClick={() => handleReject(college)}
                          disabled={rejectMutation.isPending}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 font-bold text-xs rounded-lg hover:bg-red-100 border border-red-200 transition-colors disabled:opacity-50"
                        >
                          <XCircleIcon className="h-4 w-4" />
                          Reject
                        </button>
                        <button
                          onClick={() => setSelectedCollege(college)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 text-slate-700 font-bold text-xs rounded-lg hover:bg-slate-100 border border-slate-200 transition-colors"
                        >
                          <EyeIcon className="h-4 w-4" />
                          Details
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {page} of {meta.totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))}
            disabled={page === meta.totalPages}
            className="px-3 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}

      {/* Rejection Reason Modal */}
      {showRejectModal && selectedCollege && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-xl font-bold text-gray-900">
                Reject College
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {selectedCollege.name}
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Rejection Reason
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Provide a detailed reason for rejection..."
                  rows={4}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  This will be visible to the college contact
                </p>
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t border-slate-200">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectionReason("");
                }}
                className="flex-1 px-4 py-2 border border-slate-300 text-gray-700 font-bold rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmReject}
                disabled={!rejectionReason.trim() || rejectMutation.isPending}
                className="flex-1 px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
