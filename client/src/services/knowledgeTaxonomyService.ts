import api from "../lib/api";

export interface TaxonomyCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
  subject_count: number;
  topic_count: number;
  question_count: number;
}

export interface TaxonomySubject {
  id: string;
  category_id: string;
  category_name: string;
  category_slug: string;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  topic_count: number;
}

export interface TaxonomyTopic {
  id: string;
  subject_id: string;
  subject_name: string;
  category_id: string;
  category_name: string;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  question_count: number;
  flashcard_count: number;
  content_count: number;
}

export interface TopicDetail {
  topic: TaxonomyTopic & {
    category_slug?: string;
    description: string | null;
  };
  questions: Array<{
    id: string;
    question_text: string;
    category: string;
    type: string;
    difficulty_level: string;
    status: string;
    tags: string[] | null;
    bloom_level: string | null;
  }>;
  flashcards: Array<{
    id: string;
    front: string;
    back: string;
    category: string;
    difficulty: string;
  }>;
  content: Array<{
    id: string;
    content_type: string;
    title: string;
    body: string;
    category: string;
    difficulty: string;
    status: string;
  }>;
}

const BASE = "/knowledge-taxonomy";

const knowledgeTaxonomyService = {
  getTree() {
    return api.get(`${BASE}/tree`).then((r) => r.data?.data as {
      categories: TaxonomyCategory[];
      subjects: TaxonomySubject[];
      topics: TaxonomyTopic[];
    });
  },

  listCategories() {
    return api.get(`${BASE}/categories`).then((r) => (r.data?.data || []) as TaxonomyCategory[]);
  },

  listSubjects(categoryId?: string) {
    return api
      .get(`${BASE}/subjects`, { params: categoryId ? { category_id: categoryId } : undefined })
      .then((r) => (r.data?.data || []) as TaxonomySubject[]);
  },

  createSubject(input: { category_id: string; name: string; description?: string }) {
    return api.post(`${BASE}/subjects`, input).then((r) => r.data?.data as TaxonomySubject);
  },

  updateSubject(id: string, input: Partial<{ name: string; description: string; is_active: boolean }>) {
    return api.put(`${BASE}/subjects/${id}`, input).then((r) => r.data?.data);
  },

  deleteSubject(id: string) {
    return api.delete(`${BASE}/subjects/${id}`);
  },

  listTopics(params?: { subject_id?: string; category_id?: string; search?: string }) {
    return api.get(`${BASE}/topics`, { params }).then((r) => (r.data?.data || []) as TaxonomyTopic[]);
  },

  getTopic(id: string) {
    return api.get(`${BASE}/topics/${id}`).then((r) => r.data?.data as TopicDetail);
  },

  createTopic(input: { subject_id: string; name: string; description?: string }) {
    return api.post(`${BASE}/topics`, input).then((r) => r.data?.data as TaxonomyTopic);
  },

  updateTopic(id: string, input: Partial<{ name: string; description: string; is_active: boolean; subject_id: string }>) {
    return api.put(`${BASE}/topics/${id}`, input).then((r) => r.data?.data);
  },

  deleteTopic(id: string) {
    return api.delete(`${BASE}/topics/${id}`);
  },

  assignAsset(input: {
    asset_type: "question" | "flashcard" | "content";
    asset_id: string;
    topic_id: string | null;
  }) {
    return api.post(`${BASE}/assign`, input).then((r) => r.data?.data);
  },

  promoteTags(subjectId: string, tags: string[]) {
    return api.post(`${BASE}/topics/promote-tags`, { subject_id: subjectId, tags }).then((r) => r.data?.data);
  },
};

export default knowledgeTaxonomyService;
