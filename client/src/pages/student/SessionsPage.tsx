/**
 * Module 01 — Active session management for Student Portal.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, MonitorSmartphone, Shield, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import studentAuthService, { parseApiError } from "../../services/studentAuthService";
import { useNavigate } from "react-router-dom";

function formatUa(ua: string | null) {
  if (!ua) return "Unknown device";
  if (/Mobile|Android|iPhone/i.test(ua)) return "Mobile browser";
  if (/Edg\//.test(ua)) return "Microsoft Edge";
  if (/Chrome\//.test(ua)) return "Chrome";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Safari\//.test(ua)) return "Safari";
  return ua.slice(0, 64);
}

export default function SessionsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();

  const sessionsQ = useQuery({
    queryKey: ["student-sessions"],
    queryFn: () => studentAuthService.listSessions(),
    retry: 2,
  });

  const revokeOne = useMutation({
    mutationFn: (id: string) => studentAuthService.revokeSession(id),
    onSuccess: (_d, id) => {
      toast.success("Session revoked");
      const current = sessionsQ.data?.find((s) => s.id === id);
      if (current?.is_current) {
        void studentAuthService.logout().then(() => navigate("/auth/login"));
        return;
      }
      void qc.invalidateQueries({ queryKey: ["student-sessions"] });
    },
    onError: (err) => toast.error(parseApiError(err).message),
  });

  const revokeAll = useMutation({
    mutationFn: () => studentAuthService.revokeAllSessions(),
    onSuccess: async () => {
      toast.success("Signed out of all devices");
      await studentAuthService.logout();
      navigate("/auth/login");
    },
    onError: (err) => toast.error(parseApiError(err).message),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Active sessions</h1>
        <p className="mt-1 text-sm text-slate-500">
          Review devices signed into your account. Revoke any session you do not recognize.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4 text-indigo-600" />
            Device sessions
          </CardTitle>
          <CardDescription>Powered by secure refresh-token rotation</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {sessionsQ.isLoading && (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading sessions…
            </div>
          )}
          {sessionsQ.isError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              Could not load sessions.{" "}
              <button
                type="button"
                className="font-semibold underline"
                onClick={() => void sessionsQ.refetch()}
              >
                Retry
              </button>
            </div>
          )}
          {!sessionsQ.isLoading && !sessionsQ.data?.length && (
            <p className="py-8 text-center text-sm text-slate-500">No active sessions found.</p>
          )}
          {sessionsQ.data?.map((s) => (
            <div
              key={s.id}
              className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-50 text-slate-600">
                  <MonitorSmartphone className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {formatUa(s.user_agent)}
                    {s.is_current && (
                      <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                        This device
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-slate-500">
                    {s.ip_address || "IP unknown"} · Started{" "}
                    {new Date(s.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={revokeOne.isPending}
                onClick={() => {
                  if (s.is_current && !confirm("Revoke this device and sign out?")) return;
                  revokeOne.mutate(s.id);
                }}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Revoke
              </Button>
            </div>
          ))}

          <div className="pt-2">
            <Button
              type="button"
              variant="outline"
              className="border-rose-200 text-rose-700 hover:bg-rose-50"
              disabled={revokeAll.isPending || !sessionsQ.data?.length}
              onClick={() => {
                if (!confirm("Sign out of all devices? You will need to log in again.")) return;
                revokeAll.mutate();
              }}
            >
              {revokeAll.isPending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-1.5 h-4 w-4" />
              )}
              Log out all devices
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
