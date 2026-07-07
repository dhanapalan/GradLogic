import { useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { CheckIcon, InboxIcon } from "@heroicons/react/24/outline";
import { LiveActionItem } from "../../services/superadminMetrics";
import collegeService from "../../services/collegeService";
import questionBankService from "../../services/questionBankService";

interface ActionInboxProps {
  items: LiveActionItem[];
  totalPending: number;
  loading?: boolean;
  onActionComplete?: () => void;
}

const TYPE_LABEL: Record<LiveActionItem["type"], string> = {
  college: "College",
  question: "Question",
  payment: "Payment",
};

export default function ActionInbox({ items, totalPending, loading, onActionComplete }: ActionInboxProps) {
  const [actingId, setActingId] = useState<string | null>(null);
  const [rejectItem, setRejectItem] = useState<LiveActionItem | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const handleApprove = async (item: LiveActionItem) => {
    setActingId(item.id);
    try {
      if (item.type === "college") {
        toast.success((await collegeService.approveCollege(item.entityId)).message || "Approved");
      } else if (item.type === "question") {
        toast.success((await questionBankService.approveQuestion(item.entityId)).message || "Approved");
      }
      onActionComplete?.();
    } catch {
      toast.error("Approve failed");
    } finally {
      setActingId(null);
    }
  };

  const handleReject = async () => {
    if (!rejectItem || !rejectReason.trim()) {
      toast.error("Reason required");
      return;
    }
    setActingId(rejectItem.id);
    try {
      if (rejectItem.type === "college") {
        toast.success((await collegeService.rejectCollege(rejectItem.entityId, rejectReason.trim())).message || "Rejected");
      } else if (rejectItem.type === "question") {
        toast.success((await questionBankService.rejectQuestion(rejectItem.entityId, rejectReason.trim())).message || "Rejected");
      }
      setRejectItem(null);
      setRejectReason("");
      onActionComplete?.();
    } catch {
      toast.error("Reject failed");
    } finally {
      setActingId(null);
    }
  };

  return (
    <>
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm h-full flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <InboxIcon className="w-4 h-4 text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-900">Action inbox</h3>
          </div>
          {totalPending > 0 && (
            <span className="rounded-full bg-gray-900 text-white px-2 py-0.5 text-xs font-medium tabular-nums">
              {totalPending}
            </span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <div className="p-4 space-y-2">{[1, 2].map((i) => <div key={i} className="h-12 bg-gray-50 rounded animate-pulse" />)}</div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <CheckIcon className="w-8 h-8 text-gray-300" />
              <p className="text-sm text-gray-500 mt-2">All caught up</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {items.map((item) => {
                const busy = actingId === item.id;
                return (
                  <li key={item.id} className="px-4 py-3 hover:bg-gray-50/80">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">{TYPE_LABEL[item.type]}</p>
                    <p className="text-sm font-medium text-gray-900 mt-0.5 line-clamp-1">{item.title}</p>
                    <p className="text-xs text-gray-500 truncate">{item.subtitle}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {(item.type === "college" || item.type === "question") && (
                        <>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleApprove(item)}
                            className="rounded-md bg-gray-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => { setRejectItem(item); setRejectReason(""); }}
                            className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      <Link to={item.href} className="rounded-md border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50">
                        View
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {rejectItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl border border-gray-200">
            <h4 className="text-sm font-semibold text-gray-900">Reject {TYPE_LABEL[rejectItem.type].toLowerCase()}</h4>
            <p className="text-sm text-gray-500 mt-1 line-clamp-2">{rejectItem.title}</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason (required)"
              rows={3}
              className="mt-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button type="button" onClick={() => setRejectItem(null)} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
              <button type="button" onClick={handleReject} disabled={!!actingId} className="px-3 py-1.5 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800 disabled:opacity-50">Confirm</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
