/**
 * Course Catalog — browse/publish surface. Reuses LMS + thin catalog APIs.
 * Does not assemble Knowledge Library assets (Course Builder does that).
 */
import api from "../lib/api";
import lmsCourseService, { type Course, type CourseStatus } from "./lmsCourseService";

export const COURSE_CATALOG_BASE = "/app/superadmin/course-catalog";

export const PHASE1_CATALOG_DOMAINS = [
  { value: "aptitude", label: "Aptitude" },
  { value: "reasoning", label: "Logical Reasoning" },
  { value: "python_coding", label: "Python" },
  { value: "java_coding", label: "Java" },
  { value: "data_science", label: "AI Fundamentals" },
] as const;

export interface CatalogDashboard {
  total: number;
  published: number;
  draft: number;
  archived: number;
  placementTracks: number;
  studentsEnrolled: number;
  averageCompletion: number | null;
  averageRating: number | null;
  featured: Array<{
    id: string;
    title: string;
    category: string;
    difficulty: string;
    status: string;
    total_modules: number;
    enrollments: number;
    updated_at: string;
  }>;
  recentlyPublished: Array<{
    id: string;
    title: string;
    category: string;
    difficulty: string;
    status: string;
    published_at: string;
  }>;
}

export interface PlacementTrackSummary {
  slug: string;
  title: string;
  short_title: string;
  description: string;
  categories: string[];
  domain_label: string;
  estimated_weeks: number;
  published_courses: number;
  draft_courses: number;
  enrollments: number;
  total_modules: number;
}

export interface CatalogCourse {
  id: string;
  title: string;
  description: string | null;
  category: string;
  difficulty: string;
  status: CourseStatus;
  duration_hours: number | null;
  total_modules: number;
  thumbnail_url: string | null;
  language?: string | null;
  subject?: string | null;
  tags?: string[];
  updated_at: string;
  created_at?: string;
  instructor_name: string | null;
  enrollments: number;
  practice_items: number;
  coding_items: number;
  assessment_items: number;
  module_count: number;
}

export interface CatalogPreviewAsset {
  id: string;
  module_id: string;
  role: string;
  asset_type: string;
  asset_id: string;
  asset_title: string | null;
  sort_order: number;
  meta: Record<string, unknown>;
}

export interface CatalogPreviewModule {
  id: string;
  title: string;
  description: string | null;
  sort_order: number;
  lesson_count: number;
  assets: CatalogPreviewAsset[];
  by_role: Record<string, CatalogPreviewAsset[]>;
}

export interface CatalogAssignment {
  college_id: string;
  college_name: string;
  assigned_at: string;
  notes?: string | null;
  meta?: Record<string, unknown>;
  batch_id?: string | null;
  batch_name?: string | null;
}

export interface CatalogCoursePreview {
  id: string;
  title: string;
  description: string | null;
  category: string;
  difficulty: string;
  status: CourseStatus;
  duration_hours: number | null;
  total_modules: number;
  thumbnail_url: string | null;
  language: string | null;
  subject: string | null;
  tags: string[];
  updated_at: string;
  created_at: string;
  instructor_name: string | null;
  enrollments: number;
  modules: CatalogPreviewModule[];
  role_counts: Record<string, number>;
  assessment_config: {
    passing_percent: number;
    attempts: number;
    min_practice_per_module: number;
    require_assessment: boolean;
  };
  colleges: CatalogAssignment[];
  totals: {
    modules: number;
    assets: number;
    lessons: number;
    practice: number;
    coding: number;
    assessment: number;
    voice: number;
  };
}

export interface CatalogAiInsights {
  summary: string;
  recommendations: string[];
  difficulty_analysis: string;
  estimated_hours: number | null;
  missing_topics: string[];
  suggested_practice: string[];
  placement_readiness_score: number | null;
  skills: string[];
  source: "ai" | "template";
}

const courseCatalogService = {
  async getDashboard(): Promise<CatalogDashboard> {
    const res = await api.get("/course-catalog/dashboard");
    return res.data?.data;
  },

  async listTracks(): Promise<PlacementTrackSummary[]> {
    const res = await api.get("/course-catalog/tracks");
    return res.data?.data || [];
  },

  async getTrack(slug: string) {
    const res = await api.get(`/course-catalog/tracks/${slug}`);
    return res.data?.data;
  },

  async listCourses(params?: {
    status?: string;
    category?: string;
    search?: string;
    difficulty?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ courses: CatalogCourse[]; total: number }> {
    const res = await api.get("/course-catalog/courses", { params });
    return res.data?.data || { courses: [], total: 0 };
  },

  async getPreview(courseId: string): Promise<CatalogCoursePreview> {
    const res = await api.get(`/course-catalog/courses/${courseId}/preview`);
    return res.data?.data;
  },

  async getAiInsights(courseId: string): Promise<CatalogAiInsights> {
    const res = await api.post(`/course-catalog/courses/${courseId}/ai-insights`);
    return res.data?.data;
  },

  publishCourse(id: string) {
    return lmsCourseService.updateCourse(id, { status: "published" });
  },

  archiveCourse(id: string) {
    return lmsCourseService.archiveCourse(id);
  },

  getCourse(id: string) {
    return lmsCourseService.getCourse(id);
  },
};

export type { Course, CourseStatus };
export default courseCatalogService;
