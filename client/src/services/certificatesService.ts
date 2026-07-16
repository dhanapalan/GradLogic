/**
 * Assessment Hub — Certificates client API
 */
import api from "../lib/api";

export type CertType =
  | "practice_completion"
  | "course_completion"
  | "placement_track_completion";

export interface CertificateRow {
  id: string;
  cert_type?: CertType | string;
  title?: string | null;
  student_id: string;
  student_name: string;
  student_email: string;
  course_title?: string | null;
  path_title?: string | null;
  drive_name?: string | null;
  verification_code?: string;
  issued_at: string;
}

export interface CertTypeMeta {
  value: CertType;
  label: string;
  description: string;
}

export interface CertOptions {
  practiceDrives: Array<{ id: string; name: string; drive_type: string; status: string }>;
  courses: Array<{ id: string; title: string; category?: string; status?: string }>;
  tracks: Array<{ id: string; title: string; domain?: string | null; status?: string }>;
}

export interface StudentHit {
  id: string;
  name: string;
  email: string;
  role: string;
}

const certificatesService = {
  list(params?: { search?: string; certType?: string }) {
    return api
      .get("/assessment-hub/certificates", {
        params: {
          search: params?.search || undefined,
          cert_type: params?.certType || undefined,
        },
      })
      .then((r) => (r.data?.data || []) as CertificateRow[]);
  },

  meta() {
    return api
      .get("/assessment-hub/certificates/meta")
      .then((r) => (r.data?.data || []) as CertTypeMeta[]);
  },

  options() {
    return api
      .get("/assessment-hub/certificates/options")
      .then((r) => r.data?.data as CertOptions);
  },

  searchStudents(q: string) {
    return api
      .get("/assessment-hub/certificates/students", { params: { q } })
      .then((r) => (r.data?.data || []) as StudentHit[]);
  },

  generate(body: {
    cert_type: CertType;
    student_id: string;
    course_id?: string;
    drive_id?: string;
    path_id?: string;
    title?: string;
    force?: boolean;
  }) {
    return api
      .post("/assessment-hub/certificates", body)
      .then((r) => r.data?.data as CertificateRow);
  },

  async downloadPdf(id: string, filenameHint?: string) {
    const res = await api.get(`/assessment-hub/certificates/${id}/pdf`, {
      responseType: "blob",
    });
    const blob = new Blob([res.data], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filenameHint || `certificate-${id.slice(0, 8)}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};

export default certificatesService;
