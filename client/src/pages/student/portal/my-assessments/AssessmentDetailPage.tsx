import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { ArrowLeft, Play, RotateCcw } from "lucide-react";
import studentAssessmentsHubService from "../../../../services/studentAssessmentsHubService";
import {
  BASE,
  Countdown,
  EmptyBlock,
  ErrorBlock,
  LoadingBlock,
  StatusBadge,
  formatWhen,
} from "./components";

export default function AssessmentDetailPage() {
  const { campaignId = "" } = useParams();
  const navigate = useNavigate();

  const detailQ = useQuery({
    queryKey: ["assessments-hub-detail", campaignId],
    queryFn: () => studentAssessmentsHubService.getAssessment(campaignId),
    enabled: !!campaignId,
  });
  const attemptsQ = useQuery({
    queryKey: ["assessments-hub-attempts", campaignId],
    queryFn: () => studentAssessmentsHubService.getAttempts(campaignId),
    enabled: !!campaignId,
  });

  const launchMut = useMutation({
    mutationFn: () =>
      detailQ.data?.can_resume
        ? studentAssessmentsHubService.resume(campaignId)
        : studentAssessmentsHubService.launch(campaignId),
    onSuccess: (data) => {
      toast.success(data.message || "Opening workspace…");
      navigate(data.workspace_href);
    },
    onError: (err: unknown) => {
      toast.error(
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
          "Launch blocked"
      );
    },
  });

  if (detailQ.isLoading) return <LoadingBlock label="Loading assessment" />;
  if (detailQ.isError || !detailQ.data) {
    return (
      <ErrorBlock message="Assessment not available or not assigned to you." onRetry={() => detailQ.refetch()} />
    );
  }

  const a = detailQ.data as {
    assessment_name: string;
    campaign_name: string;
    assessment_type: string;
    description?: string;
    instructions?: string;
    duration_minutes?: number;
    total_questions?: number;
    total_marks?: number;
    passing_marks?: number;
    max_attempts?: number;
    attempts_used?: number;
    available_from?: string;
    available_until?: string;
    can_start?: boolean;
    can_resume?: boolean;
    status?: string;
    display_status?: string;
    eligibility?: { message?: string | null };
    rules?: {
      negative_marking?: boolean;
      allow_resume?: boolean;
      shuffle_questions?: boolean;
    };
    campaign_id: string;
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5 animate-in fade-in duration-500">
      <Link to={BASE} className="inline-flex items-center gap-1 text-xs font-bold text-slate-500">
        <ArrowLeft className="h-3.5 w-3.5" /> My Assessments
      </Link>

      <header className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <StatusBadge status={a.display_status || a.status || ""} />
            <h1 className="mt-2 text-2xl font-black text-slate-900">{a.assessment_name}</h1>
            <p className="text-sm text-slate-500">{a.campaign_name}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {a.can_resume && (
              <button
                type="button"
                disabled={launchMut.isPending}
                onClick={() => launchMut.mutate()}
                className="inline-flex items-center gap-1 rounded-xl bg-amber-600 px-4 py-2.5 text-xs font-bold text-white"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Resume Assessment
              </button>
            )}
            {a.can_start && !a.can_resume && (
              <>
                <Link
                  to={`${BASE}/${campaignId}/instructions`}
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold"
                >
                  View Instructions
                </Link>
                <button
                  type="button"
                  disabled={launchMut.isPending}
                  onClick={() => navigate(`${BASE}/${campaignId}/instructions`)}
                  className="inline-flex items-center gap-1 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white"
                >
                  <Play className="h-3.5 w-3.5" /> Start Assessment
                </button>
              </>
            )}
            {(a.status === "submitted" || a.display_status === "completed") && (
              <Link
                to={`${BASE}/${campaignId}/result`}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold"
              >
                View Result
              </Link>
            )}
          </div>
        </div>
        {a.eligibility?.message && (
          <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">{a.eligibility.message}</p>
        )}
        <div className="mt-3">
          <Countdown until={a.available_until} />
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:grid-cols-4">
        <Meta label="Type" value={a.assessment_type?.replace(/_/g, " ")} />
        <Meta label="Duration" value={a.duration_minutes != null ? `${a.duration_minutes} min` : "—"} />
        <Meta label="Questions" value={a.total_questions ?? "—"} />
        <Meta label="Passing" value={a.passing_marks ?? "—"} />
        <Meta label="Attempts" value={`${a.attempts_used ?? 0} / ${a.max_attempts ?? "—"}`} />
        <Meta label="Start" value={formatWhen(a.available_from)} />
        <Meta label="End" value={formatWhen(a.available_until)} />
        <Meta label="Negative marking" value={a.rules?.negative_marking ? "Yes" : "No"} />
      </section>

      <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-black text-slate-900">Instructions</h2>
        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
          {a.description || a.instructions || "No instructions provided."}
        </p>
        <h3 className="mt-4 text-xs font-bold uppercase tracking-wider text-slate-400">Rules</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
          <li>Resume allowed: {a.rules?.allow_resume === false ? "No" : "Yes"}</li>
          <li>Shuffle questions: {a.rules?.shuffle_questions ? "Yes" : "No"}</li>
          <li>Negative marking: {a.rules?.negative_marking ? "Yes" : "No"}</li>
        </ul>
      </section>

      <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-black text-slate-900">Attempt history</h2>
        {attemptsQ.isLoading ? (
          <LoadingBlock />
        ) : !attemptsQ.data?.length ? (
          <EmptyBlock title="No attempts yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-[10px] font-bold uppercase text-slate-400">
                <tr>
                  <th className="py-2 pr-3">#</th>
                  <th className="py-2 pr-3">Started</th>
                  <th className="py-2 pr-3">Ended</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Score</th>
                </tr>
              </thead>
              <tbody>
                {attemptsQ.data.map((at) => (
                  <tr key={at.attempt_id} className="border-t border-slate-50">
                    <td className="py-2 pr-3 font-bold">{at.attempt_number}</td>
                    <td className="py-2 pr-3 text-xs">{formatWhen(at.start_time)}</td>
                    <td className="py-2 pr-3 text-xs">{formatWhen(at.end_time)}</td>
                    <td className="py-2 pr-3 capitalize">{at.status.replace(/_/g, " ")}</td>
                    <td className="py-2 pr-3">
                      {at.percentage != null ? `${at.percentage}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="text-sm font-bold capitalize text-slate-800">{value}</p>
    </div>
  );
}
