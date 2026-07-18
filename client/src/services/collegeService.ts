import api from "../lib/api";

export interface College {
  id: string;
  name: string;
  college_code: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  status: "active" | "pending" | "suspended";
  student_count: number;
  created_at: string;
}

export interface CollegeStudent {
  id: string;
  name: string;
  email: string;
  status: string;
  is_active: boolean;
  created_at: string;
  student_identifier: string | null;
  degree: string | null;
  specialization: string | null;
  passing_year: number | null;
  cgpa: number | null;
}

export interface CreateCollegeInput {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  tpoName: string;
  tpoEmail: string;
  studentLimit: number;
}

export interface CreateCollegeResult extends College {
  tpo_name: string;
  tpo_email: string;
  /** One-time — never retrievable again after this response. */
  temporary_password: string;
}

export interface CollegeRequest {
  id: string;
  name: string;
  email: string | null;
  city: string | null;
  created_at: string;
  status: "pending" | "approved" | "rejected";
}

class CollegeService {
  /**
   * Get all colleges with pagination and filtering
   */
  async getAllColleges(
    status?: string,
    search?: string,
    page = 1,
    limit = 50
  ): Promise<{ colleges: College[]; total: number }> {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (status) params.append("status", status);
      if (search) params.append("search", search);

      const response = await api.get(`/superadmin/colleges?${params}`);
      return response.data?.data || { colleges: [], total: 0 };
    } catch (error) {
      console.error("Failed to fetch colleges:", error);
      throw error;
    }
  }

  /**
   * Get single college details
   */
  async getCollege(id: string): Promise<College> {
    try {
      const response = await api.get(`/superadmin/colleges/${id}`);
      return response.data?.data;
    } catch (error) {
      console.error(`Failed to fetch college ${id}:`, error);
      throw error;
    }
  }

  /**
   * Create new college
   */
  async createCollege(data: CreateCollegeInput): Promise<CreateCollegeResult> {
    try {
      const response = await api.post("/superadmin/colleges", data);
      return response.data?.data;
    } catch (error) {
      console.error("Failed to create college:", error);
      throw error;
    }
  }

  /**
   * Update college
   */
  async updateCollege(id: string, data: Partial<CreateCollegeInput & { status?: string }>): Promise<College> {
    try {
      const response = await api.put(`/superadmin/colleges/${id}`, data);
      return response.data?.data;
    } catch (error) {
      console.error(`Failed to update college ${id}:`, error);
      throw error;
    }
  }

  /**
   * Get the real student roster for a college
   */
  async getCollegeStudents(
    id: string,
    search?: string,
    page = 1,
    limit = 50
  ): Promise<{ college: { id: string; name: string }; students: CollegeStudent[]; total: number }> {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (search) params.append("search", search);

      const response = await api.get(`/superadmin/colleges/${id}/students?${params}`);
      return response.data?.data || { college: { id, name: "" }, students: [], total: 0 };
    } catch (error) {
      console.error(`Failed to fetch students for college ${id}:`, error);
      throw error;
    }
  }

  /**
   * Get pending college requests
   */
  async getPendingRequests(): Promise<CollegeRequest[]> {
    try {
      const response = await api.get("/superadmin/colleges/requests");
      return response.data?.data || [];
    } catch (error) {
      console.error("Failed to fetch college requests:", error);
      throw error;
    }
  }

  /**
   * Approve college registration
   */
  async approveCollege(id: string, note?: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await api.post(`/superadmin/colleges/${id}/approve`, { note });
      return response.data;
    } catch (error) {
      console.error(`Failed to approve college ${id}:`, error);
      throw error;
    }
  }

  /**
   * Reject college registration
   */
  async rejectCollege(
    id: string,
    reason: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const response = await api.post(`/superadmin/colleges/${id}/reject`, {
        reason,
      });
      return response.data;
    } catch (error) {
      console.error(`Failed to reject college ${id}:`, error);
      throw error;
    }
  }

  /**
   * Deactivate college (status → suspended)
   */
  async deactivateCollege(id: string): Promise<College> {
    try {
      return this.updateCollege(id, { status: "suspended" } as Partial<CreateCollegeInput & { status: string }>);
    } catch (error) {
      console.error(`Failed to deactivate college ${id}:`, error);
      throw error;
    }
  }

  /** @deprecated use deactivateCollege */
  async deleteCollege(id: string) {
    return this.deactivateCollege(id);
  }

  /**
   * Reactivate college
   */
  async activateCollege(id: string): Promise<College> {
    return this.updateCollege(id, { status: "active" } as Partial<CreateCollegeInput & { status: string }>);
  }
}

export default new CollegeService();
