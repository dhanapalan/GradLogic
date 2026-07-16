/**
 * Course Builder — assembles Knowledge Library assets into LMS courses.
 * Dashboard via /api/course-builder; CRUD via existing /api/lms.
 */
import api from "../lib/api";
import lmsCourseService, {
  type Course,
  type CourseDetail,
  type CourseModule,
  type CourseStatus,
} from "./lmsCourseService";
import questionBankService from "./questionBankService";
import superadminFeaturesService from "./superadminFeaturesService";

export const PHASE1_DOMAINS = [
  { value: "aptitude", label: "Aptitude" },
  { value: "reasoning", label: "Logical Reasoning" },
  { value: "python_coding", label: "Python" },
  { value: "java_coding", label: "Java" },
  { value: "data_science", label: "AI Fundamentals" },
] as const;

export type Phase1Domain = (typeof PHASE1_DOMAINS)[number]["value"];

export interface CourseBuilderDashboard {
  total: number;
  draft: number;
  published: number;
  archived: number;
  studentsEnrolled: number;
  completionPercent: number | null;
  averageRating: number | null;
  byDomain: { domain: string; count: number }[];
}

export interface ModuleAsset {
  id: string;
  module_id: string;
  asset_type: string;
  asset_id: string;
  role: string;
  sort_order: number;
  meta: Record<string, unknown>;
  module_title?: string;
  asset_title?: string | null;
}

export type PickerTab =
  | "questions"
  | "coding"
  | "flashcards"
  | "content"
  | "voice";

export interface KnowledgeSearchHit {
  id: string;
  asset_type: "question" | "coding_challenge" | "flashcard" | "content" | "voice_lesson";
  title: string;
  subtitle?: string;
  default_role: "lesson" | "practice" | "coding" | "assessment" | "resource" | "voice";
}

export const ASSET_ROLES = [
  { value: "lesson", label: "Lesson" },
  { value: "practice", label: "Practice" },
  { value: "coding", label: "Coding" },
  { value: "assessment", label: "Assessment" },
  { value: "resource", label: "Resource" },
  { value: "voice", label: "Voice" },
] as const;

export interface AssessmentConfig {
  passing_percent: number;
  attempts: number;
  min_practice_per_module: number;
  require_assessment: boolean;
}

export interface ValidationIssue {
  code: string;
  severity: "error" | "warning";
  message: string;
  module_id?: string;
  module_title?: string;
}

export interface CourseValidationResult {
  ok: boolean;
  config: AssessmentConfig;
  issues: ValidationIssue[];
  stats: {
    modules: number;
    practice: number;
    coding: number;
    assessment: number;
    lesson: number;
  };
}

export const DEFAULT_ASSESSMENT_CONFIG: AssessmentConfig = {
  passing_percent: 60,
  attempts: 3,
  min_practice_per_module: 3,
  require_assessment: true,
};

export interface AiSuggestedAsset {
  asset_type: string;
  asset_id: string;
  role: string;
  title: string;
  selected: boolean;
}

export interface AiModuleOutline {
  title: string;
  description?: string;
  objectives?: string[];
  suggested_assets: AiSuggestedAsset[];
}

export interface AiCourseOutline {
  title: string;
  description?: string;
  category: string;
  subject?: string;
  difficulty: string;
  estimated_hours?: number;
  learning_objectives?: string[];
  passing_percent?: number;
  attempts?: number;
  modules: AiModuleOutline[];
  source?: "ai" | "template";
}

export interface Phase1Template {
  id: string;
  category: string;
  title: string;
  description: string;
  difficulty: string;
  module_titles: string[];
  estimated_hours: number;
}

