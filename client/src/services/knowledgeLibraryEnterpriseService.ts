import api from "../lib/api";

export interface EnterpriseSummary {
  archived: number;
  deleted: number;
  proposedVersions: number;
  published: number;
}

export interface ArchivedQuestion {
  id: string;
  question_text: string;
  category: string;
  type: string;
  difficulty_level: string;
  status: string;
  tags: string[] | null;
  bloom_level: string | null;
  topic_id: string | null;
  updated_at?: string;
  deleted_at?: string;
  created_at: string;
}

export interface VersionRow {
  id: string;
  question_id: string;
  improvement_type: string;
  status: string;
  change_summary: string | null;
  created_at: string;
  applied_at: string | null;
  question_text: string;
  category: string;
}

const BASE = "/knowledge-library-enterprise";

const knowledgeLibraryEnterpriseService = {
  summary() {
    return api.get(`${BASE}/summary`).then((r) => r.data?.data as EnterpriseSummary);
  },

  listArchived(search?: string) {
    return api
      .get(`${BASE}/archive/questions`, { params: { search, limit: 200 } })
      .then((r) => (r.data?.data || []) as ArchivedQuestion[]);
  },

  listDeleted(search?: string) {
    return api
      .get(`${BASE}/archive/deleted`, { params: { search, limit: 200 } })
      .then((r) => (r.data?.data || []) as ArchivedQuestion[]);
  },

  listArchivedContent() {
    return api.get(`${BASE}/archive/content`).then((r) => (r.data?.data || []) as Array<{
      id: string;
      content_type: string;
      title: string;
      category: string;
      status: string;
      updated_at: string;
    }>);
  },

  restore(questionIds: string[], mode: "unarchive" | "undelete" = "unarchive") {
    return api.post(`${BASE}/restore`, { questionIds, mode }).then((r) => r.data?.data as { restored: number });
  },

  restoreContent(ids: string[]) {
    return api.post(`${BASE}/restore-content`, { ids }).then((r) => r.data?.data as { restored: number });
  },

  bulkAssignTopic(input: {
    asset_type: "question" | "flashcard" | "content";
    asset_ids: string[];
    topic_id: string | null;
  }) {
    return api.post(`${BASE}/bulk-assign-topic`, input).then((r) => r.data?.data as { updated: number });
  },

  listVersions(status?: string) {
    return api
      .get(`${BASE}/versions`, { params: { status, limit: 80 } })
      .then((r) => (r.data?.data || []) as VersionRow[]);
  },

  /** Browser download for filtered CSV export. */
  exportCsvUrl(params?: { category?: string; status?: string; type?: string; search?: string }) {
    const qs = new URLSearchParams();
    if (params?.category) qs.set("category", params.category);
    if (params?.status) qs.set("status", params.status);
    if (params?.type) qs.set("type", params.type);
    if (params?.search) qs.set("search", params.search);
    const q = qs.toString();
    return `/api${BASE}/export/questions.csv${q ? `?${q}` : ""}`;
  },
};

export default knowledgeLibraryEnterpriseService;
