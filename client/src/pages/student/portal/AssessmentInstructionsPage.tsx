/**
 * Phase 2 Module 06.2 — Assessment Instructions (pre-start).
 */
import type { ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Play,
  RotateCcw,
  Clock,
  FileText,
  Target,
  Repeat,
  AlertTriangle,
  ClipboardList,
} from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import studentAssessmentsService, {
  type AssessmentInstructions,
  type MyAssessmentStatus,
} from "../../../services/studentAssessmentsService";
import assessmentWorkspaceService from "../../../services/assessmentWorkspaceService";

const BASE = "/app/student-portal";

const TYPE_LABELS: Record<string, string> = {
  practice_test: "Practice Test",
  mock_test: "Mock Test",
  placement_test: "Placement Test",
};

function statusVariant(
  s: MyAssessmentStatus
): "muted" | "success" | "warning" | "info" | "danger" | "default" {
  if (s === "available") return "success";
  if (s === "upcoming") return "info";
  if (s === "in_progress") return "warning";
  if (s === "submitted") return "default";
  return "danger";
}

function statusLabel(s: MyAssessmentStatus) {
  return s
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function canProceed(info: AssessmentInstructions) {
  return info.can_start || info.can_resume;
}

export default function AssessmentInstructionsPage() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["student-assessment-instructions", campaignId],
    queryFn: () => studentAssessmentsService.instructions(campaignId!),
    enabled: !!campaignId,
  });

  const startMutation = useMutation({
    mutationFn: () => assessmentWorkspaceService.launch(campaignId!),
    onSuccess: (result) => {
      toast.success(result.message || (result.resumed ? "Resumed" : "Assessment started"));
      void qc.invalidateQueries({ queryKey: ["student-my-assessments"] });
      void qc.invalidateQueries({ queryKey: ["assessments-hub"] });
      void qc.invalidateQueries({ queryKey: ["student-assessment-instructions", campaignId] });
      navigate(result.workspace_href || `${BASE}/my-assessments/${campaignId}/attempt`);
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      toast.error(err?.response?.data?.error || "Cannot start this assessment");
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-72 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-300 border-t-slate-800" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <AlertTriangle className="mx-auto mb-3 h-12 w-12 text-amber-500" />
        <h2 className="text-xl font-semibold text-slate-900">Assessment not found</h2>
        <p className="mt-2 text-sm text-slate-500">
          You are not assigned to this campaign, or it is no longer published.
        </p>
        <Button type="button" className="mt-6" variant="outline" onClick={() => navigate(`${BASE}/my-assessments`)}>
          <ArrowLeft className="h-4 w-4" />
          Back to My Assessments
        </Button>
      </div>
    );
  }

  const proceed = canProceed(data);
  const isResume = data.can_resume;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 animate-in fade-in duration-500">
      <Link
        to={`${BASE}/my-assessments`}
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-900 px-6 py-8 text-white sm:px-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-400">
                <ClipboardList className="h-3.5 w-3.5" />
                Assessment instructions
              </div>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                {data.assessment_name}
              </h1>
              <p className="mt-1 text-sm text-slate-300">
                Campaign: {data.campaign_name}
                <span className="text-slate-500"> · {data.campaign_code}</span>
              </p>
            </div>
            <Badge variant={statusVariant(data.status)}>{statusLabel(data.status)}</Badge>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat
              icon={<FileText className="h-4 w-4" />}
              label="Questions"
              value={String(data.total_questions)}
            />
            <Stat
              icon={<Clock className="h-4 w-4" />}
              label="Duration"
              value={data.duration_minutes != null ? `${data.duration_minutes} min` : "—"}
            />
            <Stat
              icon={<Target className="h-4 w-4" />}
              label="Passing marks"
              value={String(data.passing_marks)}
            />
            <Stat
              icon={<Repeat className="h-4 w-4" />}
              label="Max attempts"
              value={`${data.attempts_used} / ${data.max_attempts}`}
            />
          </div>
        </div>

        <div className="space-y-6 px-6 py-6 sm:px-8">
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <InfoRow label="Assessment type" value={TYPE_LABELS[data.assessment_type] || data.assessment_type} />
            <InfoRow label="Total marks" value={String(data.total_marks)} />
            <InfoRow label="Available from" value={formatDate(data.available_from)} />
            <InfoRow label="Available until" value={formatDate(data.available_until)} />
          </div>

          <div>
            <h2 className="text-sm font-semibold text-slate-900">Instructions</h2>
            {data.instructions?.trim() ? (
              <p className="mt-2 whitespace-pre-wrap rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-700">
                {data.instructions}
              </p>
            ) : (
              <p className="mt-2 text-sm text-slate-500">No additional instructions were provided.</p>
            )}
          </div>

          <ul className="space-y-2 text-sm text-slate-600">
            {data.negative_marking && (
              <li className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-amber-900">
                Negative marking is enabled for this campaign.
              </li>
            )}
            {data.shuffle_questions && (
              <li className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                Questions may be shuffled for each attempt.
              </li>
            )}
            {data.allow_resume ? (
              <li className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                You can resume an in-progress attempt within the campaign window.
              </li>
            ) : (
              <li className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                Resume is disabled for this campaign.
              </li>
            )}
          </ul>

          {!proceed && data.start_blocked_reason && (
            <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
              <p className="text-sm font-medium text-rose-800">{data.start_blocked_reason}</p>
            </div>
          )}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(`${BASE}/my-assessments`)}
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <Button
              type="button"
              disabled={!proceed || startMutation.isPending}
              onClick={() => startMutation.mutate()}
            >
              {startMutation.isPending ? (
                "Validating…"
              ) : isResume ? (
                <>
                  <RotateCcw className="h-4 w-4" />
                  Resume Assessment
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Start Assessment
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-100 px-3 py-2">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 font-medium text-slate-900">{value}</dd>
    </div>
  );
}
