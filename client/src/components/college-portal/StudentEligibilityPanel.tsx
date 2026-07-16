/**
 * Sprint 2.5 — Placement Eligibility panel (mark / history / rules).
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  XCircle,
  History,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import campusStudentsService from "../../services/campusStudentsService";

interface Props {
  studentId: string;
  canWrite: boolean;
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function StudentEligibilityPanel({ studentId, canWrite }: Props) {
  const qc = useQueryClient();
  const [reason, setReason] = useState("");
  const [backlogs, setBacklogs] = useState<string>("");
  const [eligibilityDate, setEligibilityDate] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const [showHistory, setShowHistory] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["college-student-eligibility", studentId],
    queryFn: () => campusStudentsService.getEligibility(studentId),
  });

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ["college-student-eligibility-history", studentId],
    queryFn: () => campusStudentsService.getEligibilityHistory(studentId),
    enabled: showHistory,
  });

  const mutation = useMutation({
    mutationFn: (eligible: boolean) =>
      campusStudentsService.setEligibility(studentId, {
        eligible,
        reason: reason.trim(),
        active_backlogs:
          backlogs === ""
            ? data?.active_backlogs
            : Math.max(0, parseInt(backlogs, 10) || 0),
        eligibility_date: eligibilityDate || undefined,
      }),
    onSuccess: (state) => {
      toast.success(
        state.placement_eligible ? "Marked placement eligible" : "Marked not eligible"
      );
      setReason("");
      qc.invalidateQueries({ queryKey: ["college-student-eligibility", studentId] });
      qc.invalidateQueries({ queryKey: ["college-student-eligibility-history", studentId] });
      qc.invalidateQueries({ queryKey: ["college-portal-student", studentId] });
      qc.invalidateQueries({ queryKey: ["college-portal-students"] });
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      toast.error(err?.response?.data?.error ?? "Eligibility update failed");
    },
  });

  if (isLoading) {
    return <div className="h-40 animate-pulse rounded-xl bg-gray-100" />;
  }

  if (isError || !data) {
    return (
      <p className="rounded-lg border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
        Could not load eligibility.
      </p>
    );
  }

  const rule = data.rule_check;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="text-base">Placement Eligibility</CardTitle>
            <p className="mt-1 text-xs text-gray-500">
              Rules: CGPA ≥ {data.rules.min_cgpa} · Backlogs ≤ {data.rules.max_active_backlogs}
            </p>
          </div>
          <Badge variant={data.placement_eligible ? "success" : "danger"}>
            {data.placement_eligible ? "Eligible" : "Not Eligible"}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Meta label="Placement Eligible" value={data.placement_eligible ? "Yes" : "No"} />
            <Meta label="Reason" value={data.reason || "—"} />
            <Meta label="Eligibility Date" value={data.eligibility_date || "—"} />
            <Meta label="Verified By" value={data.verified_by_name || "—"} />
            <Meta label="Verification Date" value={formatDate(data.verification_date)} />
            <Meta label="Active Backlogs" value={String(data.active_backlogs)} />
          </div>

          {data.manual_override && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Manual override — decision differs from automatic CGPA / backlog rules.
            </div>
          )}

          <div className="rounded-lg border border-gray-100 bg-slate-50 px-3 py-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-gray-500">
              <ShieldCheck className="h-3.5 w-3.5" />
              Rule check
              <Badge variant={rule.rule_eligible ? "success" : "warning"} className="ml-1 normal-case">
                {rule.rule_eligible ? "Would pass" : "Would fail"}
              </Badge>
            </p>
            <ul className="space-y-1 text-sm text-gray-700">
              {rule.messages.map((m) => (
                <li key={m} className="flex items-start gap-2">
                  {m.includes("below") || m.includes("exceed") || m.includes("missing") ? (
                    <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-500" />
                  ) : (
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                  )}
                  {m}
                </li>
              ))}
            </ul>
          </div>

          {canWrite && (
            <div className="space-y-3 rounded-lg border border-gray-200 p-3">
              <p className="text-sm font-medium text-gray-800">Update eligibility</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span className="text-gray-600">Reason *</span>
                  <Input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g. Meets CGPA & no backlogs"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-gray-600">Eligibility Date</span>
                  <Input
                    type="date"
                    value={eligibilityDate}
                    onChange={(e) => setEligibilityDate(e.target.value)}
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-gray-600">Active Backlogs</span>
                  <Input
                    type="number"
                    min={0}
                    value={backlogs === "" ? String(data.active_backlogs) : backlogs}
                    onChange={(e) => setBacklogs(e.target.value)}
                  />
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={mutation.isPending || !reason.trim()}
                  onClick={() => mutation.mutate(true)}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Mark Eligible
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="text-rose-700"
                  disabled={mutation.isPending || !reason.trim()}
                  onClick={() => mutation.mutate(false)}
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Mark Not Eligible
                </Button>
              </div>
            </div>
          )}

          <div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setShowHistory((v) => !v)}
            >
              <History className="h-3.5 w-3.5" />
              {showHistory ? "Hide History" : "View History"}
            </Button>
          </div>

          {showHistory && (
            <div className="rounded-lg border border-gray-200">
              {historyLoading ? (
                <p className="p-3 text-sm text-gray-500">Loading history…</p>
              ) : !historyData?.history.length ? (
                <p className="p-3 text-sm text-gray-500">No eligibility changes yet.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {historyData.history.map((h) => (
                    <li key={h.id} className="px-3 py-2.5 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={h.new_eligible ? "success" : "danger"}>
                          {h.new_eligible ? "Eligible" : "Not Eligible"}
                        </Badge>
                        {h.manual_override && <Badge variant="warning">Override</Badge>}
                        <span className="text-xs text-gray-400">{formatDate(h.created_at)}</span>
                      </div>
                      <p className="mt-1 text-gray-700">{h.reason || "—"}</p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        By {h.verified_by_name || "—"}
                        {h.previous_eligible != null
                          ? ` · was ${h.previous_eligible ? "eligible" : "not eligible"}`
                          : ""}
                        {h.new_active_backlogs != null
                          ? ` · backlogs ${h.new_active_backlogs}`
                          : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-100 p-3">
      <div className="text-[11px] uppercase tracking-wide text-gray-400">{label}</div>
      <div className="mt-0.5 text-sm font-medium text-gray-900">{value}</div>
    </div>
  );
}
