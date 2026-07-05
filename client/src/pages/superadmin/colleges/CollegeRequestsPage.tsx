import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { CheckIcon, XMarkIcon } from "@heroicons/react/24/outline";
import collegeService, { CollegeRequest } from "../../../services/collegeService";

export default function CollegeRequestsPage() {
  const [requests, setRequests] = useState<CollegeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingOn, setActingOn] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setRequests(await collegeService.getPendingRequests());
    } catch {
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  const handleApprove = async (id: string) => {
    setActingOn(id);
    try {
      await collegeService.approveCollege(id);
      toast.success("College approved");
      await load();
    } catch {
      toast.error("Failed to approve college");
    } finally {
      setActingOn(null);
    }
  };

  const handleReject = async (id: string) => {
    setActingOn(id);
    try {
      await collegeService.rejectCollege(id, "Rejected by superadmin");
      toast.success("College rejected");
      await load();
    } catch {
      toast.error("Failed to reject college");
    } finally {
      setActingOn(null);
    }
  };

  const pending = requests;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">College Requests</h2>
          <p className="text-gray-600 mt-1">Review and approve pending college registrations</p>
        </div>
        {pendingCount > 0 && (
          <div className="px-4 py-2 bg-red-100 text-red-800 rounded-lg font-semibold">
            {pendingCount} pending
          </div>
        )}
      </div>

      {loading ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-600">
          Loading requests...
        </div>
      ) : (
        <>
          {/* Pending Requests */}
          {pending.length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Pending Approval</h3>
              <div className="space-y-4">
                {pending.map((request) => (
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

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(request.id)}
                        disabled={actingOn === request.id}
                        className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-lg font-medium hover:bg-green-100 transition-colors disabled:opacity-50"
                      >
                        <CheckIcon className="w-4 h-4" />
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(request.id)}
                        disabled={actingOn === request.id}
                        className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 rounded-lg font-medium hover:bg-red-100 transition-colors disabled:opacity-50"
                      >
                        <XMarkIcon className="w-4 h-4" />
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {pending.length === 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
              <p className="text-gray-600">No college requests</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
