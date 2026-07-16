import api from "../lib/api";

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  category: string;
  difficulty: string;
  tags: string[];
  created_at: string;
  created_by_name?: string;
}

export interface PublishedLesson {
  id: string;
  title: string;
  content_type: string;
  content_text: string | null;
  content_url: string | null;
  estimated_minutes: number | null;
  module_id: string;
  module_title: string;
  course_id: string;
  course_title: string;
  course_category: string;
  created_at: string;
}

export type ContentLibraryType =
  | "interview_question"
  | "case_study"
  | "learning_resource"
  | "resource";

export interface ContentLibraryItem {
  id: string;
  content_type: ContentLibraryType;
  title: string;
  body: string;
  category: string;
  difficulty: string;
  tags: string[];
  meta: Record<string, unknown>;
  status: string;
  created_at: string;
  updated_at: string;
  created_by_name?: string;
}

export interface JourneyTemplate {
  id: string;
  title: string;
  description: string | null;
  target_role: string | null;
  duration_days: number | null;
  status: string;
  course_count: number;
  created_by_name?: string;
  updated_at: string;
}

export interface CertificateRow {
  id: string;
  title?: string | null;
  student_name: string;
  student_email: string;
  course_title?: string | null;
  path_title?: string | null;
  verification_code?: string;
  issued_at: string;
}

export interface BatchRow {
  id: string;
  college_id: string;
  college_name: string;
  name: string;
  academic_year: string | null;
  program_label: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  student_count: number;
}

export interface EnrollmentRow {
  id: string;
  batch_id: string;
  batch_name: string;
  college_name: string;
  student_id: string;
  student_name: string;
  student_email: string;
  status: string;
  enrolled_at: string;
}

const BASE = "/superadmin-features";

const superadminFeaturesService = {
  listFlashcards(params?: { category?: string; search?: string }) {
    return api.get(`${BASE}/flashcards`, { params }).then((r) => (r.data?.data || []) as Flashcard[]);
  },

  listLessons(params?: { voice?: boolean; search?: string }) {
    return api
      .get(`${BASE}/lessons`, { params: { search: params?.search, voice: params?.voice ? "1" : undefined } })
      .then((r) => (r.data?.data || []) as PublishedLesson[]);
  },

  listContentLibrary(params?: { content_type?: ContentLibraryType; search?: string; status?: string }) {
    return api.get(`${BASE}/content-library`, { params }).then((r) => (r.data?.data || []) as ContentLibraryItem[]);
  },

  createContentLibraryItem(input: {
    content_type: ContentLibraryType;
    title: string;
    body?: string;
    category?: string;
    tags?: string[];
  }) {
    return api.post(`${BASE}/content-library`, input).then((r) => r.data?.data as ContentLibraryItem);
  },

  archiveContentLibraryItem(id: string) {
    return api.delete(`${BASE}/content-library/${id}`);
  },

  listJourneyTemplates() {
    return api.get(`${BASE}/journey-templates`).then((r) => (r.data?.data || []) as JourneyTemplate[]);
  },

  createJourneyTemplate(input: {
    title: string;
    description?: string;
    target_role?: string;
    duration_days?: number;
  }) {
    return api.post(`${BASE}/journey-templates`, input).then((r) => r.data?.data as JourneyTemplate);
  },

  updateJourneyTemplate(id: string, input: Partial<{ title: string; description: string; status: string }>) {
    return api.put(`${BASE}/journey-templates/${id}`, input).then((r) => r.data?.data as JourneyTemplate);
  },

  listCertificates(search?: string) {
    return api.get(`${BASE}/certificates`, { params: { search } }).then((r) => (r.data?.data || []) as CertificateRow[]);
  },

  listBatches(collegeId?: string) {
    return api.get(`${BASE}/batches`, { params: { college_id: collegeId } }).then((r) => (r.data?.data || []) as BatchRow[]);
  },

  createBatch(input: {
    college_id: string;
    name: string;
    academic_year?: string;
    program_label?: string;
    start_date?: string;
    end_date?: string;
  }) {
    return api.post(`${BASE}/batches`, input).then((r) => r.data?.data as BatchRow);
  },

  updateBatch(id: string, input: Partial<{ name: string; status: string }>) {
    return api.put(`${BASE}/batches/${id}`, input).then((r) => r.data?.data as BatchRow);
  },

  listEnrollments(params?: { batch_id?: string; search?: string }) {
    return api.get(`${BASE}/enrollments`, { params }).then((r) => (r.data?.data || []) as EnrollmentRow[]);
  },

  enrollStudent(batch_id: string, student_id: string) {
    return api.post(`${BASE}/enrollments`, { batch_id, student_id }).then((r) => r.data?.data);
  },

  setEnrollmentStatus(id: string, status: "active" | "withdrawn" | "completed") {
    return api.patch(`${BASE}/enrollments/${id}`, { status }).then((r) => r.data?.data);
  },

  learningAnalytics() {
    return api.get(`${BASE}/analytics/learning`).then((r) => r.data?.data);
  },

  courseAnalytics() {
    return api.get(`${BASE}/analytics/courses`).then((r) => r.data?.data);
  },

  voiceAnalytics() {
    return api.get(`${BASE}/analytics/voice`).then((r) => r.data?.data);
  },
};

export default superadminFeaturesService;
