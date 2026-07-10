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

export interface StudentAssessment {
  drive_id: string;
  title: string;
  score: number;
  created_at: string;
}

export interface StudentViolation {
  id: string;
  violation_type: string;
  risk_score: number;
  timestamp: string;
}

export interface StudentProfileResponse {
  overview: CampusStudent & {
    phone_number: string | null;
    degree: string | null;
    specialization: string | null;
    passing_year: number | null;
    cgpa: number | null;
  };
  assessments: StudentAssessment[];
  violations: StudentViolation[];
}

export interface UpdateStudentPayload {
  is_active?: boolean;
  placement_status?: PlacementStatus;
  risk_level?: RiskLevel;
  phone_number?: string;
  degree?: string;
  specialization?: string;
  passing_year?: number;
  cgpa?: number;
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

  async get(id: string): Promise<StudentProfileResponse> {
    const { data } = await api.get(`/campus/students/${id}`);
    return data.data;
  },

  async update(id: string, payload: UpdateStudentPayload) {
    const { data } = await api.put(`/campus/students/${id}`, payload);
    return data;
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
