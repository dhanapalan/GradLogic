import api from "../lib/api";

export interface PlatformAnalytics {
  summary: {
    total_users: string;
    active_users: string;
    student_count: string;
    admin_count: string;
    total_colleges: string;
    total_questions: string;
    total_attempts: string;
    avg_score: string;
    total_workflows: string;
    total_roles: string;
    total_audit_logs: string;
  };
  users_growth: { date: string; new_users: string }[];
  attempts_trend: { date: string; attempts: string }[];
  questions_by_category: { category: string; count: string }[];
}

export interface CollegeAnalytics {
  id: string;
  name: string;
  status: string;
  student_count: string;
  attempts: string;
  avg_score: string;
  paid_students: string;
  collected: string;
}

export interface StudentPerformance {
  id: string;
  name: string;
  email: string;
  college_name: string | null;
  exams_taken: string;
  avg_score: string;
  last_exam_at: string | null;
}

export interface AIUsage {
  totals: {
    ai_questions_total: string;
    ai_questions_30d: string;
    import_batches_30d: string;
  };
  per_college: Array<{
    id: string;
    name: string;
    ai_questions_assigned: string;
    questions_assigned: string;
    student_count: string;
  }>;
  recent_imports: Array<{
    created_at: string;
    changes: { imported?: number; total?: number; college_count?: number } | null;
    actor: string | null;
  }>;
}

export interface BillingSummary {
  academic_year: string;
  fee_per_student: number;
  total_students: number;
  paid: number;
  pending: number;
  collected: number;
  expected: number;
  by_college: {
    id: string;
    name: string;
    students: string;
    paid: string;
    collected: string;
  }[];
  recent_payments: {
    id: string;
    amount: string;
    status: string;
    payment_method: string | null;
    paid_at: string | null;
    student_name: string | null;
    college_name: string | null;
  }[];
}

class AnalyticsService {
  async getPlatform(days = 30, collegeId?: string): Promise<PlatformAnalytics> {
    const params = new URLSearchParams({ days: String(days) });
    if (collegeId) params.append("college_id", collegeId);
    const response = await api.get(`/superadmin/analytics/platform?${params}`);
    return response.data?.data;
  }

  async getColleges(): Promise<CollegeAnalytics[]> {
    const response = await api.get("/superadmin/analytics/colleges");
    return response.data?.data || [];
  }

  async getStudentPerformance(collegeId?: string): Promise<StudentPerformance[]> {
    const qs = collegeId ? `?college_id=${encodeURIComponent(collegeId)}` : "";
    const response = await api.get(`/superadmin/analytics/students${qs}`);
    return response.data?.data || [];
  }

  async getAIUsage(): Promise<AIUsage> {
    const response = await api.get("/superadmin/ai-usage");
    return response.data?.data;
  }

  async getBillingSummary(year?: string): Promise<BillingSummary> {
    const qs = year ? `?year=${encodeURIComponent(year)}` : "";
    const response = await api.get(`/superadmin/billing/summary${qs}`);
    return response.data?.data;
  }
}

export default new AnalyticsService();
