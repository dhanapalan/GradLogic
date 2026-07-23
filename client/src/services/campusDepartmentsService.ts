import api from "../lib/api";

export interface Department {
  id: string;
  college_id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const campusDepartmentsService = {
  async list(includeInactive = false): Promise<Department[]> {
    const { data } = await api.get("/campus/departments", {
      params: includeInactive ? { includeInactive: "true" } : undefined,
    });
    return data.data;
  },

  async create(name: string): Promise<Department> {
    const { data } = await api.post("/campus/departments", { name });
    return data.data;
  },

  async update(id: string, updates: { name?: string; is_active?: boolean }): Promise<Department> {
    const { data } = await api.put(`/campus/departments/${id}`, updates);
    return data.data;
  },
};

export default campusDepartmentsService;
