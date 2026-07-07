import api from "../lib/api";

/** Dashboard summary metrics scoped to the logged-in college. */
export interface CollegeSummary {
  total_students: number;
  active_students: number;
  active_drives: number;
  avg_score: number;
  avg_integrity: number;
  placed_students: number;
  placement_conversion: number;
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

export interface CollegeDashboardBundle {
  summary: CollegeSummary;
  performance: CollegePerformance;
  placement: CollegePlacement;
  integrity: CollegeIntegrity;
  topPerformers: TopPerformer[];
}

const collegePortalMetrics = {
  async getSummary(): Promise<CollegeSummary> {
    const { data } = await api.get("/college/dashboard/summary");
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

  /** Single parallel fetch for the dashboard page. */
  async getDashboard(): Promise<CollegeDashboardBundle> {
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
