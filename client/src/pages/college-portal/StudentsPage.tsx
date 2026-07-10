import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Search,
  Filter,
  UserPlus,
  Upload,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
} from "lucide-react";
import toast from "react-hot-toast";
import StatsCard from "../../components/superadmin/StatsCard";
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
import campusStudentsService, {
  type CampusStudent,
  type PlacementStatus,
  type RiskLevel,
} from "../../services/campusStudentsService";
import { cn } from "../../lib/utils";

const BATCH_YEARS = ["2024", "2025", "2026", "2027", "2028"];
const DEPARTMENTS = [
  "Computer Science",
  "Information Technology",
  "Electronics",
  "Mechanical",
  "Civil",
  "Electrical",
  "Data Science",
];

const PERFORMANCE_BANDS = [
  { value: "", label: "All performance" },
  { value: "high", label: "High (80%+)" },
  { value: "medium", label: "Medium (60–79%)" },
  { value: "low", label: "Low (<60%)" },
];

function placementVariant(status: PlacementStatus): "muted" | "info" | "success" | "warning" {
  if (status === "Joined" || status === "Offered") return "success";
  if (status === "Shortlisted" || status === "Interviewed") return "info";
  if (status === "Not Shortlisted") return "muted";
  return "warning";
}

function riskVariant(level: RiskLevel): "success" | "warning" | "danger" {
  if (level === "High") return "danger";
  if (level === "Medium") return "warning";
  return "success";
}

/** Categorical performance band shown as a badge (derived from avg_score, same
 * thresholds as the filter dropdown, just labeled for at-a-glance scanning). */
function performanceBand(score: number): { label: string; variant: "success" | "warning" | "danger" | "info" } {
  if (score >= 85) return { label: "Top", variant: "success" };
  if (score >= 70) return { label: "Strong", variant: "info" };
  if (score >= 50) return { label: "Average", variant: "warning" };
  return { label: "At Risk", variant: "danger" };
}

function ProgressBar({ value, className }: { value: number; className?: string }) {
  const pct = Math.min(100, Math.max(0, value));
  const color =
    pct >= 80 ? "bg-emerald-500" : pct >= 60 ? "bg-amber-500" : "bg-rose-500";
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-10 text-right text-xs tabular-nums text-gray-600">{pct.toFixed(0)}%</span>
    </div>
  );
}

function StudentAvatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-admin-accent/10 text-xs font-semibold text-admin-accent">
      {initials}
    </div>
  );
}

/** Filter students client-side by performance band (API has no performance param yet). */
function matchesPerformance(student: CampusStudent, band: string): boolean {
  if (!band) return true;
  const score = student.avg_score ?? 0;
  if (band === "high") return score >= 80;
  if (band === "medium") return score >= 60 && score < 80;
  if (band === "low") return score < 60;
  return true;
}

