import api from "../lib/api";
import type { FeatureCatalogItem, PlatformFeatureKey } from "../constants/platformFeatures";
import type { EnabledLmsModule } from "../constants/lmsModules";

export interface FeatureModule {
  id: string;
  key: string;
  name: string;
  description: string | null;
  status: "active" | "draft" | "archived";
  module_type: "lms" | "platform";
  is_default: boolean;
  sort_order: number;
  icon: string | null;
  features: string[];
  assigned_colleges_count: number;
  created_at: string;
  updated_at: string;
}

export interface CollegeModuleAssignment {
  module_id: string;
  module_key: string;
  module_name: string;
  description: string | null;
  module_type: "lms" | "platform";
  is_default: boolean;
  icon: string | null;
  sort_order: number;
  features: string[];
  enabled: boolean;
  assigned_at: string;
}

export interface PortalFeaturesResponse {
  features: PlatformFeatureKey[];
  modules: EnabledLmsModule[];
}

export interface ModuleCourse {
  id: string;
  title: string;
  description: string | null;
  category: string;
  difficulty: string;
  duration_hours: number | null;
  total_modules: number;
  enrollment_count: number;
  enrollment_status: string | null;
  progress_percent: number | null;
}

export interface ModulePracticeTopic {
  topic: string;
  total_questions: number;
  easy: number;
  medium: number;
  hard: number;
  sessions_completed: number | null;
  avg_score: number | null;
}

export interface LmsModuleContent {
  module: EnabledLmsModule & { question_categories: string[] };
  courses: ModuleCourse[];
  practice_topics: ModulePracticeTopic[];
  student: {
    enrolled_courses: number;
    completed_courses: number;
    lessons_completed: number;
    practice_sessions: number;
    avg_practice_score: number | null;
  } | null;
}

export interface CreateModuleInput {
  name: string;
  description?: string;
  status?: "active" | "draft" | "archived";
  features: string[];
  key?: string;
  module_type?: "lms" | "platform";
  is_default?: boolean;
  sort_order?: number;
  icon?: string;
}

const platformModulesService = {
  async list(status?: string): Promise<FeatureModule[]> {
    const { data } = await api.get("/superadmin/modules", {
      params: status ? { status } : undefined,
    });
    return data.data ?? [];
  },

  async getCatalog(): Promise<FeatureCatalogItem[]> {
    const { data } = await api.get("/superadmin/modules/catalog");
    return data.data ?? [];
  },

  async get(id: string): Promise<FeatureModule> {
    const { data } = await api.get(`/superadmin/modules/${id}`);
    return data.data;
  },

  async create(input: CreateModuleInput): Promise<FeatureModule> {
    const { data } = await api.post("/superadmin/modules", input);
    return data.data;
  },

  async update(id: string, input: Partial<CreateModuleInput>): Promise<FeatureModule> {
    const { data } = await api.put(`/superadmin/modules/${id}`, input);
    return data.data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/superadmin/modules/${id}`);
  },

  async getCollegeModules(collegeId: string): Promise<CollegeModuleAssignment[]> {
    const { data } = await api.get(`/superadmin/colleges/${collegeId}/modules`);
    return data.data ?? [];
  },

  async setCollegeModules(
    collegeId: string,
    assignments: { module_id: string; enabled: boolean }[]
  ): Promise<CollegeModuleAssignment[]> {
    const { data } = await api.put(`/superadmin/colleges/${collegeId}/modules`, { assignments });
    return data.data ?? [];
  },

  async applyCollegeDefaults(collegeId: string): Promise<CollegeModuleAssignment[]> {
    const { data } = await api.post(`/superadmin/colleges/${collegeId}/modules/defaults`);
    return data.data ?? [];
  },

  async getCollegePortalFeatures(): Promise<PortalFeaturesResponse> {
    const { data } = await api.get("/college/modules/enabled");
    return {
      features: data.data?.features ?? [],
      modules: data.data?.modules ?? [],
    };
  },

  async getStudentPortalFeatures(): Promise<PortalFeaturesResponse> {
    const { data } = await api.get("/students/portal-features");
    return {
      features: data.data?.features ?? [],
      modules: data.data?.modules ?? [],
    };
  },

  async getLmsModuleContent(moduleKey: string): Promise<LmsModuleContent> {
    const { data } = await api.get(`/lms/module-groups/${moduleKey}/content`);
    return data.data;
  },
};

export default platformModulesService;
