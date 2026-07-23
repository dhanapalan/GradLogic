// =============================================================================
// TalentSecure AI — Shared TypeScript Types
// Aligned with the 5-table PostgreSQL schema (01-schema.sql)
// =============================================================================

// ── Database Enums (mirror PostgreSQL enums) ─────────────────────────────────

export type UserRole =
  | "super_admin"
  | "admin"          // legacy — maps to super_admin
  | "college"        // legacy — maps to college_admin
  | "college_staff"
  | "college_admin"
  | "hr"
  | "engineer"
  | "cxo"
  | "student"
  | "instructor"     // creates & manages courses, grades assignments
  | "mentor"         // views assigned students, conducts mock interviews
  | "company"        // recruiting company; manages own drives + views results
  | "placement_cell"; // college placement staff — coordinates drives, tracks readiness

export type ViolationType =
  | "face_not_detected"
  | "multiple_faces"
  | "face_mismatch"
  | "tab_switch"
  | "browser_minimized"
  | "copy_paste_attempt"
  | "right_click"
  | "screen_share_detected"
  | "devtools_open"
  | "external_display"
  | "network_anomaly";

export type QuestionCategory =
  | "reasoning"
  | "maths"
  | "aptitude"
  | "data_structures"
  | "programming"
  | "python_coding"
  | "java_coding"
  | "data_science";

export type QuestionType = "multiple_choice" | "coding_challenge";

export type DifficultyLevel = "easy" | "medium" | "hard";

export type ExamAttemptStatus = "in_progress" | "interrupted" | "completed" | "reset";

export type AdminAuditAction =
  | "EXAM_RESET"
  | "EXAM_RESUMED"
  | "CAMPUS_CREATED"
  | "CAMPUS_UPDATED"
  | "CAMPUS_DELETED"
  | "CAMPUS_ACTIVATED"
  | "CAMPUS_DEACTIVATED"
  | "CAMPUS_ADMIN_ADDED"
  | "STUDENT_CREATED"
  | "STUDENT_UPDATED"
  | "STUDENT_DELETED"
  | "EXAM_GENERATED"
  | "EXAM_ASSIGNED"
  | "EXAM_TERMINATED"
  | "SESSION_TERMINATED"
  | "SESSION_RESET"
  | "ROLE_CREATED"
  | "USER_CREATED"
  | "USER_ROLE_CHANGED"
  | "USER_DELETED"
  | "LOGIN_SUCCESS"
  | "LOGIN_FAILURE"
  | "PERMISSION_DENIED"
  | "QUESTION_CREATED"
  | "QUESTION_UPDATED"
  | "QUESTION_DELETED"
  | "ASSESSMENT_CREATED"
  | "ASSESSMENT_UPDATED"
  | "ASSESSMENT_DELETED"
  | "ASSESSMENT_PUBLISHED"
  | "ASSESSMENT_ARCHIVED"
  | "STUDENTS_BULK_ADDED"
  | "STUDENT_DOCUMENT_UPLOADED"
  | "STUDENT_DOCUMENT_DELETED"
  | "STUDENT_ELIGIBILITY_CHANGED"
  | "USER_STATUS_CHANGED"
  | "USER_PASSWORD_RESET"
  | "CAMPUS_MOU_UPLOADED"
  | "CAMPUS_BULK_SUSPEND"
  | "CAMPUS_BULK_ACTIVATE"
  | "CAMPUS_BULK_BLACKLIST"
  | "college_approved"
  | "college_rejected"
  | "AI_SERVICE_CREATED"
  | "AI_SERVICE_UPDATED"
  | "AI_SERVICE_DELETED"
  | "AI_SERVICE_KEY_SET"
  | "AI_SERVICE_KEY_REVOKED"
  | "ASSESSMENT_ANALYTICS_EXPORT"
  | "CAMPAIGN_INTEGRITY_REVIEW"
  | "CAMPAIGN_ATTEMPT_STARTED"
  | "CAMPAIGN_ATTEMPT_SUBMITTED"
  | "CAMPAIGN_ATTEMPT_AUTO_SUBMITTED"
  | "DEPARTMENT_CREATED"
  | "DEPARTMENT_UPDATED";

// ── Row Types ────────────────────────────────────────────────────────────────

export interface UserRow {
  id: string;
  role: UserRole;
  name?: string;
  first_name?: string;
  last_name?: string;
  email: string;
  password: string;
  college_id?: string | null;
  department?: string | null;
  phone_number?: string | null;
  dob?: Date | null;
  is_profile_complete?: boolean;
  must_change_password?: boolean;
  is_active: boolean;
  status: string;
  login_type: string;
  last_login_at?: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface StudentDetailRow {
  id: string;
  user_id: string;
  college_id: string;
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
  student_identifier?: string | null;
  gender?: "male" | "female" | "non_binary" | "prefer_not_to_say" | null;
  phone_number?: string | null;
  alternate_email?: string | null;
  alternate_phone?: string | null;
  dob?: Date | null;
  degree?: string | null;
  specialization?: string | null;
  passing_year?: number | null;
  cgpa?: number | null;
  percentage?: number | null;
  class_name?: string | null;
  section?: string | null;
  resume_url?: string | null;
  skills?: string[] | null;
  linkedin_url?: string | null;
  github_url?: string | null;
  face_photo_url: string | null;
  id_photo_url: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface ExamRow {
  id: string;
  title: string;
  scheduled_time: Date;
  duration: number;
  total_questions: number;
  questions_per_student: number | null;
  duration_minutes: number | null;
  created_by: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CheatingLogRow {
  id: string;
  student_id: string;
  exam_id: string;
  timestamp: Date;
  violation_type: ViolationType;
  risk_score: number;
  screenshot_url: string | null;
  created_at: Date;
}

export interface MarksScoredRow {
  id: string;
  student_id: string;
  exam_id: string;
  final_score: number;
  created_at: Date;
  updated_at: Date;
}

export interface QuestionBankRow {
  id: string;
  category: QuestionCategory;
  type: QuestionType;
  difficulty_level: DifficultyLevel;
  question_text: string;
  options: unknown[] | null;           // JSONB array of option strings
  correct_answer: string | null;
  test_cases: TestCase[] | null;       // JSONB array
  starter_code: Record<string, string> | null; // JSONB { lang: code }
  time_limit_ms: number;
  memory_limit_kb: number;
  marks: number;
  tags: string[];
  explanation: string | null;
  created_by: string | null;
  is_active: boolean;
  status: string;
  bloom_level: string | null;
  hint: string | null;
  learning_objectives: string[];
  reference_links: string[];
  search_embedding: number[] | null;
  search_embedding_model: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface TestCase {
  input: string;
  expectedOutput: string;
  hidden?: boolean;
}

export interface ExamAttemptRow {
  id: string;
  student_id: string;
  exam_id: string;
  status: ExamAttemptStatus;
  current_question_index: number;
  saved_answers: Record<string, unknown>;
  question_ids: string[] | null;
  started_at: Date;
  last_saved_at: Date;
  completed_at: Date | null;
}

export interface AdminAuditLogRow {
  id: string;
  admin_id: string;
  student_id: string;
  exam_id: string;
  action: AdminAuditAction;
  reason: string;
  created_at: Date;
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export interface AuthPayload {
  userId: string;
  email: string;
  role: UserRole;
  college_id: string | null;
}

// ── API Response Envelope ────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  /** Per-field validation messages, e.g. { passing_year: "..." } */
  fieldErrors?: Record<string, string>;
  errors?: Array<{ index: number; error: string }>;
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  pagination?: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}
