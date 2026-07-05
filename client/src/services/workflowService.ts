import api from "../lib/api";

// Learning-pipeline stages (learn/practice/exam/certify) plus automation step
// types; the backend stores type as a plain varchar so unknown values render too.
export type WorkflowStepType =
  | "learn"
  | "practice"
  | "exam"
  | "certify"
  | "assessment"
  | "email"
  | "notification"
  | "approval"
  | "delay"
  | (string & {});

export interface WorkflowStep {
  id?: string;
  name: string;
  type: WorkflowStepType;
  config: Record<string, any>;
  order?: number;
}

export interface WorkflowCondition {
  field: string;
  operator: "equals" | "contains" | "greater_than" | "less_than";
  value: string;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
  trigger_event: string;
  category?: string | null;
  steps?: WorkflowStep[];
  conditions?: WorkflowCondition[];
  created_by?: string;
  created_at: string;
  updated_at: string;
  step_count?: number;
}

export interface WorkflowFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: "all" | "active" | "inactive";
  category?: string;
}

export interface WorkflowsResponse {
  success: boolean;
  data: Workflow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

class WorkflowService {
  async listWorkflows(filters: WorkflowFilters = {}): Promise<WorkflowsResponse> {
    try {
      const params = new URLSearchParams();
      if (filters.page) params.append("page", String(filters.page));
      if (filters.limit) params.append("limit", String(filters.limit));
      if (filters.search) params.append("search", filters.search);
      if (filters.status && filters.status !== "all") params.append("status", filters.status);
      if (filters.category) params.append("category", filters.category);

      const response = await api.get(`/superadmin/workflows?${params.toString()}`);
      return response.data;
    } catch (error) {
      console.error("Failed to list workflows:", error);
      throw error;
    }
  }

  async getWorkflow(workflowId: string): Promise<Workflow> {
    try {
      const response = await api.get(`/superadmin/workflows/${workflowId}`);
      return response.data?.data;
    } catch (error) {
      console.error(`Failed to get workflow ${workflowId}:`, error);
      throw error;
    }
  }

  async createWorkflow(data: {
    name: string;
    description?: string;
    trigger_event: string;
    category?: string;
    steps?: WorkflowStep[];
    conditions?: WorkflowCondition[];
  }): Promise<{ id: string }> {
    try {
      const response = await api.post("/superadmin/workflows", data);
      return response.data?.data;
    } catch (error) {
      console.error("Failed to create workflow:", error);
      throw error;
    }
  }

  async updateWorkflow(
    workflowId: string,
    data: {
      name?: string;
      description?: string;
      trigger_event?: string;
      is_active?: boolean;
      category?: string;
    }
  ): Promise<{ success: boolean; message: string }> {
    try {
      const response = await api.put(`/superadmin/workflows/${workflowId}`, data);
      return response.data;
    } catch (error) {
      console.error(`Failed to update workflow ${workflowId}:`, error);
      throw error;
    }
  }

  async deleteWorkflow(workflowId: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await api.delete(`/superadmin/workflows/${workflowId}`);
      return response.data;
    } catch (error) {
      console.error(`Failed to delete workflow ${workflowId}:`, error);
      throw error;
    }
  }

  async updateWorkflowSteps(
    workflowId: string,
    steps: WorkflowStep[]
  ): Promise<{ success: boolean; message: string; step_count: number }> {
    try {
      const response = await api.put(`/superadmin/workflows/${workflowId}/steps`, {
        steps,
      });
      return response.data;
    } catch (error) {
      console.error(`Failed to update workflow steps for ${workflowId}:`, error);
      throw error;
    }
  }
}

export default new WorkflowService();
