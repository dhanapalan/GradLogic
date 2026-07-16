/**
 * Phase 2 Module 07 — Faculty Evaluation & Results dashboard.
 */
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  RefreshCw,
  Upload,
  Eye,
  X,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
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
import campusCampaignResultsService, {
  type FacultyEvaluationDetail,
} from "../../services/campusCampaignResultsService";
import { useAuthStore } from "../../stores/authStore";

const BASE = "/app/college-portal";

function canWrite(role: string) {
  return ["college_admin", "college", "college_staff", "instructor", "super_admin", "hr"].includes(
    role.toLowerCase()
  );
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function AssessmentResultsPage() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const qc = useQueryClient();
  const role = useAuthStore((s) => s.user?.role ?? "");
  const write = canWrite(role);
  const [detail, setDetail] = useState<FacultyEvaluationDetail | null>(null);
  const [manualMarks, setManualMarks] = useState<Record<string, string>>({});

  const { data, isLoading, error } = useQuery({
    queryKey: ["campus-campaign-results", campaignId],
    queryFn: () => campusCampaignResultsService.list(campaignId!),
    enabled: !!campaignId,
  });

  const evaluateMutation = useMutation({
    mutationFn: () => campusCampaignResultsService.evaluate(campaignId!),
    onSuccess: (r) => {
      toast.success(`Evaluated ${r.evaluated} attempt(s)`);
      void qc.invalidateQueries({ queryKey: ["campus-campaign-results", campaignId] });
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      toast.error(err?.response?.data?.error || "Evaluation failed");
    },
  });

  const publishMutation = useMutation({
    mutationFn: () => campusCampaignResultsService.publish(campaignId!),
    onSuccess: (r) => {
      toast.success(`Published ${r.published} result(s)`);
      void qc.invalidateQueries({ queryKey: ["campus-campaign-results", campaignId] });
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      toast.error(err?.response?.data?.error || "Publish failed");
    },
  });

  const openDetail = async (evaluationId: string) => {
    try {
      const d = await campusCampaignResultsService.getEvaluation(campaignId!, evaluationId);
      setDetail(d);
      const marks: Record<string, string> = {};
      for (const q of d.questions) {
        if (q.question_type === "short_answer") {
          marks[q.question_id] = String(q.marks_awarded ?? 0);
        }
      }
      setManualMarks(marks);
    } catch {
      toast.error("Could not load evaluation detail");
    }
  };

  const scoreShort = async (questionId: string, max: number) => {
    if (!detail) return;
    const raw = Number(manualMarks[questionId]);
    if (!Number.isFinite(raw)) {
      toast.error("Enter a valid mark");
      return;
    }
    try {
      const updated = await campusCampaignResultsService.scoreShortAnswer(
        campaignId!,
        detail.id,
        questionId,
        { marks_awarded: Math.max(0, Math.min(max, raw)), feedback: null }
      );
      setDetail(updated);
      toast.success("Short answer scored");
      void qc.invalidateQueries({ queryKey: ["campus-campaign-results", campaignId] });
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Score failed");
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate-500">
        Loading results…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-slate-600">Could not load campaign results.</p>
        <Link
          to={`${BASE}/campaigns`}
          className="mt-4 inline-flex items-center justify-center rounded-lg border px-4 py-2 text-sm font-medium"
        >
          Back to Campaigns
        </Link>
      </div>
    );
  }

  const { campaign, summary, results } = data;

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
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-gray-900">
            Evaluation & Results
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {campaign.name} · {campaign.campaign_code}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to={`${BASE}/campaigns/${campaignId}/analytics`}
            className="inline-flex h-9 items-center justify-center rounded-md border border-gray-200 bg-white px-3 text-sm font-medium hover:bg-gray-50"
          >
            Analytics & Reports
          </Link>
          <Link
            to={`${BASE}/campaigns/${campaignId}/integrity`}
            className="inline-flex h-9 items-center justify-center rounded-md border border-gray-200 bg-white px-3 text-sm font-medium hover:bg-gray-50"
          >
            Proctoring
          </Link>
          {write && (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={evaluateMutation.isPending}
                onClick={() => evaluateMutation.mutate()}
              >
                <RefreshCw className="h-4 w-4" />
                Run evaluation
              </Button>
              <Button
                type="button"
                disabled={publishMutation.isPending}
                onClick={() => {
                  if (confirm("Publish results to students?")) publishMutation.mutate();
                }}
              >
                <Upload className="h-4 w-4" />
                Publish results
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {(
          [
            ["Submitted", summary.submitted],
            ["Evaluated", summary.evaluated],
            ["Published", summary.published],
            ["Manual review", summary.needs_manual_review],
            ["Passed", summary.passed],
            ["Failed", summary.failed],
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

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Student results</CardTitle>
          <CardDescription>
            Auto-scores MCQ / True-False; short answers stay pending until scored. Publish to release
            to students.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Attempt</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Pass</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-gray-500">
                    No evaluations yet. Students must submit, then run evaluation.
                  </TableCell>
                </TableRow>
              )}
              {results.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="font-medium text-gray-900">{r.student_name}</div>
                    <div className="text-xs text-gray-500">{r.student_email}</div>
                  </TableCell>
                  <TableCell>{r.attempt_number}</TableCell>
                  <TableCell>
                    {r.obtained_marks}/{r.total_marks}{" "}
                    <span className="text-xs text-gray-400">({r.percentage}%)</span>
                  </TableCell>
                  <TableCell>
                    {r.passed == null ? (
                      "—"
                    ) : r.passed ? (
                      <Badge variant="success">Pass</Badge>
                    ) : (
                      <Badge variant="danger">Fail</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.status === "published" ? "success" : "warning"}>
                      {r.status.replace(/_/g, " ")}
                    </Badge>
                    {r.needs_manual_review && (
                      <span className="ml-1 text-[11px] text-amber-700">manual</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-gray-600">
                    {formatDate(r.submitted_at)}
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void openDetail(r.id)}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Detail
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {detail && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <Card className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden">
            <CardHeader className="flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="text-lg">{detail.student_name}</CardTitle>
                <CardDescription>
                  {detail.obtained_marks}/{detail.total_marks} · {detail.percentage}% ·{" "}
                  {detail.passed ? "Pass" : "Fail"}
                  {detail.negative_marks > 0
                    ? ` · −${detail.negative_marks} negative`
                    : ""}
                </CardDescription>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => setDetail(null)}>
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 space-y-3 overflow-y-auto">
              {detail.questions.map((q, i) => (
                <div key={q.question_id} className="rounded-lg border border-slate-100 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-slate-900">
                      Q{i + 1}. {q.title}
                    </p>
                    <span className="shrink-0 text-xs text-slate-500">
                      {q.marks_awarded}/{q.marks_possible}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {q.question_type} · {q.evaluation_status.replace(/_/g, " ")}
                    {q.is_correct === true && (
                      <CheckCircle2 className="ml-1 inline h-3.5 w-3.5 text-emerald-600" />
                    )}
                    {q.is_correct === false && (
                      <XCircle className="ml-1 inline h-3.5 w-3.5 text-rose-600" />
                    )}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    Selected: {q.selected.length ? q.selected.join(", ") : "—"}
                    {q.correct_labels?.length
                      ? ` · Correct: ${q.correct_labels.join(", ")}`
                      : ""}
                  </p>
                  {q.question_type === "short_answer" && write && (
                    <div className="mt-2 flex flex-wrap items-end gap-2">
                      <div>
                        <label className="text-[11px] text-slate-500">Marks (AI-ready / manual)</label>
                        <Input
                          type="number"
                          min={0}
                          max={q.marks_possible}
                          className="mt-0.5 h-8 w-24"
                          value={manualMarks[q.question_id] ?? "0"}
                          onChange={(e) =>
                            setManualMarks((m) => ({
                              ...m,
                              [q.question_id]: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => void scoreShort(q.question_id, q.marks_possible)}
                      >
                        Save score
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
