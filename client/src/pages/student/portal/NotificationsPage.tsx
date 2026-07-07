import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  CheckCheck,
  Info,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import api from "../../../lib/api";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  is_read: boolean;
  created_at: string;
}

const TYPE_STYLES = {
  info: { icon: Info, cls: "bg-indigo-50 text-indigo-500 border-indigo-100" },
  success: { icon: CheckCircle2, cls: "bg-emerald-50 text-emerald-500 border-emerald-100" },
  warning: { icon: AlertTriangle, cls: "bg-amber-50 text-amber-500 border-amber-100" },
  error: { icon: XCircle, cls: "bg-rose-50 text-rose-500 border-rose-100" },
} as const;

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function NotificationsPage() {
  const qc = useQueryClient();

  const { data: items = [], isLoading, isError } = useQuery({
    queryKey: ["student-notifications"],
    queryFn: async () => (await api.get("/notifications?limit=50")).data.data as Notification[],
    staleTime: 20_000,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => api.put(`/notifications/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["student-notifications"] }),
  });
  const markAll = useMutation({
    mutationFn: () => api.put("/notifications/read-all"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["student-notifications"] }),
  });

  const unread = items.filter((n) => !n.is_read).length;

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Bell className="h-4 w-4" /> Notifications
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">Notifications</h1>
          <p className="text-sm text-slate-500 mt-1">
            {unread > 0 ? `${unread} unread` : "You're all caught up"}
          </p>
        </div>
        {unread > 0 && (
          <button
            onClick={() => markAll.mutate()}
            disabled={markAll.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            <CheckCheck className="h-4 w-4" /> Mark all read
          </button>
        )}
      </div>

      {isError && (
        <div className="rounded-2xl border border-rose-100 bg-rose-50 px-5 py-4 text-sm font-bold text-rose-600">
          Could not load notifications. Please refresh or try again later.
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-50 border border-slate-100" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-dashed border-slate-200">
          <Bell className="h-10 w-10 text-slate-200 mb-3" />
          <p className="text-base font-bold text-slate-400">No notifications</p>
          <p className="text-xs text-slate-300 mt-1">We'll let you know when something happens.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((n) => {
            const s = TYPE_STYLES[n.type] ?? TYPE_STYLES.info;
            const Icon = s.icon;
            return (
              <button
                key={n.id}
                onClick={() => !n.is_read && markRead.mutate(n.id)}
                className={`w-full text-left flex items-start gap-3 rounded-2xl border p-4 transition-all ${
                  n.is_read
                    ? "bg-white border-slate-100"
                    : "bg-indigo-50/40 border-indigo-100 hover:bg-indigo-50"
                }`}
              >
                <div className={`h-9 w-9 shrink-0 rounded-xl border flex items-center justify-center ${s.cls}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-slate-900 truncate">{n.title}</p>
                    {!n.is_read && <span className="h-2 w-2 shrink-0 rounded-full bg-indigo-500" />}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{n.message}</p>
                  <p className="text-[11px] text-slate-400 mt-1">{timeAgo(n.created_at)}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
