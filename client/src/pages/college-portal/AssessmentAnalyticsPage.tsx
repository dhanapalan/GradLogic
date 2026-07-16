/**
 * Phase 2 Module 08 — Analytics & Reports for Assessment Campaigns.
 */
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download, FileSpreadsheet, FileText } from "lucide-react";
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
import campusCampaignAnalyticsService from "../../services/campusCampaignAnalyticsService";

const BASE = "/app/college-portal";

function pct(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return "—";
  return `${n}%`;
}

function num(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return "—";
  return String(n);
}

export default function AssessmentAnalyticsPage() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const [exporting, setExporting] = useState<"xlsx" | "pdf" | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["campus-campaign-analytics", campaignId],
    queryFn: () => campusCampaignAnalyticsService.get(campaignId!),
    enabled: !!campaignId,
  });

  const download = async (format: "xlsx" | "pdf") => {
    if (!campaignId) return;
    setExporting(format);
    try {
      await campusCampaignAnalyticsService.export(campaignId, format);
      toast.success(format === "pdf" ? "PDF downloaded" : "Excel downloaded");
    } catch {
      toast.error("Export failed");
    } finally {
      setExporting(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate-500">
        Loading analytics…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-slate-600">Could not load campaign analytics.</p>
        <Link
          to={`${BASE}/campaigns`}
          className="mt-4 inline-flex items-center justify-center rounded-lg border px-4 py-2 text-sm font-medium"
        >
          Back to Campaigns
        </Link>
      </div>
    );
  }

  const { campaign, assessment_summary: summary, attempt_statistics: attempts, time_analysis: time } =
    data;
  const maxBucket = Math.max(1, ...time.buckets.map((b) => b.count));

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
            Analytics & Reports
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {campaign.name} · {campaign.campaign_code} · {campaign.assessment_name}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to={`${BASE}/campaigns/${campaignId}/results`}
            className="inline-flex h-9 items-center justify-center rounded-md border border-gray-200 bg-white px-3 text-sm font-medium hover:bg-gray-50"
          >
            Evaluation & Results
          </Link>
          <Button
            type="button"
            variant="outline"
            disabled={exporting !== null}
            onClick={() => void download("xlsx")}
          >
            <FileSpreadsheet className="h-4 w-4" />
            {exporting === "xlsx" ? "Exporting…" : "Excel"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={exporting !== null}
            onClick={() => void download("pdf")}
          >
            <FileText className="h-4 w-4" />
            {exporting === "pdf" ? "Exporting…" : "PDF"}
          </Button>
        </div>
      </div>

      {/* Assessment Summary + Pass % */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Assessment summary
        </h2>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {(
            [
              ["Assigned", summary.assigned],
              ["Submitted", summary.submitted],
              ["Evaluated", summary.evaluated],
              ["Pass %", pct(summary.pass_percentage)],
              ["Avg %", pct(summary.avg_percentage)],
              ["Avg score", num(summary.avg_score)],
              ["Passed", summary.passed],
              ["Failed", summary.failed],
              ["Published", summary.published],
              ["Manual review", summary.needs_manual_review],
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
      </section>

      {/* Attempt Statistics + Time Analysis */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Attempt statistics</CardTitle>
            <CardDescription>
              Completion rate {pct(attempts.completion_rate)} of assigned students
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {(
              [
                ["Assigned", attempts.assigned],
                ["Started", attempts.started],
                ["In progress", attempts.in_progress],
                ["Submitted", attempts.submitted],
                ["Expired", attempts.expired],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="rounded-lg border border-gray-100 px-3 py-2">
                <div className="text-xs text-gray-500">{label}</div>
                <div className="text-lg font-semibold text-gray-900">{value}</div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Time analysis</CardTitle>
            <CardDescription>
              Configured duration:{" "}
              {time.configured_duration_minutes != null
                ? `${time.configured_duration_minutes} min`
                : "—"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(
                [
                  ["Avg", time.avg_minutes],
                  ["Median", time.median_minutes],
                  ["Min", time.min_minutes],
                  ["Max", time.max_minutes],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="rounded-lg border border-gray-100 px-3 py-2">
                  <div className="text-xs text-gray-500">{label} (min)</div>
                  <div className="text-lg font-semibold text-gray-900">{value}</div>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              {time.buckets.length === 0 ? (
                <p className="text-sm text-gray-500">No completed attempts with timing data yet.</p>
              ) : (
                time.buckets.map((b) => (
                  <div key={b.bucket} className="flex items-center gap-3 text-sm">
                    <span className="w-24 shrink-0 text-gray-600">{b.bucket}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded bg-gray-100">
                      <div
                        className="h-full rounded bg-slate-700"
                        style={{ width: `${(b.count / maxBucket) * 100}%` }}
                      />
                    </div>
                    <span className="w-8 text-right tabular-nums text-gray-700">{b.count}</span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Department Performance */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Department performance</CardTitle>
          <CardDescription>Grouped by student specialization</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Department</TableHead>
                <TableHead className="text-right">Students</TableHead>
                <TableHead className="text-right">Avg %</TableHead>
                <TableHead className="text-right">Pass %</TableHead>
                <TableHead className="text-right">Passed</TableHead>
                <TableHead className="text-right">Failed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.department_performance.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-sm text-gray-500">
                    No evaluated results yet.
                  </TableCell>
                </TableRow>
              ) : (
                data.department_performance.map((d) => (
                  <TableRow key={d.department}>
                    <TableCell className="font-medium">{d.department}</TableCell>
                    <TableCell className="text-right">{d.students}</TableCell>
                    <TableCell className="text-right">{pct(d.avg_percentage)}</TableCell>
                    <TableCell className="text-right">{pct(d.pass_percentage)}</TableCell>
                    <TableCell className="text-right">{d.passed}</TableCell>
                    <TableCell className="text-right">{d.failed}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Difficulty Analysis */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Difficulty analysis</CardTitle>
          <CardDescription>Accuracy and average marks by difficulty band</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Difficulty</TableHead>
                <TableHead className="text-right">Questions</TableHead>
                <TableHead className="text-right">Attempts</TableHead>
                <TableHead className="text-right">Accuracy</TableHead>
                <TableHead className="text-right">Avg marks</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.difficulty_analysis.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-sm text-gray-500">
                    No question results yet.
                  </TableCell>
                </TableRow>
              ) : (
                data.difficulty_analysis.map((d) => (
                  <TableRow key={d.difficulty}>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize">
                        {d.difficulty}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{d.questions}</TableCell>
                    <TableCell className="text-right">{d.attempts}</TableCell>
                    <TableCell className="text-right">{pct(d.accuracy_pct)}</TableCell>
                    <TableCell className="text-right">{num(d.avg_marks)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Question Analysis */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Question analysis</CardTitle>
          <CardDescription>Sorted by lowest accuracy first (hardest items)</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Question</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Difficulty</TableHead>
                <TableHead className="text-right">Attempts</TableHead>
                <TableHead className="text-right">Correct</TableHead>
                <TableHead className="text-right">Incorrect</TableHead>
                <TableHead className="text-right">Pending</TableHead>
                <TableHead className="text-right">Accuracy</TableHead>
                <TableHead className="text-right">Avg marks</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.question_analysis.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-8 text-center text-sm text-gray-500">
                    No question results yet.
                  </TableCell>
                </TableRow>
              ) : (
                data.question_analysis.map((q) => (
                  <TableRow key={q.question_id}>
                    <TableCell className="max-w-xs truncate font-medium" title={q.title}>
                      {q.title}
                    </TableCell>
                    <TableCell className="capitalize">{q.question_type.replace(/_/g, " ")}</TableCell>
                    <TableCell className="capitalize">{q.difficulty || "—"}</TableCell>
                    <TableCell className="text-right">{q.attempts}</TableCell>
                    <TableCell className="text-right">{q.correct}</TableCell>
                    <TableCell className="text-right">{q.incorrect}</TableCell>
                    <TableCell className="text-right">{q.pending}</TableCell>
                    <TableCell className="text-right">{pct(q.accuracy_pct)}</TableCell>
                    <TableCell className="text-right">{num(q.avg_marks)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Student Performance */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">Student performance</CardTitle>
              <CardDescription>Per-attempt scores and timing</CardDescription>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={exporting !== null}
              onClick={() => void download("xlsx")}
            >
              <Download className="h-3.5 w-3.5" />
              Export all sheets
            </Button>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Department</TableHead>
                <TableHead className="text-right">Attempt</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Score</TableHead>
                <TableHead className="text-right">%</TableHead>
                <TableHead>Pass</TableHead>
                <TableHead className="text-right">Time (min)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.student_performance.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-sm text-gray-500">
                    No attempts yet.
                  </TableCell>
                </TableRow>
              ) : (
                data.student_performance.map((s) => (
                  <TableRow key={`${s.user_id}-${s.attempt_number}`}>
                    <TableCell>
                      <div className="font-medium text-gray-900">{s.name}</div>
                      <div className="text-xs text-gray-500">{s.email}</div>
                    </TableCell>
                    <TableCell>{s.department}</TableCell>
                    <TableCell className="text-right">{s.attempt_number}</TableCell>
                    <TableCell className="capitalize">
                      {s.attempt_status.replace(/_/g, " ")}
                    </TableCell>
                    <TableCell className="text-right">
                      {s.obtained_marks != null
                        ? `${s.obtained_marks}/${s.total_marks ?? "—"}`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">{pct(s.percentage)}</TableCell>
                    <TableCell>
                      {s.passed === true ? (
                        <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                          Pass
                        </Badge>
                      ) : s.passed === false ? (
                        <Badge variant="secondary">Fail</Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-right">{num(s.duration_minutes)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
