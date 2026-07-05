import api from "../lib/api";

export interface User {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  role: string;
  status: "active" | "inactive" | "suspended" | "deleted";
  avatar_url?: string;
  college_id?: string;
  college_name?: string;
  created_at: string;
  updated_at: string;
  last_login?: string;
}

export interface UserFilters {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  status?: string;
  college_id?: string;
  from_date?: string;
  to_date?: string;
}

export interface UsersResponse {
  success: boolean;
  data: User[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

class UserService {
  /**
   * List all users with filters
   */
  async listUsers(filters: UserFilters = {}): Promise<UsersResponse> {
    try {
      const params = new URLSearchParams();
      if (filters.page) params.append("page", String(filters.page));
      if (filters.limit) params.append("limit", String(filters.limit));
      if (filters.search) params.append("search", filters.search);
      if (filters.role && filters.role !== "all") params.append("role", filters.role);
      if (filters.status && filters.status !== "all") params.append("status", filters.status);
      if (filters.college_id && filters.college_id !== "all") params.append("college_id", filters.college_id);
      if (filters.from_date) params.append("from_date", filters.from_date);
      if (filters.to_date) params.append("to_date", filters.to_date);

      const response = await api.get(
        `/superadmin/users?${params.toString()}`
      );
      return response.data;
    } catch (error) {
      console.error("Failed to list users:", error);
      throw error;
    }
  }

  /**
   * Search users with autocomplete
   */
  async searchUsers(query: string, limit: number = 20): Promise<User[]> {
    try {
      const response = await api.get(
        `/superadmin/users/search?q=${encodeURIComponent(query)}&limit=${limit}`
      );
      return response.data?.data || [];
    } catch (error) {
      console.error("Failed to search users:", error);
      throw error;
    }
  }

  /**
   * Get single user details
   */
  async getUser(userId: string): Promise<User> {
    try {
      const response = await api.get(`/superadmin/users/${userId}`);
      return response.data?.data;
    } catch (error) {
      console.error(`Failed to get user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Update user
   */
  async updateUser(
    userId: string,
    data: { full_name?: string; email?: string; phone?: string; status?: string }
  ): Promise<User> {
    try {
      const response = await api.put(`/superadmin/users/${userId}`, data);
      return response.data?.data;
    } catch (error) {
      console.error(`Failed to update user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Deactivate user (sets is_active=false)
   */
  async deactivateUser(userId: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await api.delete(`/superadmin/users/${userId}`);
      return response.data;
    } catch (error) {
      console.error(`Failed to deactivate user ${userId}:`, error);
      throw error;
    }
  }

  /** @deprecated use deactivateUser */
  async deleteUser(userId: string) {
    return this.deactivateUser(userId);
  }

  /**
   * Activate user
   */
  async activateUser(userId: string): Promise<{ success: boolean; message: string; data?: User }> {
    try {
      const response = await api.post(`/superadmin/users/${userId}/activate`);
      return response.data;
    } catch (error) {
      console.error(`Failed to activate user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Create / invite user
   */
  async createUser(data: {
    full_name: string;
    email: string;
    password: string;
    role: string;
    phone?: string;
    college_id?: string;
  }): Promise<User> {
    try {
      const response = await api.post("/superadmin/users", data);
      return response.data?.data;
    } catch (error) {
      console.error("Failed to create user:", error);
      throw error;
    }
  }

  /**
   * Suspend user
   */
  async suspendUser(userId: string, reason?: string): Promise<User> {
    try {
      const response = await api.post(`/superadmin/users/${userId}/suspend`, {
        reason,
      });
      return response.data?.data;
    } catch (error) {
      console.error(`Failed to suspend user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Unsuspend user
   */
  async unsuspendUser(userId: string): Promise<User> {
    try {
      const response = await api.post(`/superadmin/users/${userId}/unsuspend`);
      return response.data?.data;
    } catch (error) {
      console.error(`Failed to unsuspend user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Bulk user action (suspend, delete, activate)
   */
  async bulkUserAction(
    userIds: string[],
    action: "suspend" | "delete" | "deactivate" | "activate",
    reason?: string
  ): Promise<{ success: boolean; message: string; affected_rows: number }> {
    try {
      const response = await api.post(`/superadmin/users/bulk-action`, {
        user_ids: userIds,
        action,
        reason,
      });
      return response.data;
    } catch (error) {
      console.error("Failed to perform bulk action:", error);
      throw error;
    }
  }
}

export default new UserService();
