/**
 * Phase 2 Module 08 — Assessment Analytics & Reports (college-wide).
 * Placement / AI insights are intentionally out of scope.
 */
import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  ClipboardList,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Search,
  Target,
  Users,
  CheckCircle2,
  Clock,
  Percent,
  TrendingUp,
  Sparkles,
} from "lucide-react";
import toast from "react-hot-toast";
import StatsCard from "../../components/superadmin/StatsCard";
import ChartCard from "../../components/superadmin/ChartCard";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
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
import campusAssessmentAnalyticsService, {
  type AnalyticsFilters,
  type AnalyticsReportType,
} from "../../services/campusAssessmentAnalyticsService";

const BASE = "/app/college-portal";

const EMPTY: AnalyticsFilters = {
  search: "",
  academic_year: "",
  department: "",
  assessment_id: "",
  campaign_id: "",
  result: "",
  date_from: "",
  date_to: "",
};

function cleanFilters(f: AnalyticsFilters): AnalyticsFilters {
  const out: AnalyticsFilters = {};
  (Object.keys(f) as (keyof AnalyticsFilters)[]).forEach((k) => {
    const v = f[k];
    if (v !== undefined && v !== null && v !== "") out[k] = v as never;
  });
  return out;
}

function pct(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return "—";
  return `${n}%`;
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function CollegePortalAnalytics() {
  const [draft, setDraft] = useState<AnalyticsFilters>(EMPTY);
  const [applied, setApplied] = useState<AnalyticsFilters>({});
  const [showFilters, setShowFilters] = useState(true);
  const [assessmentPage, setAssessmentPage] = useState(1);
  const [studentPage, setStudentPage] = useState(1);
  const [exporting, setExporting] = useState<string | null>(null);
  const [reportType, setReportType] = useState<AnalyticsReportType>("summary");

  const filters = useMemo(() => cleanFilters(applied), [applied]);

  const metaQ = useQuery({
    queryKey: ["campus-assessment-analytics", "meta"],
    queryFn: () => campusAssessmentAnalyticsService.getMeta(),
    staleTime: 60_000,
  });

  const dashQ = useQuery({
    queryKey: ["campus-assessment-analytics", "summary", filters],
    queryFn: () => campusAssessmentAnalyticsService.getDashboard(filters),
    staleTime: 30_000,
  });

  const assessmentsQ = useQuery({
    queryKey: ["campus-assessment-analytics", "assessments", filters, assessmentPage],
    queryFn: () =>
      campusAssessmentAnalyticsService.getAssessments({
        ...filters,
        page: assessmentPage,
        limit: 15,
      }),
  });

  const studentsQ = useQuery({
    queryKey: ["campus-assessment-analytics", "students", filters, studentPage],
    queryFn: () =>
      campusAssessmentAnalyticsService.getStudents({
        ...filters,
        page: studentPage,
        limit: 15,
      }),
  });

  const departmentsQ = useQuery({
    queryKey: ["campus-assessment-analytics", "departments", filters],
    queryFn: () => campusAssessmentAnalyticsService.getDepartments(filters),
  });

  const summary = dashQ.data?.summary;
  const charts = dashQ.data?.charts;
  const forcedDept = metaQ.data?.forced_department;
  const loading = dashQ.isLoading;

  const applyFilters = () => {
    if (draft.date_from && draft.date_to && draft.date_from > draft.date_to) {
      toast.error("Date from must be before date to");
      return;
    }
    setAssessmentPage(1);
    setStudentPage(1);
    setApplied(cleanFilters(draft));
  };

  const resetFilters = () => {
    const next = forcedDept ? { ...EMPTY, department: forcedDept } : { ...EMPTY };
    setDraft(next);
    setApplied(forcedDept ? { department: forcedDept } : {});
    setAssessmentPage(1);
    setStudentPage(1);
  };

  const doExport = async (format: "xlsx" | "pdf") => {
    setExporting(`${format}-${reportType}`);
    try {
      await campusAssessmentAnalyticsService.export(format, reportType, filters);
      toast.success(format === "pdf" ? "PDF downloaded" : "Excel downloaded");
    } catch {
      toast.error("Export failed");
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            Analytics & Reports
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Assessment performance across published assessments and campaigns
          </p>
          {forcedDept && (
            <p className="mt-1 text-xs text-amber-700">
              Department scope: {forcedDept} (faculty view)
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/app/college-portal/evaluation-insights">
            <Button type="button" variant="outline" size="sm">
              <Sparkles className="mr-1.5 h-4 w-4" />
              AI Evaluation Summary
            </Button>
          </Link>
          <Select
            value={reportType}
            onChange={(e) => setReportType(e.target.value as AnalyticsReportType)}
            className="w-40"
            aria-label="Report type"
          >
            <option value="summary">Summary report</option>
            <option value="assessment">Assessment report</option>
            <option value="student">Student report</option>
            <option value="department">Department report</option>
            <option value="campaign">Campaign report</option>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!!exporting}
            onClick={() => void doExport("xlsx")}
          >
            <FileSpreadsheet className="mr-1.5 h-4 w-4" />
            Excel
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!!exporting}
            onClick={() => void doExport("pdf")}
          >
            <FileText className="mr-1.5 h-4 w-4" />
            PDF
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowFilters((v) => !v)}
          >
            <Filter className="mr-1.5 h-4 w-4" />
            Filters
          </Button>
        </div>
      </div>

      {showFilters && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Filters & search</CardTitle>
            <CardDescription>
              Search by assessment or student name; export respects applied filters
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                className="pl-9"
                placeholder="Search assessment or student name…"
                value={draft.search || ""}
                onChange={(e) => setDraft((d) => ({ ...d, search: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applyFilters();
                }}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <FilterField label="Academic year">
                <Select
                  value={draft.academic_year || ""}
                  onChange={(e) => setDraft((d) => ({ ...d, academic_year: e.target.value }))}
                >
                  <option value="">All years</option>
                  {(metaQ.data?.academic_years ?? []).map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </Select>
              </FilterField>
              <FilterField label="Department">
                <Select
                  value={draft.department || ""}
                  disabled={Boolean(forcedDept)}
                  onChange={(e) => setDraft((d) => ({ ...d, department: e.target.value }))}
                >
                  <option value="">All departments</option>
                  {(metaQ.data?.departments ?? []).map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </Select>
              </FilterField>
              <FilterField label="Assessment">
                <Select
                  value={draft.assessment_id || ""}
                  onChange={(e) => setDraft((d) => ({ ...d, assessment_id: e.target.value }))}
                >
                  <option value="">All assessments</option>
                  {(metaQ.data?.assessments ?? []).map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </Select>
              </FilterField>
              <FilterField label="Campaign">
                <Select
                  value={draft.campaign_id || ""}
                  onChange={(e) => setDraft((d) => ({ ...d, campaign_id: e.target.value }))}
                >
                  <option value="">All campaigns</option>
                  {(metaQ.data?.campaigns ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </FilterField>
              <FilterField label="Result">
                <Select
                  value={draft.result || ""}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      result: e.target.value as "" | "pass" | "fail",
                    }))
                  }
                >
                  <option value="">All results</option>
                  <option value="pass">Pass</option>
                  <option value="fail">Fail</option>
                </Select>
              </FilterField>
              <FilterField label="Date from">
                <Input
                  type="date"
                  value={draft.date_from || ""}
                  onChange={(e) => setDraft((d) => ({ ...d, date_from: e.target.value }))}
                />
              </FilterField>
              <FilterField label="Date to">
                <Input
                  type="date"
                  value={draft.date_to || ""}
                  onChange={(e) => setDraft((d) => ({ ...d, date_to: e.target.value }))}
                />
              </FilterField>
              <div className="flex items-end gap-2 xl:col-span-2">
                <Button type="button" className="flex-1" onClick={applyFilters}>
                  Apply
                </Button>
                <Button type="button" variant="outline" onClick={resetFilters}>
                  Reset
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {dashQ.isError && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          Could not load analytics summary.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatsCard
          title="Total Assessments"
          value={summary?.total_assessments ?? "—"}
          icon={<ClipboardList className="h-4 w-4" />}
          color="blue"
          loading={loading}
        />
        <StatsCard
          title="Published Assessments"
          value={summary?.published_assessments ?? "—"}
          icon={<CheckCircle2 className="h-4 w-4" />}
          color="emerald"
          loading={loading}
        />
        <StatsCard
          title="Active Campaigns"
          value={summary?.active_campaigns ?? "—"}
          icon={<Target className="h-4 w-4" />}
          color="violet"
          loading={loading}
        />
        <StatsCard
          title="Total Attempts"
          value={summary?.total_attempts ?? "—"}
          icon={<Users className="h-4 w-4" />}
          color="cyan"
          loading={loading}
        />
        <StatsCard
          title="Completed Attempts"
          value={summary?.completed_attempts ?? "—"}
          icon={<BarChart3 className="h-4 w-4" />}
          color="indigo"
          loading={loading}
        />
        <StatsCard
          title="Pending Attempts"
          value={summary?.pending_attempts ?? "—"}
          icon={<Clock className="h-4 w-4" />}
          color="amber"
          loading={loading}
        />
        <StatsCard
          title="Average Score"
          value={summary != null ? pct(summary.average_score) : "—"}
          icon={<TrendingUp className="h-4 w-4" />}
          color="orange"
          loading={loading}
        />
        <StatsCard
          title="Overall Pass %"
          value={summary != null ? pct(summary.overall_pass_percentage) : "—"}
          icon={<Percent className="h-4 w-4" />}
          color="rose"
          loading={loading}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Assessment Completion"
          subtitle="Assigned · Attempted · Pending"
          data={charts?.completion ?? []}
          variant="bar"
          color="blue"
          loading={loading}
        />
        <ChartCard
          title="Assessment Result Distribution"
          subtitle="Pass · Fail"
          data={charts?.result_distribution ?? []}
          variant="bar"
          color="emerald"
          loading={loading}
        />
        <ChartCard
          title="Department Average Score"
          subtitle="By specialization"
          data={charts?.department_average_score ?? []}
          variant="bar"
          color="indigo"
          loading={loading}
        />
        <ChartCard
          title="Average Score Trend"
          subtitle="Weekly"
          data={charts?.average_score_trend ?? []}
          variant="area"
          color="cyan"
          loading={loading}
        />
      </div>

      {/* Assessment performance */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Assessment Performance</CardTitle>
          <CardDescription>Published assessments and campaign outcomes</CardDescription>
        </CardHeader>
        <CardContent>
          {assessmentsQ.isLoading ? (
            <p className="py-8 text-center text-sm text-slate-500">Loading…</p>
          ) : !assessmentsQ.data?.data?.length ? (
            <EmptyState message="No assessment performance data for the current filters." />
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Assessment Name</TableHead>
                      <TableHead>Campaign</TableHead>
                      <TableHead className="text-right">Total Assigned</TableHead>
                      <TableHead className="text-right">Total Attempted</TableHead>
                      <TableHead className="text-right">Completion %</TableHead>
                      <TableHead className="text-right">Average Score</TableHead>
                      <TableHead className="text-right">Pass %</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assessmentsQ.data.data.map((row) => (
                      <TableRow key={`${row.campaign_id}-${row.assessment_id}`}>
                        <TableCell className="font-medium">{row.assessment_name}</TableCell>
                        <TableCell>
                          <Link
                            to={`${BASE}/campaigns/${row.campaign_id}/analytics`}
                            className="text-admin-accent hover:underline"
                          >
                            {row.campaign}
                          </Link>
                        </TableCell>
                        <TableCell className="text-right">{row.total_assigned}</TableCell>
                        <TableCell className="text-right">{row.total_attempted}</TableCell>
                        <TableCell className="text-right">{pct(row.completion_pct)}</TableCell>
                        <TableCell className="text-right">{pct(row.average_score)}</TableCell>
                        <TableCell className="text-right">{pct(row.pass_pct)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {row.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Pager
                page={assessmentPage}
                pages={assessmentsQ.data.pagination.pages}
                total={assessmentsQ.data.pagination.total}
                onChange={setAssessmentPage}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Student performance */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Student Performance</CardTitle>
          <CardDescription>Completed attempts with evaluated scores</CardDescription>
        </CardHeader>
        <CardContent>
          {studentsQ.isLoading ? (
            <p className="py-8 text-center text-sm text-slate-500">Loading…</p>
          ) : !studentsQ.data?.data?.length ? (
            <EmptyState message="No student performance rows for the current filters." />
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student Name</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Assessment</TableHead>
                      <TableHead className="text-right">Score</TableHead>
                      <TableHead className="text-right">Percentage</TableHead>
                      <TableHead>Result</TableHead>
                      <TableHead className="text-right">Attempt #</TableHead>
                      <TableHead>Submitted On</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {studentsQ.data.data.map((row, idx) => (
                      <TableRow
                        key={`${row.student_name}-${row.assessment}-${row.attempt_number}-${idx}`}
                      >
                        <TableCell className="font-medium">{row.student_name}</TableCell>
                        <TableCell>{row.department}</TableCell>
                        <TableCell>{row.assessment}</TableCell>
                        <TableCell className="text-right">
                          {row.score != null ? row.score : "—"}
                        </TableCell>
                        <TableCell className="text-right">{pct(row.percentage)}</TableCell>
                        <TableCell>
                          <ResultBadge result={row.result} />
                        </TableCell>
                        <TableCell className="text-right">{row.attempt_number}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-slate-600">
                          {formatDate(row.submitted_on)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Pager
                page={studentPage}
                pages={studentsQ.data.pagination.pages}
                total={studentsQ.data.pagination.total}
                onChange={setStudentPage}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Department performance */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Department Performance</CardTitle>
          <CardDescription>Aggregated by student specialization</CardDescription>
        </CardHeader>
        <CardContent>
          {departmentsQ.isLoading ? (
            <p className="py-8 text-center text-sm text-slate-500">Loading…</p>
          ) : !departmentsQ.data?.data?.length ? (
            <EmptyState message="No department performance data for the current filters." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Department</TableHead>
                    <TableHead className="text-right">Students Assigned</TableHead>
                    <TableHead className="text-right">Students Attempted</TableHead>
                    <TableHead className="text-right">Average Score</TableHead>
                    <TableHead className="text-right">Pass %</TableHead>
                    <TableHead className="text-right">Completion %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {departmentsQ.data.data.map((row) => (
                    <TableRow key={row.department}>
                      <TableCell className="font-medium">{row.department}</TableCell>
                      <TableCell className="text-right">{row.students_assigned}</TableCell>
                      <TableCell className="text-right">{row.students_attempted}</TableCell>
                      <TableCell className="text-right">{pct(row.average_score)}</TableCell>
                      <TableCell className="text-right">{pct(row.pass_pct)}</TableCell>
                      <TableCell className="text-right">{pct(row.completion_pct)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="flex items-center gap-1.5 text-xs text-slate-400">
        <Download className="h-3.5 w-3.5" />
        Exports and filters are audited. Draft assessments are excluded; archived campaigns remain
        available for historical reporting.
      </p>
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1 text-xs font-medium text-slate-600">
      <span>{label}</span>
      {children}
    </label>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
      {message}
    </div>
  );
}

function ResultBadge({ result }: { result: string }) {
  if (result === "Pass") {
    return (
      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200" variant="outline">
        Pass
      </Badge>
    );
  }
  if (result === "Fail") {
    return (
      <Badge className="bg-rose-50 text-rose-700 border-rose-200" variant="outline">
        Fail
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-slate-500">
      —
    </Badge>
  );
}

function Pager({
  page,
  pages,
  total,
  onChange,
}: {
  page: number;
  pages: number;
  total: number;
  onChange: (p: number) => void;
}) {
  if (pages <= 1) {
    return (
      <p className="mt-3 text-xs text-slate-500">
        {total} row{total === 1 ? "" : "s"}
      </p>
    );
  }
  return (
    <div className="mt-3 flex items-center justify-between gap-2">
      <p className="text-xs text-slate-500">
        Page {page} of {pages} · {total} rows
      </p>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          Previous
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
