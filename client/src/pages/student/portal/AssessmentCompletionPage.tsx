/**
 * Phase 2 Module 06.5 — Completion screen (no scores).
 */
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { Button } from "../../../components/ui/button";
import studentAssessmentsService from "../../../services/studentAssessmentsService";

const BASE = "/app/student-portal";

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function AssessmentCompletionPage() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ["student-assessment-completion", campaignId],
    queryFn: () => studentAssessmentsService.getSubmissionCompletion(campaignId!),
    enabled: !!campaignId,
    retry: false,
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
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <AlertTriangle className="mx-auto mb-3 h-12 w-12 text-amber-500" />
        <h2 className="text-xl font-semibold text-slate-900">Submission not found</h2>
        <p className="mt-2 text-sm text-slate-500">
          {(error as any)?.response?.data?.error ||
            "We could not find a completed submission for this assessment."}
        </p>
        <Button
          type="button"
          className="mt-6"
          variant="outline"
          onClick={() => navigate(`${BASE}/my-assessments`)}
        >
          Back to My Assessments
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-12 animate-in fade-in duration-500">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
          <CheckCircle2 className="h-8 w-8 text-emerald-600" />
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">
          Assessment Submitted
        </h1>
        <p className="mt-2 text-sm text-slate-500">{data.message}</p>

        <div className="mt-6 space-y-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-4 text-left text-sm">
          <div>
            <dt className="text-xs text-slate-500">Assessment</dt>
            <dd className="font-medium text-slate-900">{data.assessment_name}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Campaign</dt>
            <dd className="font-medium text-slate-900">{data.campaign_name}</dd>
          </div>
          <div className="flex items-start gap-2">
            <Clock className="mt-0.5 h-4 w-4 text-slate-400" />
            <div>
              <dt className="text-xs text-slate-500">Submission time</dt>
              <dd className="font-medium text-slate-900">{formatDate(data.submitted_at)}</dd>
            </div>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Attempt number</dt>
            <dd className="font-medium text-slate-900">{data.attempt_number}</dd>
          </div>
        </div>

        <div className="mt-4 space-y-1 text-xs text-slate-500">
          <p className="font-semibold text-emerald-700">Submission successful</p>
          <p>Awaiting evaluation. Result availability depends on your college’s release settings.</p>
          <p className="text-slate-400">
            Scores are not shown on this screen. Open My Assessments → View Result when published.
          </p>
        </div>

        <div className="mt-6 flex flex-col items-center gap-2">
          <Button type="button" onClick={() => navigate(`${BASE}/my-assessments`)}>
            Back to My Assessments
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(`${BASE}/my-assessments/${campaignId}/result`)}
          >
            View published result
          </Button>
          <p className="text-xs text-slate-400">
            Results appear only after your college publishes them.
          </p>
        </div>
      </div>
    </div>
  );
}
