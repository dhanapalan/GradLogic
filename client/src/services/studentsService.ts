import api from "../lib/api";

export interface StudentListItem {
  id: string;
  name: string;
  email: string;
  status: string;
  is_active: boolean;
  created_at: string;
  last_login: string | null;
  college_id: string | null;
  college_name: string | null;
  student_identifier: string | null;
  degree: string | null;
  department: string | null;
  batch: number | null;
  readiness_score: number;
}

export interface StudentFilters {
  search?: string;
  college_id?: string;
  batch?: string;
  department?: string;
  performance?: "high" | "medium" | "low";
  status?: string;
  page?: number;
  limit?: number;
}

export interface StudentProfile {
  id: string;
  name: string;
  email: string;
  status: string;
  is_active: boolean;
  created_at: string;
  last_login: string | null;
  college_id: string | null;
  college_name: string | null;
  student_detail_id: string | null;
  student_identifier: string | null;
  degree: string | null;
  specialization: string | null;
  passing_year: number | null;
  cgpa: number | null;
  percentage: number | null;
  linkedin_url: string | null;
  github_url: string | null;
  resume_url: string | null;
}

export interface ExamResult {
  id: string;
  title: string;
  final_score: number;
  created_at: string;
}

export interface StudentCertification {
  id: string;
  title: string;
  issued_at: string;
}

export interface ModuleProgress {
  id: string;
  module_title: string;
  status: string;
  score: number | null;
  completed_at: string | null;
}

export interface StudentDetail {
  profile: StudentProfile;
  examResults: ExamResult[];
  certifications: StudentCertification[];
  moduleProgress: ModuleProgress[];
}

class StudentsService {
  async listStudents(
    filters: StudentFilters = {}
  ): Promise<{ students: StudentListItem[]; total: number }> {
    try {
      const params = new URLSearchParams();
      params.append("page", String(filters.page || 1));
      params.append("limit", String(filters.limit || 50));
      if (filters.search) params.append("search", filters.search);
      if (filters.college_id) params.append("college_id", filters.college_id);
      if (filters.batch) params.append("batch", filters.batch);
      if (filters.department) params.append("department", filters.department);
      if (filters.performance) params.append("performance", filters.performance);
      if (filters.status && filters.status !== "all") params.append("status", filters.status);

      const response = await api.get(`/superadmin/students?${params}`);
      return response.data?.data || { students: [], total: 0 };
    } catch (error) {
      console.error("Failed to fetch students:", error);
      throw error;
    }
  }

  async getStudentProfile(id: string): Promise<StudentDetail> {
    try {
      const response = await api.get(`/superadmin/students/${id}`);
      return response.data?.data;
    } catch (error) {
      console.error(`Failed to fetch student ${id}:`, error);
      throw error;
    }
  }

  async sendNotification(
    studentIds: string[],
    title: string,
    message: string
  ): Promise<{ success: boolean; message: string }> {
    const response = await api.post("/superadmin/students/bulk-action", {
      action: "notify",
      studentIds,
      payload: { title, message },
    });
    return response.data;
  }

  async resetPasswords(studentIds: string[]): Promise<{ success: boolean; message: string }> {
    const response = await api.post("/superadmin/students/bulk-action", {
      action: "reset_password",
      studentIds,
    });
    return response.data;
  }

  async deactivateStudents(studentIds: string[]): Promise<{ success: boolean; message: string }> {
    const response = await api.post("/superadmin/students/bulk-action", {
      action: "deactivate",
      studentIds,
    });
    return response.data;
  }

  async activateStudents(studentIds: string[]): Promise<{ success: boolean; message: string }> {
    const response = await api.post("/superadmin/students/bulk-action", {
      action: "activate",
      studentIds,
    });
    return response.data;
  }

  async createStudent(data: {
    name: string;
    email: string;
    college_id: string;
    password?: string;
    student_identifier?: string;
    phone_number?: string;
    degree?: string;
    specialization?: string;
    passing_year?: number;
    cgpa?: number;
  }) {
    const response = await api.post("/superadmin/students", data);
    return response.data;
  }

  async bulkImport(data: {
    college_id: string;
    students: Array<{
      name: string;
      email: string;
      student_identifier?: string;
      phone_number?: string;
      degree?: string;
      specialization?: string;
      passing_year?: number;
      cgpa?: number;
    }>;
  }) {
    const response = await api.post("/superadmin/students/bulk-import", data);
    return response.data;
  }

  async updateStudent(id: string, data: Partial<StudentProfile> & Record<string, unknown>) {
    const response = await api.put(`/superadmin/students/${id}`, data);
    return response.data;
  }

  async softDeleteStudent(id: string) {
    const response = await api.delete(`/superadmin/students/${id}`);
    return response.data;
  }
}

export default new StudentsService();
