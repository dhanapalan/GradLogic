/**
 * Phase 2 Module 09 — Faculty Proctoring Dashboard for Assessment Campaigns.
 */
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Eye, Shield } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import campusCampaignIntegrityService, {
  type IntegrityTimeline,
} from "../../services/campusCampaignIntegrityService";
import { useAuthStore } from "../../stores/authStore";

const BASE = "/app/college-portal";

function canWrite(role: string) {
  return ["college_admin", "college", "college_staff", "instructor", "super_admin", "hr"].includes(
    role.toLowerCase()
  );
}

function statusBadge(status: string) {
  if (status === "critical") {
    return <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100">Critical</Badge>;
  }
  if (status === "flagged") {
    return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Flagged</Badge>;
  }
  return <Badge variant="secondary">Clear</Badge>;
}

export default function AssessmentIntegrityPage() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const qc = useQueryClient();
  const role = useAuthStore((s) => s.user?.role ?? "");
  const write = canWrite(role);
  const [timeline, setTimeline] = useState<IntegrityTimeline | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["campus-campaign-integrity", campaignId],
    queryFn: () => campusCampaignIntegrityService.getDashboard(campaignId!),
    enabled: !!campaignId,
    refetchInterval: 15_000,
  });

  const reviewMutation = useMutation({
    mutationFn: (payload: {
      incidentId: string;
      status: "reviewed" | "dismissed";
      notes?: string;
    }) =>
      campusCampaignIntegrityService.reviewIncident(campaignId!, payload.incidentId, {
        status: payload.status,
        notes: payload.notes,
      }),
    onSuccess: () => {
      toast.success("Incident updated");
      void qc.invalidateQueries({ queryKey: ["campus-campaign-integrity", campaignId] });
      setTimeline(null);
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      toast.error(err?.response?.data?.error || "Review failed");
    },
  });

  const openTimeline = async (attemptId: string) => {
    try {
      const t = await campusCampaignIntegrityService.getTimeline(campaignId!, attemptId);
      setTimeline(t);
    } catch {
      toast.error("Could not load incident timeline");
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate-500">
        Loading integrity dashboard…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-slate-600">Could not load proctoring dashboard.</p>
        <Link
          to={`${BASE}/campaigns`}
          className="mt-4 inline-flex items-center justify-center rounded-lg border px-4 py-2 text-sm font-medium"
        >
          Back to Campaigns
        </Link>
      </div>
    );
  }

  const { campaign, summary, settings, event_breakdown, attempts } = data;

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            to={`${BASE}/campaigns`}
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
          >
            <ArrowLeft className="h-4 w-4" /> Campaigns
          </Link>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight text-gray-900">
            <Shield className="h-6 w-6 text-slate-700" />
            Proctoring Report
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {campaign.name} · {campaign.campaign_code}
            {!campaign.proctoring_enabled && (
              <span className="ml-2 text-amber-700">(proctoring disabled on this campaign)</span>
            )}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Faculty review of integrity score, violations, and incident timeline for this assessment
            campaign.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to={`${BASE}/campaigns/${campaignId}/results`}
            className="inline-flex h-9 items-center justify-center rounded-md border border-gray-200 bg-white px-3 text-sm font-medium hover:bg-gray-50"
          >
            Evaluation & Results
          </Link>
          <Link
            to={`${BASE}/campaigns/${campaignId}/analytics`}
            className="inline-flex h-9 items-center justify-center rounded-md border border-gray-200 bg-white px-3 text-sm font-medium hover:bg-gray-50"
          >
            Analytics
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {(
          [
            ["In progress", summary.in_progress],
            ["Flagged", summary.flagged],
            ["Critical", summary.critical],
            ["Open incidents", summary.open_incidents],
            ["Total events", summary.total_events],
            ["Avg score", summary.avg_integrity_score],
          ] as const
        ).map(([label, value]) => (
          <Card key={label}>
            <CardContent className="px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
              <div className="mt-1 text-xl font-semibold text-gray-900">{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Active monitors</CardTitle>
            <CardDescription>Configured detection for this campaign</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-gray-700">
            {(
              [
                ["Proctoring", settings.proctoring_enabled],
                ["Tab switch", settings.detect_tab_switch],
                ["Window blur", settings.detect_window_blur],
                ["Fullscreen", settings.require_fullscreen],
                ["Copy / paste", settings.detect_copy_paste],
                ["Multi-monitor", settings.detect_multi_monitor],
                ["Camera", settings.require_camera],
                ["Microphone", settings.require_microphone],
              ] as const
            ).map(([label, on]) => (
              <div key={label} className="flex items-center justify-between border-b border-gray-50 py-1.5">
                <span>{label}</span>
                <Badge variant={on ? "default" : "secondary"}>{on ? "On" : "Off"}</Badge>
              </div>
            ))}
            <p className="pt-2 text-xs text-gray-500">
              Tab switch limit: {settings.tab_switch_limit} · Auto-flag:{" "}
              {settings.integrity_auto_flag ? "yes" : "no"}
            </p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Event breakdown</CardTitle>
            <CardDescription>Incident logging by signal type</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead className="text-right">Count</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {event_breakdown.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={2} className="py-8 text-center text-sm text-gray-500">
                      No integrity events yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  event_breakdown.map((e) => (
                    <TableRow key={e.event_type}>
                      <TableCell className="font-mono text-xs">{e.event_type}</TableCell>
                      <TableCell className="text-right">{e.count}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Student integrity</CardTitle>
          <CardDescription>
            Live and submitted attempts — scores are independent of assessment marks
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Attempt</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Score</TableHead>
                <TableHead className="text-right">Events</TableHead>
                <TableHead>Integrity</TableHead>
                <TableHead>Incident</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {attempts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-sm text-gray-500">
                    No attempts with integrity data yet.
                  </TableCell>
                </TableRow>
              ) : (
                attempts.map((a) => (
                  <TableRow key={a.attempt_id}>
                    <TableCell>
                      <div className="font-medium">{a.student_name}</div>
                      <div className="text-xs text-gray-500">{a.student_email}</div>
                    </TableCell>
                    <TableCell>#{a.attempt_number}</TableCell>
                    <TableCell className="capitalize">
                      {a.attempt_status.replace(/_/g, " ")}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{a.integrity_score}</TableCell>
                    <TableCell className="text-right">{a.integrity_violations}</TableCell>
                    <TableCell>{statusBadge(a.integrity_status)}</TableCell>
                    <TableCell className="capitalize text-sm text-gray-600">
                      {a.risk_level || "—"}
                      {a.incident_status ? ` · ${a.incident_status}` : ""}
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void openTimeline(a.attempt_id)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Timeline
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {timeline && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <Card className="max-h-[85vh] w-full max-w-2xl overflow-hidden">
            <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
              <div>
                <CardTitle className="text-base">Violation Timeline</CardTitle>
                <CardDescription>
                  {timeline.attempt.student_name} · Attempt #{timeline.attempt.attempt_number} ·
                  Score {timeline.attempt.integrity_score} · {timeline.attempt.integrity_violations}{" "}
                  events · {timeline.attempt.integrity_status}
                </CardDescription>
              </div>
              <Button type="button" size="sm" variant="ghost" onClick={() => setTimeline(null)}>
                Close
              </Button>
            </CardHeader>
            <CardContent className="max-h-[50vh] space-y-3 overflow-y-auto">
              {timeline.events.length === 0 ? (
                <p className="text-sm text-gray-500">No events logged.</p>
              ) : (
                timeline.events.map((e) => (
                  <div
                    key={e.id}
                    className="rounded-md border border-gray-100 px-3 py-2 text-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold">{e.event_type}</span>
                      <span className="text-xs text-gray-500">
                        −{e.risk_delta} · {new Date(e.created_at).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
            {write && timeline.incident && timeline.incident.status === "open" && (
              <div className="flex flex-wrap gap-2 border-t px-6 py-4">
                <Button
                  type="button"
                  size="sm"
                  disabled={reviewMutation.isPending}
                  onClick={() =>
                    reviewMutation.mutate({
                      incidentId: timeline.incident!.id,
                      status: "reviewed",
                      notes: "Reviewed by faculty",
                    })
                  }
                >
                  Mark reviewed
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={reviewMutation.isPending}
                  onClick={() =>
                    reviewMutation.mutate({
                      incidentId: timeline.incident!.id,
                      status: "dismissed",
                      notes: "Dismissed — false positive",
                    })
                  }
                >
                  Dismiss
                </Button>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
