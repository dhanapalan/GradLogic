import api from "../lib/api";

export interface DepartmentBreakdown {
  department: string;
  attempts: number;
  avg_percentage: number;
  pass_rate: number;
}

export interface RollupResult {
  scope: { college_id: string; department: string | null };
  summary: {
    total_attempts: number;
    avg_percentage: number;
    pass_rate: number;
    at_risk_count: number;
  };
  by_department: DepartmentBreakdown[];
  at_risk_students: Array<{ user_id: string; name: string; avg_percentage: number }>;
  ai_summary: string | null;
}

const campusEvaluationRollupService = {
  async get(department?: string): Promise<RollupResult> {
    const { data } = await api.get("/campus/evaluation/rollup", {
      params: department ? { department } : undefined,
    });
    return data.data;
  },
};

export default campusEvaluationRollupService;