export interface CourseBuilderAnalytics {
  dashboard: CourseBuilderDashboard;
  assetMappings: number;
  avgModulesPerCourse: number | null;
  aiOutlineCourses: number;
  templateCourses: number;
  enrollmentsByDomain: { domain: string; enrollments: number }[];
  draftReadyEstimate: number;
  draftBlockedEstimate: number;
  topCourses: {
    id: string;
    title: string;
    status: string;
    category: string;
    enrollments: number;
    modules: number;
    assets: number;
  }[];
}

export const COURSE_BUILDER_BASE = "/app/superadmin/course-builder";

const courseBuilderService = {
  async getDashboard(): Promise<CourseBuilderDashboard> {
    const res = await api.get("/course-builder/dashboard");
    return res.data?.data;
  },

  listCourses(params?: { status?: string; search?: string; category?: string }) {
    return lmsCourseService.listCourses(params);
  },

  getCourse(id: string) {
    return lmsCourseService.getCourse(id);
  },

  async createCourse(input: {
    title: string;
    description?: string;
    category: string;
    subject?: string;
    difficulty?: string;
    duration_hours?: number;
    estimated_minutes?: number;
    language?: string;
    thumbnail_url?: string;
    tags?: string[];
  }): Promise<Course> {
    const res = await api.post("/lms/courses", input);
    return res.data?.data;
  },

  updateCourse(
    id: string,
    input: Partial<{
      title: string;
      description: string;
      category: string;
      subject: string;
      difficulty: string;
      status: CourseStatus;
      language: string;
      thumbnail_url: string;
      duration_hours: number;
      estimated_minutes: number;
      tags: string[];
    }>
  ) {
    return lmsCourseService.updateCourse(id, input as Parameters<typeof lmsCourseService.updateCourse>[1]);
  },

  createModule(courseId: string, input: { title: string; description?: string; sort_order?: number }) {
    return lmsCourseService.createModule(courseId, input);
  },

  updateModule(id: string, input: Partial<{ title: string; description: string; sort_order: number }>) {
    return lmsCourseService.updateModule(id, input);
  },

  deleteModule(id: string) {
    return lmsCourseService.deleteModule(id);
  },

  async listModuleAssets(moduleId: string): Promise<ModuleAsset[]> {
    const res = await api.get(`/course-builder/modules/${moduleId}/assets`);
    return res.data?.data || [];
  },

  async listCourseAssets(courseId: string): Promise<ModuleAsset[]> {
    const res = await api.get(`/course-builder/courses/${courseId}/assets`);
    return res.data?.data || [];
  },

  async attachAsset(
    moduleId: string,
    input: {
      asset_type: string;
      asset_id: string;
      role: string;
      sort_order?: number;
      meta?: Record<string, unknown>;
    }
  ): Promise<ModuleAsset> {
    const res = await api.post(`/course-builder/modules/${moduleId}/assets`, input);
    return res.data?.data;
  },

  async detachAsset(id: string): Promise<void> {
    await api.delete(`/course-builder/assets/${id}`);
  },

  async updateAssetMeta(id: string, meta: Record<string, unknown>): Promise<ModuleAsset> {
    const res = await api.patch(`/course-builder/assets/${id}/meta`, { meta });
    return res.data?.data;
  },

  async getAssessmentConfig(courseId: string): Promise<AssessmentConfig> {
    const res = await api.get(`/course-builder/courses/${courseId}/assessment-config`);
    return res.data?.data || { ...DEFAULT_ASSESSMENT_CONFIG };
  },

  async updateAssessmentConfig(
    courseId: string,
    patch: Partial<AssessmentConfig>
  ): Promise<AssessmentConfig> {
    const res = await api.put(`/course-builder/courses/${courseId}/assessment-config`, patch);
    return res.data?.data;
  },

  async validateCourse(courseId: string): Promise<CourseValidationResult> {
    const res = await api.get(`/course-builder/courses/${courseId}/validate`);
    return res.data?.data;
  },

  async publishCourse(courseId: string): Promise<{
    course: Course;
    validation: CourseValidationResult;
  }> {
    const res = await api.post(`/course-builder/courses/${courseId}/publish`);
    return res.data?.data;
  },

  async generateAiOutline(input: {
    prompt: string;
    category?: string;
    difficulty?: string;
  }): Promise<AiCourseOutline> {
    const res = await api.post("/course-builder/ai/outline", input);
    return res.data?.data;
  },

  async commitAiOutline(outline: AiCourseOutline): Promise<{
    courseId: string;
    modulesCreated: number;
    assetsAttached: number;
  }> {
    const res = await api.post("/course-builder/ai/commit", { outline });
    return res.data?.data;
  },

  async listTemplates(): Promise<Phase1Template[]> {
    const res = await api.get("/course-builder/templates");
    return res.data?.data || [];
  },

  async createFromTemplate(
    templateId: string,
    input?: { title?: string; difficulty?: string }
  ): Promise<{ courseId: string; modulesCreated: number; assetsAttached: number }> {
    const res = await api.post(`/course-builder/templates/${templateId}/create`, input || {});
    return res.data?.data;
  },

  async getAnalytics(): Promise<CourseBuilderAnalytics> {
    const res = await api.get("/course-builder/analytics");
    return res.data?.data;
  },

  /** Search Knowledge Library for attachable assets (no content creation). */
  async searchKnowledge(
    tab: PickerTab,
    opts?: { search?: string; category?: string; limit?: number }
  ): Promise<KnowledgeSearchHit[]> {
    const search = opts?.search?.trim() || undefined;
    const category = opts?.category || undefined;
    const limit = opts?.limit ?? 30;

    if (tab === "questions") {
      const { questions } = await questionBankService.searchQuestions({
        search,
        category,
        limit,
        status: "published",
      });
      return questions
        .filter((q) => q.type !== "coding_challenge")
        .map((q) => ({
          id: q.id,
          asset_type: "question" as const,
          title: q.question_text?.slice(0, 140) || "Question",
          subtitle: `${q.category} · ${q.difficulty_level} · ${q.type}`,
          default_role: "practice" as const,
        }));
    }

    if (tab === "coding") {
      const { questions } = await questionBankService.searchQuestions({
        search,
        category,
        type: "coding_challenge",
        limit,
        status: "published",
      });
      return questions.map((q) => ({
        id: q.id,
        asset_type: "coding_challenge" as const,
        title: q.question_text?.slice(0, 140) || "Coding challenge",
        subtitle: `${q.category} · ${q.difficulty_level}`,
        default_role: "coding" as const,
      }));
    }

    if (tab === "flashcards") {
      const cards = await superadminFeaturesService.listFlashcards({
        search,
        category,
      });
      return cards.slice(0, limit).map((f) => ({
        id: f.id,
        asset_type: "flashcard" as const,
        title: f.front?.slice(0, 140) || "Flashcard",
        subtitle: `${f.category} · ${f.difficulty}`,
        default_role: "practice" as const,
      }));
    }

    if (tab === "content") {
      const items = await superadminFeaturesService.listContentLibrary({
        search,
        status: "published",
      });
      return items.slice(0, limit).map((c) => ({
        id: c.id,
        asset_type: "content" as const,
        title: c.title,
        subtitle: `${c.content_type} · ${c.category || "—"}`,
        default_role: c.content_type === "learning_resource" ? ("lesson" as const) : ("resource" as const),
      }));
    }

    // voice — only lessons already in a course (read-only refs); filter by voice heuristic later in UI if needed
    const lessons = await superadminFeaturesService.listLessons({ voice: true, search });
    return lessons.slice(0, limit).map((l) => ({
      id: l.id,
      asset_type: "voice_lesson" as const,
      title: l.title,
      subtitle: `${l.course_title} · ${l.module_title}`,
      default_role: "voice" as const,
    }));
  },
};

export type { Course, CourseDetail, CourseModule, CourseStatus };
export default courseBuilderService;
