import api from "../lib/api";

export type PlacementStatus =
  | "Not Shortlisted"
  | "Shortlisted"
  | "Interviewed"
  | "Offered"
  | "Joined";

export type RiskLevel = "Low" | "Medium" | "High";

export interface CampusStudent {
  user_id: string;
  name: string;
  email: string;
  is_active: boolean;
  student_id: string;
  roll_number: string;
  passing_year: number;
  department: string;
  degree: string;
  cgpa: number;
  avatar?: string;
  avg_score: number;
  avg_integrity: number;
  placement_status: PlacementStatus;
  risk_level: RiskLevel;
}

export interface StudentAnalytics {
  totalStudents: number;
  activeStudents: number;
  avgScore: number;
  avgIntegrity: number;
  appearedInLatestDrive: number;
  placedPipelineCount: number;
  highRiskCount: number;
}

export interface StudentListParams {
  page?: number;
  limit?: number;
  search?: string;
  year?: string;
  department?: string;
  placementStatus?: string;
  riskLevel?: string;
  status?: string;
  performance?: string;
}

export interface Pagination {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export type BulkActionType = "suspend" | "update_placement" | "assign_workflow";

const campusStudentsService = {
  async list(params: StudentListParams = {}) {
    const { data } = await api.get("/campus/students", { params });
    return data as { data: CampusStudent[]; pagination: Pagination };
  },

  async getAnalytics(): Promise<StudentAnalytics> {
    const { data } = await api.get("/campus/students/analytics");
    return data.data;
  },

  async bulkAction(
    action: BulkActionType,
    studentIds: string[],
    payload?: Record<string, unknown>
  ) {
    const { data } = await api.post("/campus/students/bulk-action", {
      action,
      studentIds,
      payload,
    });
    return data;
  },
};

export default campusStudentsService;
