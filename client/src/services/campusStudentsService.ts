import api from "../lib/api";

export type PlacementStatus =
  | "Not Shortlisted"
  | "Shortlisted"
  | "Interviewed"
  | "Offered"
  | "Joined";

export type RiskLevel = "Low" | "Medium" | "High";

export interface CampusStudent {
  user_id: string;
  name: string;
  email: string;
  is_active: boolean;
  student_id: string;
  roll_number: string;
  passing_year: number;
  department: string;
  degree: string;
  cgpa: number;
  avatar?: string;
  avg_score: number;
  avg_integrity: number;
  placement_status: PlacementStatus;
  risk_level: RiskLevel;
  eligible_for_hiring?: boolean;
  placement_eligible?: boolean;
  active_backlogs?: number;
}

export interface StudentAssessment {
  drive_id: string;
  title: string;
  score: number;
  created_at: string;
}

export interface StudentViolation {
  id: string;
  violation_type: string;
  risk_score: number;
  timestamp: string;
}

/** Sprint 2.1 — student details overview (profile foundation). */
export interface StudentOverview {
  user_id: string;
  name: string;
  email: string;
  is_active: boolean;
  photo_url: string | null;
  student_id: string;
  roll_number: string | null;
  register_number: string | null;
  phone_number: string | null;
  gender: string | null;
  dob: string | null;
  department: string | null;
  program: string | null;
  academic_year: number | null;
  batch: string | null;
  semester: string | null;
  section: string | null;
  cgpa: number | null;
  degree: string | null;
  specialization: string | null;
  passing_year: number | null;
  class_name: string | null;
  placement_eligible?: boolean;
  eligibility_reason?: string | null;
  eligibility_date?: string | null;
  eligibility_verified_by?: string | null;
  eligibility_verified_by_name?: string | null;
  eligibility_verified_at?: string | null;
  active_backlogs?: number;
  eligibility_manual_override?: boolean;
  avg_integrity: number | null;
  placement_status: PlacementStatus;
  risk_level: RiskLevel;
  readiness_score: number | null;
  avg_score: number | null;
}

/** Sprint 2.5 — placement eligibility */
export interface EligibilityRuleCheck {
  cgpa_ok: boolean;
  backlog_ok: boolean;
  rule_eligible: boolean;
  cgpa: number | null;
  active_backlogs: number;
  min_cgpa: number;
  max_active_backlogs: number;
  messages: string[];
}

export interface EligibilityState {
  placement_eligible: boolean;
  reason: string | null;
  eligibility_date: string | null;
  verified_by: string | null;
  verified_by_name: string | null;
  verification_date: string | null;
  active_backlogs: number;
  manual_override: boolean;
  cgpa: number | null;
  rules: { min_cgpa: number; max_active_backlogs: number };
  rule_check: EligibilityRuleCheck;
}

export interface EligibilityHistoryItem {
  id: string;
  previous_eligible: boolean | null;
  new_eligible: boolean;
  previous_active_backlogs: number | null;
  new_active_backlogs: number | null;
  previous_cgpa: number | null;
  new_cgpa: number | null;
  change_source: string;
  reason: string | null;
  manual_override: boolean;
  verified_by: string | null;
  verified_by_name: string | null;
  created_at: string;
}

export interface StudentProfileResponse {
  overview: StudentOverview;
  assessments: StudentAssessment[];
  violations: StudentViolation[];
}

export interface UpdateStudentPayload {
  is_active?: boolean;
  placement_status?: PlacementStatus | string;
  risk_level?: RiskLevel;
  phone_number?: string | null;
  degree?: string | null;
  specialization?: string | null;
  passing_year?: number | null;
  cgpa?: number | null;
  // Sprint 2.2
  roll_number?: string;
  register_number?: string | null;
  name?: string;
  gender?: string | null;
  dob?: string | null;
  email?: string | null;
  department?: string;
  program?: string | null;
  batch?: string;
  semester?: string | null;
  section?: string | null;
  academic_year?: number | null;
  placement_eligible?: boolean;
  student_identifier?: string;
}

export interface CreateStudentPayload {
  name: string;
  email: string;
  password?: string;
  student_identifier?: string;
  phone_number?: string | null;
  degree?: string | null;
  specialization?: string | null;
  passing_year?: number | null;
  cgpa?: number | null;
  roll_number?: string;
  register_number?: string | null;
  gender?: string | null;
  dob?: string | null;
  department?: string;
  program?: string | null;
  batch?: string;
  semester?: string | null;
  section?: string | null;
  academic_year?: number | null;
  placement_eligible?: boolean;
  placement_status?: string;
}

export interface BulkImportStudent {
  name: string;
  email: string;
  student_identifier?: string;
  phone_number?: string;
  degree?: string;
  specialization?: string;
  passing_year?: number;
  cgpa?: number;
}

export interface BulkRowData {
  roll_number: string;
  register_number: string;
  name: string;
  gender: string;
  dob: string;
  email: string;
  phone_number: string;
  department: string;
  program: string;
  batch: string;
  semester: string;
  section: string;
  academic_year: string;
  cgpa: string;
  placement_eligible: string;
  placement_status: string;
}

export interface ValidatedBulkRow {
  row_number: number;
  status: "ok" | "error" | "skip";
  errors: string[];
  data: BulkRowData;
}

export interface BulkValidateResult {
  rows: ValidatedBulkRow[];
  summary: { total: number; ok: number; error: number; skip: number };
}

export interface BulkImportResult {
  summary: {
    total: number;
    successful: number;
    failed: number;
    skipped: number;
  };
  successful: Array<{ row_number: number; user_id: string; email: string }>;
  failed: Array<{
    row_number: number;
    email: string;
    roll_number: string;
    errors: string[];
  }>;
  skipped: Array<{
    row_number: number;
    email: string;
    roll_number: string;
    errors: string[];
  }>;
}

