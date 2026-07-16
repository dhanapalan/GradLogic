import api from "../lib/api";
import type { AiSearchResult } from "./aiSearchService";

export interface RelatedResult {
  source: {
    id: string;
    question_text: string;
    category: string;
    topic_id: string | null;
  };
  related: Array<{
    id: string;
    question_text: string;
    category: string;
    type: string;
    difficulty_level: string;
    similarity: number | null;
    reason: string;
  }>;
}

export interface DuplicateScanResult {
  source: { id: string; question_text: string };
  matches: Array<{ id: string; question_text: string; similarity: number }>;
  embeddingsUsed: boolean;
  message?: string;
}

export interface EmbedBackfillResult {
  processed: number;
  embedded: number;
  failed: number;
  coverage: { total: number; with_embedding: number } | null;
}

const BASE = "/knowledge-library-ai";

const knowledgeLibraryAiService = {
  search(q: string, limit = 10) {
    return api.get(`${BASE}/search`, { params: { q, limit } }).then((r) => r.data?.data as AiSearchResult);
  },

  related(questionId: string, limit = 10) {
    return api
      .get(`${BASE}/related/${questionId}`, { params: { limit } })
      .then((r) => r.data?.data as RelatedResult);
  },

  duplicates(questionId: string, limit = 10) {
    return api
      .get(`${BASE}/duplicates/${questionId}`, { params: { limit } })
      .then((r) => r.data?.data as DuplicateScanResult);
  },

  embeddingCoverage() {
    return api
      .get(`${BASE}/embeddings/coverage`)
      .then((r) => r.data?.data as { total: number; with_embedding: number } | null);
  },

  backfillEmbeddings(input?: { limit?: number; questionIds?: string[] }) {
    return api.post(`${BASE}/embeddings/backfill`, input || {}).then((r) => r.data?.data as EmbedBackfillResult);
  },
};

export default knowledgeLibraryAiService;