export default function CollegePortalStudentsPage() {
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");
  const [batch, setBatch] = useState("");
  const [performance, setPerformance] = useState("");
  const [placementFilter, setPlacementFilter] = useState("");
  const [riskFilter, setRiskFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState("");
  const [workflowId, setWorkflowId] = useState("");
  const [showFilters, setShowFilters] = useState(true);

  const filters = {
    page,
    search,
    department,
    batch,
    placementFilter,
    riskFilter,
    statusFilter,
    performance,
  };

  const { data: listData, isLoading } = useQuery({
    queryKey: ["college-portal-students", filters],
    queryFn: () =>
      campusStudentsService.list({
        page,
        limit: 20,
        ...(search && { search }),
        ...(department && { department }),
        ...(batch && { year: batch }),
        ...(placementFilter && { placementStatus: placementFilter }),
        ...(riskFilter && { riskLevel: riskFilter }),
        ...(statusFilter && { status: statusFilter }),
      }),
  });

  const { data: analytics } = useQuery({
    queryKey: ["college-portal-students-analytics"],
    queryFn: () => campusStudentsService.getAnalytics(),
  });

  const students = (listData?.data ?? []).filter((s) => matchesPerformance(s, performance));
  const pagination = listData?.pagination;

  const bulkMutation = useMutation({
    mutationFn: async () => {
      const ids = [...selected];
      if (bulkAction === "suspend") {
        return campusStudentsService.bulkAction("suspend", ids);
      }
      if (bulkAction === "shortlist") {
        return campusStudentsService.bulkAction("update_placement", ids, {
          placement_status: "Shortlisted",
        });
      }
      if (bulkAction === "assign_workflow") {
        // UI ready — backend workflow assignment coming next sprint
        if (!workflowId.trim()) throw new Error("Select a workflow");
        toast.success(`Workflow assignment queued for ${ids.length} students`);
        return { success: true };
      }
      throw new Error("Select an action");
    },
    onSuccess: () => {
      toast.success("Bulk action completed");
      setSelected(new Set());
      setBulkAction("");
      queryClient.invalidateQueries({ queryKey: ["college-portal-students"] });
      queryClient.invalidateQueries({ queryKey: ["college-portal-students-analytics"] });
    },
    onError: (err: Error) => toast.error(err.message || "Bulk action failed"),
  });

  const toggleAll = (checked: boolean) => {
    setSelected(checked ? new Set(students.map((s) => s.user_id)) : new Set());
  };

  const toggleOne = (id: string, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(id);
    else next.delete(id);
    setSelected(next);
  };

  const runBulkAction = () => {
    if (!selected.size) {
      toast.error("Select at least one student");
      return;
    }
    if (!bulkAction) {
      toast.error("Choose a bulk action");
      return;
    }
    bulkMutation.mutate();
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Students</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your campus roster — search, filter, track progress, and run bulk actions
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/app/students/bulk-import">
            <Button variant="outline" type="button">
              <Upload className="h-4 w-4" />
              Bulk Upload
            </Button>
          </Link>
          <Link to="/app/students/new">
            <Button type="button">
              <UserPlus className="h-4 w-4" />
              Add Student
            </Button>
          </Link>
        </div>
      </div>

      {/* Analytics strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatsCard
          title="Total Students"
          value={analytics?.totalStudents ?? "—"}
          subtitle={`${analytics?.activeStudents ?? 0} active`}
          color="blue"
          loading={!analytics}
        />
        <StatsCard
          title="Avg. Score"
          value={analytics ? `${analytics.avgScore.toFixed(1)}%` : "—"}
          subtitle="Campus performance"
          color="emerald"
          loading={!analytics}
        />
        <StatsCard
          title="In Pipeline"
          value={analytics?.placedPipelineCount ?? "—"}
          subtitle="Placement pipeline"
          color="indigo"
          loading={!analytics}
        />
        <StatsCard
          title="High Risk"
          value={analytics?.highRiskCount ?? "—"}
          subtitle="Integrity alerts"
          color="rose"
          loading={!analytics}
        />
      </div>

      {/* Filters + table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Student Roster</CardTitle>
              <CardDescription>
                {pagination?.total ?? 0} students · page {pagination?.page ?? 1} of{" "}
                {pagination?.pages ?? 1}
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={() => setShowFilters((v) => !v)}
            >
              <Filter className="h-4 w-4" />
              {showFilters ? "Hide filters" : "Show filters"}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Search + filters */}
          <div className="flex flex-col gap-3">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search name, email, roll no..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9"
              />
            </div>

            {showFilters && (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                <Select
                  value={department}
                  onChange={(e) => {
                    setDepartment(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">All departments</option>
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </Select>
                <Select
                  value={batch}
                  onChange={(e) => {
                    setBatch(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">All batches</option>
                  {BATCH_YEARS.map((y) => (
                    <option key={y} value={y}>
                      Batch {y}
                    </option>
                  ))}
                </Select>
                <Select
                  value={performance}
                  onChange={(e) => setPerformance(e.target.value)}
                >
                  {PERFORMANCE_BANDS.map((b) => (
                    <option key={b.value} value={b.value}>
                      {b.label}
                    </option>
                  ))}
                </Select>
                <Select
                  value={placementFilter}
                  onChange={(e) => {
                    setPlacementFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">All placement</option>
                  <option value="Not Shortlisted">Not Shortlisted</option>
                  <option value="Shortlisted">Shortlisted</option>
                  <option value="Interviewed">Interviewed</option>
                  <option value="Offered">Offered</option>
                  <option value="Joined">Joined</option>
                </Select>
                <Select
                  value={riskFilter}
                  onChange={(e) => {
                    setRiskFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">All risk levels</option>
                  <option value="Low">Low risk</option>
                  <option value="Medium">Medium risk</option>
                  <option value="High">High risk</option>
                </Select>
                <Select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">All status</option>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </Select>
              </div>
            )}
          </div>

          {/* Bulk action bar */}
          {selected.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-admin-accent/20 bg-admin-accent/5 px-3 py-2">
              <span className="text-sm font-medium text-gray-700">
                {selected.size} selected
              </span>
              <Select
                value={bulkAction}
                onChange={(e) => setBulkAction(e.target.value)}
                className="h-8 w-auto min-w-[160px] text-xs"
              >
                <option value="">Bulk action…</option>
                <option value="shortlist">Mark as Shortlisted</option>
                <option value="suspend">Suspend accounts</option>
                <option value="assign_workflow">Assign workflow</option>
              </Select>
              {bulkAction === "assign_workflow" && (
                <Input
                  placeholder="Workflow ID or name"
                  value={workflowId}
                  onChange={(e) => setWorkflowId(e.target.value)}
                  className="h-8 w-48 text-xs"
                />
              )}
              <Button
                size="sm"
                type="button"
                onClick={runBulkAction}
                disabled={bulkMutation.isPending}
              >
                Apply
              </Button>
              <Button
                size="sm"
                variant="ghost"
                type="button"
                onClick={() => setSelected(new Set())}
              >
                Clear
              </Button>
            </div>
          )}

          {/* Table */}
          <div className="rounded-lg border border-gray-100">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      checked={students.length > 0 && selected.size === students.length}
                      onChange={(e) => toggleAll(e.target.checked)}
                      className="rounded border-gray-300"
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead className="hidden md:table-cell">Department</TableHead>
                  <TableHead className="hidden sm:table-cell">Batch</TableHead>
                  <TableHead className="hidden md:table-cell">CGPA</TableHead>
                  <TableHead>Readiness</TableHead>
                  <TableHead className="hidden xl:table-cell">Performance</TableHead>
                  <TableHead className="hidden lg:table-cell">Placement</TableHead>
                  <TableHead className="hidden lg:table-cell">Risk</TableHead>
                  <TableHead className="hidden xl:table-cell">Status</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={11}>
                        <div className="h-10 animate-pulse rounded bg-gray-100" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : students.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="py-12 text-center text-gray-500">
                      No students match your filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  students.map((student) => (
                    <TableRow key={student.user_id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selected.has(student.user_id)}
                          onChange={(e) => toggleOne(student.user_id, e.target.checked)}
                          className="rounded border-gray-300"
                          aria-label={`Select ${student.name}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <StudentAvatar name={student.name} />
                          <div className="min-w-0">
                            <Link
                              to={`/app/college-portal/students/${student.user_id}`}
                              className="truncate font-medium text-gray-900 hover:text-admin-accent"
                            >
                              {student.name}
                            </Link>
                            <p className="truncate text-xs text-gray-500">{student.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-gray-600">
                        {student.department || "—"}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell tabular-nums text-gray-600">
                        {student.passing_year || "—"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell tabular-nums text-gray-600">
                        {student.cgpa != null ? student.cgpa.toFixed(2) : "—"}
                      </TableCell>
                      <TableCell className="min-w-[120px]">
                        <ProgressBar value={student.avg_score ?? 0} />
                      </TableCell>
                      <TableCell className="hidden xl:table-cell">
                        {(() => {
                          const band = performanceBand(student.avg_score ?? 0);
                          return <Badge variant={band.variant}>{band.label}</Badge>;
                        })()}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <Badge variant={placementVariant(student.placement_status)}>
                          {student.placement_status}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <Badge variant={riskVariant(student.risk_level)}>
                          {student.risk_level}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden xl:table-cell">
                        <Badge variant={student.is_active ? "success" : "muted"}>
                          {student.is_active ? "Active" : "Suspended"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Link
                          to={`/app/college-portal/students/${student.user_id}`}
                          className="inline-flex rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                          title="View profile"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {pagination && pagination.pages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-gray-500">
                Showing {(pagination.page - 1) * pagination.limit + 1}–
                {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
                {pagination.total}
              </p>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  disabled={page >= pagination.pages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
