/**
 * Student Portal Module 04 — My Learning API client.
 */
import api from "../lib/api";

export type LearningSummary = {
  total_assigned_courses: number;
  courses_in_progress: number;
  completed_courses: number;
  learning_hours: number;
  certificates_earned: number;
  learning_streak_days: number;
  overall_progress_percent: number;
};

export type ContinueLearning = {
  course_id: string;
  course_title: string;
  thumbnail_url?: string | null;
  progress_percent: number;
  lesson_id?: string | null;
  lesson_title?: string | null;
  watch_seconds?: number;
  estimated_remaining_minutes?: number | null;
  last_accessed?: string | null;
} | null;

export type LearningPath = {
  id: string;
  title: string;
  description?: string | null;
  course_count: number;
  progress_percent: number;
  due_date?: string | null;
  status: "not_started" | "in_progress" | "completed" | string;
  thumbnail_url?: string | null;
};

export type LearningCourse = {
  id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  difficulty?: string | null;
  duration_hours?: number | null;
  thumbnail_url?: string | null;
  instructor_name?: string | null;
  progress_percent: number;
  last_accessed?: string | null;
  due_date?: string | null;
  completion_status: string;
  is_assigned: boolean;
  tags?: string[] | null;
};

export type LearningRecommendation = {
  id: string;
  kind: string;
  title: string;
  description: string;
  href: string;
  priority: number;
};

export type LearningEvent = {
  id: string;
  title: string;
  type: string;
  starts_at: string | null;
  ends_at: string | null;
  href: string;
};

export type LearningBookmark = {
  id: string;
  target_type: string;
  target_id: string;
  title?: string | null;
  href?: string | null;
  created_at: string;
};

export type LearningAssessment = {
  id: string;
  name: string;
  campaign_name?: string;
  availability: string;
  attempts_remaining: number | null;
  status: string;
  can_start: boolean;
  launch_href: string;
  result_href: string;
};

export type LearningCertificate = {
  id: string;
  title: string;
  issue_date: string;
  certificate_id: string;
  course_title?: string | null;
};

export type CourseFilters = {
  scope?: string;
  status?: string;
  category?: string;
  difficulty?: string;
  skill?: string;
  search?: string;
};

async function unwrap<T>(promise: Promise<{ data: { data: T } }>): Promise<T> {
  const { data } = await promise;
  return data.data;
}

const studentLearningService = {
  getDashboard: () => unwrap(api.get("/learning/dashboard")),
  getSummary: () => unwrap<LearningSummary>(api.get("/learning/summary")),
  getPaths: () => unwrap<LearningPath[]>(api.get("/learning/paths")),
  getPath: (id: string) => unwrap(api.get(`/learning/paths/${id}`)),
  getCourses: (filters: CourseFilters = {}) =>
    unwrap<LearningCourse[]>(api.get("/learning/courses", { params: filters })),
  getCourse: (id: string) => unwrap(api.get(`/learning/courses/${id}`)),
  getLesson: (id: string) => unwrap(api.get(`/learning/lessons/${id}`)),
  saveLessonProgress: (
    id: string,
    body: { watch_seconds?: number; is_completed?: boolean; playback_position?: number }
  ) => unwrap(api.post(`/learning/lessons/${id}/progress`, body)),
  getProgress: () => unwrap(api.get("/learning/progress")),
  getResources: () => unwrap(api.get("/learning/resources")),
  getAssignments: () => unwrap(api.get("/learning/assignments")),
  getAssessments: () => unwrap<LearningAssessment[]>(api.get("/learning/assessments")),
  getCertificates: () => unwrap<LearningCertificate[]>(api.get("/learning/certificates")),
  getBookmarks: () => unwrap<LearningBookmark[]>(api.get("/learning/bookmarks")),
  addBookmark: (body: {
    target_type: string;
    target_id: string;
    title?: string;
    href?: string;
  }) => unwrap(api.post("/learning/bookmarks", body)),
  removeBookmark: (id: string) => unwrap(api.delete(`/learning/bookmarks/${id}`)),
  getRecommendations: () =>
    unwrap<LearningRecommendation[]>(api.get("/learning/recommendations")),
  getLearningEvents: (days = 30) =>
    unwrap<LearningEvent[]>(api.get("/calendar/learning-events", { params: { days } })),
};

export default studentLearningService;