export interface StudentAnalytics {
  totalStudents: number;
  activeStudents: number;
  avgScore: number;
  avgIntegrity: number;
  appearedInLatestDrive: number;
  placedPipelineCount: number;
  highRiskCount: number;
}

export interface StudentListParams {
  page?: number;
  limit?: number;
  search?: string;
  year?: string;
  department?: string;
  placementStatus?: string;
  riskLevel?: string;
  status?: string;
  performance?: string;
  /** true | false | pending | eligible | ineligible */
  placementEligible?: string;
}

export interface Pagination {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export type BulkActionType =
  | "suspend"
  | "activate"
  | "soft_delete"
  | "update_placement"
  | "assign_workflow";

/** Sprint 2.4 — student document types */
export type StudentDocType =
  | "resume"
  | "photo"
  | "id_card"
  | "marksheet_10th"
  | "marksheet_12th"
  | "degree_certificate";

export interface StudentDocumentCurrent {
  id: string;
  version: number;
  original_name: string;
  mime_type: string;
  file_size: number;
  created_at: string;
  previewable: boolean;
}

export interface StudentDocumentHistoryItem {
  id: string;
  version: number;
  original_name: string;
  mime_type: string;
  file_size: number;
  created_at: string;
}

export interface StudentDocumentSlot {
  doc_type: StudentDocType;
  label: string;
  rules: string;
  current: StudentDocumentCurrent | null;
  history: StudentDocumentHistoryItem[];
}

export interface StudentDocumentsResponse {
  documents: StudentDocumentSlot[];
}

const campusStudentsService = {
  async list(params: StudentListParams = {}) {
    const { data } = await api.get("/campus/students", { params });
    return data as { data: CampusStudent[]; pagination: Pagination };
  },

  async getAnalytics(): Promise<StudentAnalytics> {
    const { data } = await api.get("/campus/students/analytics");
    return data.data;
  },

  async get(id: string): Promise<StudentProfileResponse> {
    const { data } = await api.get(`/campus/students/${id}`);
    return data.data;
  },

  async create(payload: CreateStudentPayload) {
    const { data } = await api.post("/campus/students", payload);
    return data;
  },

  async bulkImport(students: BulkImportStudent[]) {
    const { data } = await api.post("/campus/students/bulk-import", { students });
    return data;
  },

  async downloadBulkTemplate() {
    const res = await api.get("/campus/students/bulk-template", { responseType: "blob" });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = "student_bulk_upload_template.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  },

  async bulkValidate(file: File): Promise<BulkValidateResult> {
    const fd = new FormData();
    fd.append("file", file);
    const { data } = await api.post("/campus/students/bulk-validate", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data.data;
  },

  async bulkImportRows(rows: ValidatedBulkRow[]): Promise<BulkImportResult> {
    const { data } = await api.post("/campus/students/bulk-import", { rows });
    return data.data;
  },

  async downloadBulkErrorReport(
    failed: BulkImportResult["failed"]
  ): Promise<void> {
    const res = await api.post(
      "/campus/students/bulk-error-report",
      { failed },
      { responseType: "blob" }
    );
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = "student_bulk_errors.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  },

  async update(id: string, payload: UpdateStudentPayload) {
    const { data } = await api.put(`/campus/students/${id}`, payload);
    return data;
  },

  async softDelete(id: string) {
    const { data } = await api.delete(`/campus/students/${id}`);
    return data;
  },

  async bulkAction(
    action: BulkActionType,
    studentIds: string[],
    payload?: Record<string, unknown>
  ) {
    const { data } = await api.post("/campus/students/bulk-action", {
      action,
      studentIds,
      payload,
    });
    return data;
  },

  // Sprint 2.4 — student documents
  async listDocuments(studentId: string): Promise<StudentDocumentsResponse> {
    const { data } = await api.get(`/campus/students/${studentId}/documents`);
    return data.data;
  },

  async uploadDocument(studentId: string, docType: StudentDocType, file: File) {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("doc_type", docType);
    const { data } = await api.post(`/campus/students/${studentId}/documents`, fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data.data;
  },

  async downloadDocument(studentId: string, docId: string, filename: string) {
    const res = await api.get(`/campus/students/${studentId}/documents/${docId}/download`, {
      responseType: "blob",
    });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || "document";
    a.click();
    URL.revokeObjectURL(url);
  },

  async previewDocumentBlob(studentId: string, docId: string): Promise<Blob> {
    const res = await api.get(`/campus/students/${studentId}/documents/${docId}/preview`, {
      responseType: "blob",
    });
    return res.data;
  },

  async deleteDocument(studentId: string, docId: string) {
    const { data } = await api.delete(`/campus/students/${studentId}/documents/${docId}`);
    return data;
  },

  // Sprint 2.5 — placement eligibility
  async getEligibility(studentId: string): Promise<EligibilityState> {
    const { data } = await api.get(`/campus/students/${studentId}/eligibility`);
    return data.data;
  },

  async getEligibilityHistory(
    studentId: string
  ): Promise<{ history: EligibilityHistoryItem[] }> {
    const { data } = await api.get(`/campus/students/${studentId}/eligibility/history`);
    return data.data;
  },

  async setEligibility(
    studentId: string,
    payload: {
      eligible: boolean;
      reason: string;
      active_backlogs?: number;
      eligibility_date?: string;
    }
  ): Promise<EligibilityState> {
    const { data } = await api.put(`/campus/students/${studentId}/eligibility`, payload);
    return data.data;
  },
};

export default campusStudentsService;
