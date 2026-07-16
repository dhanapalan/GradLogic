// =============================================================================
// LMS course/module/lesson management — wraps server/src/routes/lms.routes.ts.
// Backend already existed (courses/modules/lessons CRUD); this is the first
// client using it from the superadmin side.
// =============================================================================

import api from "../lib/api";

export type CourseStatus = "draft" | "published" | "archived";

export interface Course {
  id: string;
  title: string;
  description: string | null;
  category: string;
  difficulty: string;
  duration_hours: number | null;
  status: CourseStatus;
  is_free: boolean;
  tags: string[];
  total_modules: number;
  total_enrollments: number;
  instructor_name: string | null;
  college_name: string | null;
  college_id: string | null;
  created_at: string;
  language?: string | null;
  subject?: string | null;
  estimated_minutes?: number | null;
  thumbnail_url?: string | null;
  enrollment_count?: number;
}

export interface Lesson {
  id: string;
  module_id: string;
  title: string;
  content_type: string;
  content_url: string | null;
  content_text: string | null;
  sort_order: number;
  is_free_preview: boolean;
  estimated_minutes: number | null;
}

export interface CourseModule {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  sort_order: number;
  is_locked: boolean;
  estimated_minutes: number | null;
  lessons: Lesson[];
}

export interface CourseDetail extends Course {
  modules: CourseModule[];
}

const lmsCourseService = {
  async listCourses(params?: { status?: string; search?: string; category?: string }): Promise<Course[]> {
    const res = await api.get("/lms/courses", { params });
    return res.data?.data || [];
  },

  async getCourse(id: string): Promise<CourseDetail> {
    const res = await api.get(`/lms/courses/${id}`);
    return res.data?.data;
  },

  async createCourse(input: {
    title: string;
    description?: string;
    category: string;
    difficulty?: string;
    duration_hours?: number;
    is_free?: boolean;
  }): Promise<Course> {
    const res = await api.post("/lms/courses", input);
    return res.data?.data;
  },

  async updateCourse(id: string, input: Partial<{
    title: string;
    description: string;
    category: string;
    difficulty: string;
    status: CourseStatus;
    language: string;
    subject: string;
    thumbnail_url: string;
    duration_hours: number;
    estimated_minutes: number;
    tags: string[];
  }>): Promise<Course> {
    const res = await api.put(`/lms/courses/${id}`, input);
    return res.data?.data;
  },

  async archiveCourse(id: string): Promise<void> {
    await api.delete(`/lms/courses/${id}`);
  },

  async createModule(courseId: string, input: { title: string; description?: string; sort_order?: number }): Promise<CourseModule> {
    const res = await api.post(`/lms/courses/${courseId}/modules`, input);
    return res.data?.data;
  },

  async updateModule(id: string, input: Partial<{ title: string; description: string; sort_order: number }>): Promise<CourseModule> {
    const res = await api.put(`/lms/modules/${id}`, input);
    return res.data?.data;
  },

  async deleteModule(id: string): Promise<void> {
    await api.delete(`/lms/modules/${id}`);
  },

  async createLesson(moduleId: string, input: { title: string; content_type: string; content_text?: string; content_url?: string; sort_order?: number }): Promise<Lesson> {
    const res = await api.post(`/lms/modules/${moduleId}/lessons`, input);
    return res.data?.data;
  },

  async updateLesson(id: string, input: Partial<{ title: string; content_text: string; content_url: string; sort_order: number }>): Promise<Lesson> {
    const res = await api.put(`/lms/lessons/${id}`, input);
    return res.data?.data;
  },

  async deleteLesson(id: string): Promise<void> {
    await api.delete(`/lms/lessons/${id}`);
  },

  async listAssignedColleges(courseId: string): Promise<{
    college_id: string;
    college_name: string;
    assigned_at: string;
    notes?: string | null;
    meta?: Record<string, unknown>;
    batch_id?: string | null;
    batch_name?: string | null;
  }[]> {
    const res = await api.get(`/lms/courses/${courseId}/colleges`);
    return res.data?.data || [];
  },

  async assignCollege(
    courseId: string,
    collegeId: string,
    opts?: { notes?: string; batch_id?: string | null; meta?: Record<string, unknown> }
  ): Promise<void> {
    await api.post(`/lms/courses/${courseId}/colleges`, {
      college_id: collegeId,
      notes: opts?.notes,
      batch_id: opts?.batch_id,
      meta: opts?.meta,
    });
  },

  async unassignCollege(courseId: string, collegeId: string): Promise<void> {
    await api.delete(`/lms/courses/${courseId}/colleges/${collegeId}`);
  },
};

export default lmsCourseService;
