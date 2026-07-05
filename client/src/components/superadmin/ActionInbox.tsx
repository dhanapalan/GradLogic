import { useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import {
  BuildingOffice2Icon,
  CheckIcon,
  ClipboardDocumentListIcon,
  CurrencyRupeeIcon,
  InboxIcon,
} from "@heroicons/react/24/outline";
import { LiveActionItem } from "../../services/superadminMetrics";
import collegeService from "../../services/collegeService";
import questionBankService from "../../services/questionBankService";

interface ActionInboxProps {
  items: LiveActionItem[];
  totalPending: number;
  loading?: boolean;
  onActionComplete?: () => void;
}

const TYPE_CONFIG = {
  college: { icon: BuildingOffice2Icon, badge: "bg-amber-100 text-amber-800", label: "College", accent: "border-l-amber-400" },
  question: { icon: ClipboardDocumentListIcon, badge: "bg-violet-100 text-violet-800", label: "AI Question", accent: "border-l-violet-400" },
  payment: { icon: CurrencyRupeeIcon, badge: "bg-rose-100 text-rose-800", label: "Payment", accent: "border-l-rose-400" },
};

export default function ActionInbox({ items, totalPending, loading, onActionComplete }: ActionInboxProps) {
  const [actingId, setActingId] = useState<string | null>(null);
  const [rejectItem, setRejectItem] = useState<LiveActionItem | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const handleApprove = async (item: LiveActionItem) => {
    setActingId(item.id);
    try {
      if (item.type === "college") {
        toast.success((await collegeService.approveCollege(item.entityId)).message || "College approved");
      } else if (item.type === "question") {
        toast.success((await questionBankService.approveQuestion(item.entityId)).message || "Question approved");
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
    <div className="bg-white rounded-xl border border-orange-200 shadow-sm overflow-hidden h-full flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-orange-100 bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 shrink-0">
        <div className="flex items-center gap-1.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/25 text-white">
            <InboxIcon className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white">Action Inbox</h3>
          </div>
        </div>
        {totalPending > 0 && (
          <span className="rounded-full bg-white text-orange-600 px-2 py-0.5 text-[10px] font-bold">{totalPending}</span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {loading ? (
          <div className="p-4 space-y-2">{[1, 2].map((i) => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}</div>
        ) : items.length === 0 ? (
          <div className="p-6 text-center">
            <CheckIcon className="w-7 h-7 text-emerald-500 mx-auto" />
            <p className="text-xs text-gray-500 mt-1">Inbox zero</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {items.map((item) => {
              const cfg = TYPE_CONFIG[item.type];
              const Icon = cfg.icon;
              const busy = actingId === item.id;
              return (
                <li key={item.id} className={`border-l-4 ${cfg.accent} px-3 py-2 hover:bg-gray-50/80`}>
                  <div className="flex items-start gap-2">
                    <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded ${cfg.badge}`}>
                      <Icon className="w-3 h-3" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium text-gray-900 line-clamp-1">{item.title}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(item.type === "college" || item.type === "question") && (
                          <>
                            <button type="button" disabled={busy} onClick={() => handleApprove(item)}
                              className="rounded bg-emerald-600 px-1.5 py-0.5 text-[9px] font-bold text-white disabled:opacity-50">OK</button>
                            <button type="button" disabled={busy} onClick={() => { setRejectItem(item); setRejectReason(""); }}
                              className="rounded bg-rose-100 px-1.5 py-0.5 text-[9px] font-bold text-rose-700">No</button>
                          </>
                        )}
                        <Link to={item.href} className="rounded border border-gray-200 px-1.5 py-0.5 text-[9px] text-gray-600">View</Link>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>

      {rejectItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h4 className="font-semibold text-gray-900">Reject {rejectItem.type === "college" ? "college" : "question"}</h4>
            <p className="text-sm text-gray-500 mt-1 line-clamp-2">{rejectItem.title}</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason (required)"
              rows={3}
              className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-rose-400 focus:ring-1 focus:ring-rose-400"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button type="button" onClick={() => setRejectItem(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
              <button type="button" onClick={handleReject} disabled={!!actingId} className="px-4 py-2 text-sm font-semibold text-white bg-rose-600 rounded-lg hover:bg-rose-700 disabled:opacity-50">Confirm reject</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
