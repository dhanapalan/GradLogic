/**
 * Phase 2 Module 06.5 — Submission summary + confirmation.
 */
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  CircleHelp,
  Flag,
  ListChecks,
  Send,
} from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "../../../components/ui/button";
import studentAssessmentsService from "../../../services/studentAssessmentsService";

const BASE = "/app/student-portal";

export default function AssessmentSubmissionPage() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [declarationAccepted, setDeclarationAccepted] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["student-assessment-summary", campaignId],
    queryFn: () => studentAssessmentsService.getSubmissionSummary(campaignId!),
    enabled: !!campaignId,
    retry: false,
  });

  const submitMutation = useMutation({
    mutationFn: () => studentAssessmentsService.submitAttempt(campaignId!),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["student-my-assessments"] });
      void qc.removeQueries({ queryKey: ["student-assessment-attempt", campaignId] });
      toast.success("Assessment submitted");
      navigate(`${BASE}/my-assessments/${campaignId}/complete`, { replace: true });
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      toast.error(err?.response?.data?.error || "Submission failed");
      setConfirmOpen(false);
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
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <AlertTriangle className="mx-auto mb-3 h-12 w-12 text-amber-500" />
        <h2 className="text-xl font-semibold text-slate-900">Cannot open submission</h2>
        <p className="mt-2 text-sm text-slate-500">
          {(error as any)?.response?.data?.error ||
            "There is no active attempt ready to submit."}
        </p>
        <Button
          type="button"
          className="mt-6"
          variant="outline"
          onClick={() => navigate(`${BASE}/my-assessments/${campaignId}/attempt`)}
        >
          Return to Assessment
        </Button>
      </div>
    );
  }

  const tiles = [
    {
      label: "Answered",
      value: data.answered_questions,
      icon: CheckCircle2,
      tone: "text-emerald-700 bg-emerald-50 border-emerald-100",
    },
    {
      label: "Unanswered",
      value: data.unanswered_questions,
      icon: CircleHelp,
      tone: "text-amber-800 bg-amber-50 border-amber-100",
    },
    {
      label: "Marked for review",
      value: data.marked_for_review,
      icon: Flag,
      tone: "text-violet-800 bg-violet-50 border-violet-100",
    },
    {
      label: "Total questions",
      value: data.total_questions,
      icon: ListChecks,
      tone: "text-slate-800 bg-slate-50 border-slate-200",
    },
  ] as const;

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 animate-in fade-in duration-500">
      <Link
        to={`${BASE}/my-assessments/${campaignId}/attempt`}
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Return to Assessment
      </Link>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-6 sm:px-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Submission summary
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
            {data.assessment_name}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {data.campaign_name} · Attempt {data.attempt_number}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 px-6 py-6 sm:grid-cols-4 sm:px-8">
          {tiles.map((t) => {
            const Icon = t.icon;
            return (
              <div
                key={t.label}
                className={`rounded-xl border px-3 py-3 ${t.tone}`}
              >
                <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide opacity-80">
                  <Icon className="h-3.5 w-3.5" />
                  {t.label}
                </div>
                <p className="mt-1 text-2xl font-semibold">{t.value}</p>
              </div>
            );
          })}
        </div>

        <div className="space-y-4 px-6 pb-6 sm:px-8">
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            <p className="text-sm font-medium text-amber-900">{data.warning}</p>
          </div>

          <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <input
              type="checkbox"
              className="mt-1"
              checked={declarationAccepted}
              onChange={(e) => setDeclarationAccepted(e.target.checked)}
            />
            <span>
              Candidate declaration: I confirm this attempt was completed by me without unauthorized
              assistance, and I understand submission is final.
            </span>
          </label>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(`${BASE}/my-assessments/${campaignId}/attempt`)}
            >
              <ArrowLeft className="h-4 w-4" />
              Return to Assessment
            </Button>
            <Button
              type="button"
              disabled={!declarationAccepted}
              onClick={() => setConfirmOpen(true)}
            >
              <Send className="h-4 w-4" />
              Submit Assessment
            </Button>
          </div>
        </div>
      </div>

      {confirmOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
          role="presentation"
          onClick={() => !submitMutation.isPending && setConfirmOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="submit-confirm-title"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="submit-confirm-title" className="text-lg font-semibold text-slate-900">
              Confirm final submission?
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              You have answered {data.answered_questions} of {data.total_questions} questions
              {data.unanswered_questions > 0
                ? ` (${data.unanswered_questions} unanswered)`
                : ""}
              {data.marked_for_review > 0
                ? ` and marked ${data.marked_for_review} for review`
                : ""}
              . Submission is final — you cannot edit answers afterward.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={submitMutation.isPending}
                onClick={() => setConfirmOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={submitMutation.isPending}
                onClick={() => submitMutation.mutate()}
              >
                {submitMutation.isPending ? "Submitting…" : "Confirm submit"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
