import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Check, X } from "lucide-react";
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
    } catch (e: any) {
      toast.error(e?.response?.data?.error || e?.response?.data?.message || "Failed to approve college");
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
    } catch (e: any) {
      toast.error(e?.response?.data?.error || e?.response?.data?.message || "Failed to reject college");
    } finally {
      setActingOn(null);
    }
  };

  const pending = requests;

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-gray-900">College Requests</h2>
          <p className="text-gray-500 mt-1">Review and approve pending college registrations.</p>
        </div>
        {pendingCount > 0 && (
          <div className="px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-sm font-semibold">
            {pendingCount} pending
          </div>
        )}
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-12 text-center text-gray-500">
          Loading requests...
        </div>
      ) : pending.length > 0 ? (
        <div className="space-y-4">
          {pending.map((request) => (
            <div key={request.id} className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-6">
              <div className="mb-4">
                <h4 className="text-lg font-semibold text-gray-900">{request.name}</h4>
                <p className="text-sm text-gray-500 mt-1">
                  Submitted {new Date(request.created_at).toLocaleDateString()}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Email</p>
                  <p className="text-sm font-medium text-gray-900 mt-0.5">{request.email || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">City</p>
                  <p className="text-sm font-medium text-gray-900 mt-0.5">{request.city || "—"}</p>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleApprove(request.id)}
                  disabled={actingOn === request.id}
                  className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-lg text-sm font-medium hover:bg-green-100 transition-colors disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  Approve
                </button>
                <button
                  onClick={() => handleReject(request.id)}
                  disabled={actingOn === request.id}
                  className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-12 text-center">
          <p className="text-gray-500">No college requests</p>
        </div>
      )}
    </div>
  );
}
