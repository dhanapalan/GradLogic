/**
 * Phase 2 Module 07 — Student result view (published only).
 */
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, XCircle, ArrowLeft } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import studentAssessmentsService from "../../../services/studentAssessmentsService";

const BASE = "/app/student-portal";

function formatDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function AssessmentResultPage() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ["student-assessment-result", campaignId],
    queryFn: () => studentAssessmentsService.getResult(campaignId!),
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
    const msg =
      (error as any)?.response?.data?.error ||
      "Results are not available yet. Your college may still be evaluating or publishing.";
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <AlertTriangle className="mx-auto mb-3 h-12 w-12 text-amber-500" />
        <h2 className="text-xl font-semibold text-slate-900">Result not available</h2>
        <p className="mt-2 text-sm text-slate-500">{msg}</p>
        <div className="mt-6 flex justify-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(`${BASE}/my-assessments/${campaignId}/complete`)}
          >
            Completion page
          </Button>
          <Button type="button" onClick={() => navigate(`${BASE}/my-assessments`)}>
            My Assessments
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 animate-in fade-in duration-500">
      <Link
        to={`${BASE}/my-assessments`}
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        My Assessments
      </Link>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-6 sm:px-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Assessment result
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">{data.assessment_name}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {data.campaign_name} · Attempt {data.attempt_number}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {data.passed == null ? null : data.passed ? (
              <Badge variant="success">Pass</Badge>
            ) : (
              <Badge variant="danger">Fail</Badge>
            )}
            <span className="text-sm text-slate-600">
              {data.obtained_marks} / {data.total_marks} ({data.percentage}%)
            </span>
            <span className="text-xs text-slate-400">
              Passing marks: {data.passing_marks}
              {data.negative_marks > 0 ? ` · Negative applied: −${data.negative_marks}` : ""}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Submitted {formatDate(data.submitted_at)} · Published {formatDate(data.published_at)}
          </p>
        </div>

        <div className="space-y-3 px-6 py-6 sm:px-8">
          <h2 className="text-sm font-semibold text-slate-900">Question breakdown</h2>
          {data.questions.map((q, i) => (
            <div key={q.question_id} className="rounded-xl border border-slate-100 px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-slate-900">
                  Q{i + 1}. {q.title}
                </p>
                <span className="shrink-0 text-xs font-semibold text-slate-600">
                  {q.marks_awarded}/{q.marks_possible}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span>{q.question_type.replace(/_/g, " ")}</span>
                {q.is_correct === true && (
                  <span className="inline-flex items-center gap-1 text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Correct
                  </span>
                )}
                {q.is_correct === false && (
                  <span className="inline-flex items-center gap-1 text-rose-700">
                    <XCircle className="h-3.5 w-3.5" /> Incorrect
                  </span>
                )}
                {q.evaluation_status === "pending_manual" && (
                  <span className="text-amber-700">Awaiting review</span>
                )}
              </div>
              <p className="mt-1 text-xs text-slate-600">
                Your answer: {q.selected.length ? q.selected.join(", ") : "—"}
              </p>
              {q.manual_feedback && (
                <p className="mt-1 text-xs text-slate-500">Feedback: {q.manual_feedback}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
