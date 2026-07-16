import api from "../lib/api";

export interface DashboardFilters {
  academic_year?: string;
  department?: string;
  batch?: string;
  semester?: string;
}

function toParams(filters?: DashboardFilters): Record<string, string> {
  if (!filters) return {};
  const p: Record<string, string> = {};
  if (filters.academic_year) p.academic_year = filters.academic_year;
  if (filters.department) p.department = filters.department;
  if (filters.batch) p.batch = filters.batch;
  if (filters.semester) p.semester = filters.semester;
  return p;
}

export interface CollegeSummaryVisibility {
  placement_kpis: boolean;
  academic_kpis: boolean;
  full: boolean;
}

/** Dashboard summary metrics scoped to the logged-in college. */
export interface CollegeSummary {
  role?: string;
  filters_applied?: DashboardFilters;
  visibility?: CollegeSummaryVisibility;
  total_students: number;
  active_students: number;
  placement_eligible: number;
  students_placed: number;
  active_placement_drives: number;
  companies_visiting: number;
  upcoming_interviews: number;
  pending_assessments: number;
  learning_completion_percent: number;
  avg_placement_readiness: number | null;
  // legacy
  active_drives: number;
  avg_score: number;
  avg_integrity: number;
  placed_students: number;
  placement_conversion: number;
}

export interface ChartSeries {
  label: string;
  value: number;
}

export interface CollegeCharts {
  role?: string;
  visibility: {
    department_placement: boolean;
    placement_trend: boolean;
    readiness_distribution: boolean;
    assessment_completion: boolean;
    learning_progress: boolean;
    offer_stats: boolean;
  };
  department_placement_percent: ChartSeries[];
  placement_trend: ChartSeries[];
  readiness_distribution: ChartSeries[];
  assessment_completion: ChartSeries[];
  learning_progress: ChartSeries[];
  offer_stats: ChartSeries[];
}

export interface CollegeActivities {
  role?: string;
  recently_registered_students: Array<{
    id: string;
    name: string;
    email: string;
    created_at: string;
  }>;
  latest_placement_drives: Array<{
    id: string;
    name: string;
    status: string;
    scheduled_start: string | null;
  }>;
  recent_assessment_results: Array<{
    student_name: string;
    drive_name: string;
    score: number | null;
    completed_at: string | null;
  }>;
  latest_offers: Array<{
    student_name: string;
    company: string | null;
    package: number | null;
    status: string | null;
  }>;
  recent_notifications: Array<{
    id: string;
    title: string;
    created_at: string;
  }>;
}

export interface PendingActionItem {
  id: string;
  label: string;
  count: number;
  href: string;
  visible: boolean;
}

export interface CollegePendingActions {
  role?: string;
  items: PendingActionItem[];
}

export interface CollegeFilterOptions {
  departments: string[];
  batches: string[];
  semesters: string[];
  academic_years: string[];
}

export interface CollegePerformance {
  score_distribution: { range: string; count: number }[];
  skill_heatmap: { skill: string; avg_score: number; strength: string }[];
}

export interface CollegePlacement {
  funnel: {
    appeared: number;
    passed: number;
    shortlisted: number;
    offered: number;
    joined: number;
  };
  conversion_percentage: number;
  avg_package: number;
}

export interface CollegeIntegrity {
  trend: { drive_name: string; avg_integrity: number }[];
  risk_summary: {
    high_risk_students: number;
    total_violations: number;
    terminations: number;
  };
}

export interface TopPerformer {
  rank: number;
  student: string;
  id: string;
  cgpa: number;
  avg_score: number;
  integrity: number;
}

const collegePortalMetrics = {
  async getSummary(filters?: DashboardFilters): Promise<CollegeSummary> {
    const { data } = await api.get("/college/dashboard/summary", { params: toParams(filters) });
    return data.data;
  },

  async getCharts(filters?: DashboardFilters): Promise<CollegeCharts> {
    const { data } = await api.get("/college/dashboard/charts", { params: toParams(filters) });
    return data.data;
  },

  async getActivities(filters?: DashboardFilters): Promise<CollegeActivities> {
    const { data } = await api.get("/college/dashboard/activities", { params: toParams(filters) });
    return data.data;
  },

  async getPendingActions(filters?: DashboardFilters): Promise<CollegePendingActions> {
    const { data } = await api.get("/college/dashboard/pending-actions", {
      params: toParams(filters),
    });
    return data.data;
  },

  async getFilterOptions(): Promise<CollegeFilterOptions> {
    const { data } = await api.get("/college/dashboard/filter-options");
    return data.data;
  },

  async getPerformance(): Promise<CollegePerformance> {
    const { data } = await api.get("/college/dashboard/performance");
    return data.data;
  },

  async getPlacement(): Promise<CollegePlacement> {
    const { data } = await api.get("/college/dashboard/placement");
    return data.data;
  },

  async getIntegrity(): Promise<CollegeIntegrity> {
    const { data } = await api.get("/college/dashboard/integrity");
    return data.data;
  },

  async getTopPerformers(): Promise<TopPerformer[]> {
    const { data } = await api.get("/college/dashboard/top-performers");
    return data.data;
  },

  /** Legacy parallel fetch used by AnalyticsPage (performance / placement / integrity). */
  async getDashboard(): Promise<{
    summary: CollegeSummary;
    performance: CollegePerformance;
    placement: CollegePlacement;
    integrity: CollegeIntegrity;
    topPerformers: TopPerformer[];
  }> {
    const [summary, performance, placement, integrity, topPerformers] = await Promise.all([
      this.getSummary(),
      this.getPerformance(),
      this.getPlacement(),
      this.getIntegrity(),
      this.getTopPerformers(),
    ]);
    return { summary, performance, placement, integrity, topPerformers };
  },
};

export default collegePortalMetrics;
