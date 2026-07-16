import api from "../lib/api";

// Provenance/system tags applied automatically by the AI pipeline — never
// real subject-matter topics, so every topic/skill facet display must
// exclude them. Single source of truth: import this instead of hardcoding
// a local copy (a local copy is exactly how this list previously drifted
// out of sync across files and let new tags leak into the Topics page).
export const SYSTEM_TAGS = new Set([
  "ai-generated",
  "manual",
  "book-import",
  "pdf-import",
  "content-studio",
  "regenerated",
]);

export function isSystemTag(tag: string): boolean {
  return SYSTEM_TAGS.has(tag) || tag.startsWith("pdf-") || tag.startsWith("book-");
}

// Mirrors the question_bank row shape returned by the API. The list endpoint
// is a SELECT * under the hood, so every field below is already present on
// each row from a normal list/search fetch — no separate detail call needed
// to expand a Knowledge Card.
export interface Question {
  id: string;
  question_text: string;
  category: string;
  type: string;
  difficulty_level: "easy" | "medium" | "hard";
  tags: string[] | null;
  status: string;
  bloom_level: string | null;
  is_active: boolean;
  created_at: string;
  options?: string[] | null;
  correct_answer?: string | null;
  explanation?: string | null;
  test_cases?: Array<{ input: string; expectedOutput: string; hidden?: boolean }> | null;
  starter_code?: Record<string, string> | null;
  marks?: number;
  /** Knowledge Object fields (Phase 4) — see migration 34. */
  hint?: string | null;
  learning_objectives?: string[];
  reference_links?: string[];
}

export interface QuestionSearchFilters {
  search?: string;
  category?: string;
  type?: string;
  difficulty?: string;
  bloomLevel?: string;
  tags?: string[];
  source?: "ai-generated" | "manual";
  status?: string;
  page?: number;
  limit?: number;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  question_count: number;
  is_active?: boolean;
  topics?: Topic[];
}

export interface Topic {
  id: string;
  name: string;
  questionCount: number;
}

export interface AIQuestion {
  id: string;
  text: string;
  options?: string[];
  correctAnswer?: string;
  explanation?: string;
  category: string;
  difficulty: "easy" | "medium" | "hard";
  source: string;
  generatedAt: string;
  status: "pending" | "approved" | "rejected";
  quality_score: number;
  /** Real column, often unset — surfaced honestly (null, not faked) rather than dropped. */
  bloomLevel: string | null;
  tags: string[];
}

// ── AI Content Studio — types (all backed by the existing /qb-ai/* engine) ──

export interface EngineHealth {
  online: boolean;
  engine: { knowledge_base?: { total_chunks?: number; unique_documents?: number } } | null;
}

export interface AIContentItem {
  id: string;
  content_type: "flashcard" | "lesson" | "voice_lesson";
  title: string;
  body: string;
  explanation: string | null;
  category: string;
  difficulty: string;
  tags: string[];
  status: "pending_review" | "approved" | "rejected" | "published";
  rejection_reason: string | null;
  published_lesson_id: string | null;
  created_at: string;
}

export interface GeneratedContentItem {
  question: string;
  options: string[];
  correct_answer: string;
  /** Flashcard back / lesson body — set instead of options/correct_answer for non-MCQ content kinds. */
  answer?: string;
  explanation?: string;
  difficulty?: string;
  category: string;
}

class QuestionBankService {
  /**
   * Search questions with filters
   */
  async searchQuestions(
    filters: QuestionSearchFilters = {}
  ): Promise<{ questions: Question[]; total: number }> {
    try {
      const page = filters.page || 1;
      const limit = filters.limit || 50;
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: ((page - 1) * limit).toString(),
      });
      if (filters.search) params.append("search", filters.search);
      if (filters.category) params.append("category", filters.category);
      if (filters.type) params.append("type", filters.type);
      if (filters.difficulty) params.append("difficulty_level", filters.difficulty);
      if (filters.bloomLevel) params.append("bloom_level", filters.bloomLevel);
      if (filters.tags && filters.tags.length > 0) params.append("tags", filters.tags.join(","));
      if (filters.source) params.append("source", filters.source);
      if (filters.status) params.append("status", filters.status);

      const response = await api.get(`/superadmin/question-bank?${params}`);
      return {
        questions: response.data?.data || [],
        total: response.data?.meta?.total ?? (response.data?.data?.length || 0),
      };
    } catch (error) {
      console.error("Failed to search questions:", error);
      throw error;
    }
  }

  /**
   * Bulk publish or archive questions
   */
  async bulkAction(
    action: "publish" | "archive",
    questionIds: string[]
  ): Promise<{ success: boolean; message: string }> {
    const response = await api.post("/superadmin/question-bank/bulk-action", {
      action,
      questionIds,
    });
    return response.data;
  }

  /**
   * Get question by ID
   */
  async getQuestion(id: string): Promise<Question> {
    try {
      const response = await api.get(`/superadmin/question-bank/${id}`);
      return response.data?.data;
    } catch (error) {
      console.error(`Failed to fetch question ${id}:`, error);
      throw error;
    }
  }

  /**
   * Create new question
   */
  async createQuestion(data: any): Promise<Question> {
    try {
      const response = await api.post("/superadmin/question-bank", data);
      return response.data?.data;
    } catch (error) {
      console.error("Failed to create question:", error);
      throw error;
    }
  }

  /**
   * Update question
   */
  async updateQuestion(id: string, data: any): Promise<Question> {
    try {
      const response = await api.put(`/superadmin/question-bank/${id}`, data);
      return response.data?.data;
    } catch (error) {
      console.error(`Failed to update question ${id}:`, error);
      throw error;
    }
  }

  /**
   * Delete question (soft delete)
   */
  async deleteQuestion(id: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await api.delete(`/superadmin/question-bank/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Failed to delete question ${id}:`, error);
      throw error;
    }
  }

  /**
   * Get all categories
   */
  async getCategories(): Promise<Category[]> {
    try {
      const response = await api.get("/superadmin/categories");
      return response.data?.data || [];
    } catch (error) {
      console.error("Failed to fetch categories:", error);
      throw error;
    }
  }

  /**
   * Create category
   */
  async createCategory(name: string, description: string): Promise<Category> {
    try {
      const response = await api.post("/superadmin/categories", {
        name,
        description,
      });
      return response.data?.data;
    } catch (error) {
      console.error("Failed to create category:", error);
      throw error;
    }
  }

  /**
   * Update category
   */
  async updateCategory(
    id: string,
    data: { name?: string; description?: string; is_active?: boolean }
  ): Promise<Category> {
    const response = await api.put(`/superadmin/categories/${id}`, data);
    return response.data?.data;
  }

  /**
   * Deactivate category
   */
  async deactivateCategory(id: string): Promise<{ success: boolean; message: string }> {
    const response = await api.delete(`/superadmin/categories/${id}`);
    return response.data;
  }

  /** @deprecated use deactivateCategory */
  async deleteCategory(id: string) {
    return this.deactivateCategory(id);
  }

  /**
   * Deactivate question (sets is_active=false)
   */
  async deactivateQuestion(id: string): Promise<{ success: boolean; message: string }> {
    return this.deleteQuestion(id);
  }

  /**
   * Add topic to category
   */
  async addTopic(categoryId: string, topicName: string): Promise<Topic> {
    try {
      const response = await api.post(
        `/superadmin/categories/${categoryId}/topics`,
        { name: topicName }
      );
      return response.data?.data;
    } catch (error) {
      console.error(`Failed to add topic:`, error);
      throw error;
    }
  }

  /**
   * Bulk-create questions (used by book pack imports and CSV import)
   */
  async bulkCreateQuestions(
    questions: Array<{
      category: string;
      type: string;
      difficulty_level: string;
      question_text: string;
      options?: string[];
      correct_answer?: string;
      explanation?: string;
      tags?: string[];
      marks?: number;
      bloom_level?: string;
    }>
  ): Promise<{ created: number; errors: Array<{ index: number; error: string }> }> {
    const response = await api.post("/superadmin/question-bank/bulk", { questions });
    return {
      created: response.data?.data?.length ?? 0,
      errors: response.data?.errors || [],
    };
  }

  /**
   * Parse an uploaded question PDF into MCQ candidates (no DB writes).
   * The admin reviews/corrects the result, then imports via bulkCreateQuestions.
   */
  async parsePdfQuestions(file: File): Promise<{
    filename: string;
    questions: Array<{
      number: number;
      question_text: string;
      options: string[];
      correct_answer: string | null;
      explanation: string | null;
      needs_answer: boolean;
    }>;
    warnings: string[];
    meta: { pages: number; characters: number };
  }> {
    const form = new FormData();
    form.append("file", file);
    // No manual Content-Type: axios must generate it from the FormData itself
    // so the multipart boundary parameter is included.
    const response = await api.post("/superadmin/question-bank/import-pdf/parse", form);
    return response.data?.data;
  }

  /**
   * Count questions carrying a tag (used to detect already-imported packs)
   */
  async countByTag(tag: string): Promise<number> {
    const response = await api.get(
      `/superadmin/question-bank?tags=${encodeURIComponent(tag)}&limit=1`
    );
    return response.data?.meta?.total ?? (response.data?.data?.length || 0);
  }

  /**
   * Subject counts (the question_bank.category enum — aptitude, reasoning,
   * maths, etc). Backed by the existing GET /question-bank/categories
   * endpoint; no backend changes.
   */
  async getSubjectCounts(): Promise<Array<{ category: string; count: number }>> {
    const response = await api.get("/superadmin/question-bank/categories");
    return response.data?.data || [];
  }

  /**
   * Topic (tag) and Skill (bloom_level) facets, aggregated client-side from a
   * bounded sample of active questions. There is no dedicated aggregate
   * endpoint for either — reusing the existing list/search endpoint keeps
   * this a zero-backend-change feature. Capped at 1000 rows; fine for the
   * current bank size, but a real aggregate endpoint would be needed at scale.
   */
  async getFacets(): Promise<{
    topics: Array<{ tag: string; count: number }>;
    skills: Array<{ bloomLevel: string; count: number }>;
    sample: Question[];
  }> {
    const response = await api.get("/superadmin/question-bank?limit=1000");
    const rows: Question[] = response.data?.data || [];

    const tagCounts = new Map<string, number>();
    const bloomCounts = new Map<string, number>();

    for (const row of rows) {
      for (const tag of row.tags || []) {
        if (isSystemTag(tag)) continue;
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
      if (row.bloom_level) {
        bloomCounts.set(row.bloom_level, (bloomCounts.get(row.bloom_level) || 0) + 1);
      }
    }

    return {
      topics: [...tagCounts.entries()]
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count),
      skills: [...bloomCounts.entries()]
        .map(([bloomLevel, count]) => ({ bloomLevel, count }))
        .sort((a, b) => b.count - a.count),
      sample: rows,
    };
  }

  /**
   * Get review queue (pending AI questions)
   */
  async getReviewQueue(
    page = 1,
    limit = 50
  ): Promise<{ questions: AIQuestion[]; total: number }> {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      const response = await api.get(`/superadmin/review-queue?${params}`);
      const payload = response.data?.data || { questions: [], total: 0 };
      // Normalize raw question_bank rows into the review-queue view model.
      const questions: AIQuestion[] = (payload.questions || []).map((row: any) => {
        const options: string[] | undefined = row.options || undefined;
        const idx = Number(row.correct_answer);
        return {
          id: row.id,
          text: row.question_text,
          options,
          correctAnswer:
            options && Number.isInteger(idx) && options[idx] !== undefined
              ? options[idx]
              : row.correct_answer,
          explanation: row.explanation || undefined,
          category: row.category,
          difficulty: row.difficulty_level,
          source: (row.tags || []).includes("ai-generated") ? "AI Generated" : "Manual",
          generatedAt: row.created_at,
          status: row.status,
          quality_score: row.quality_score ?? 0,
          bloomLevel: row.bloom_level ?? null,
          tags: row.tags || [],
        };
      });
      return { questions, total: payload.total || 0 };
    } catch (error) {
      console.error("Failed to fetch review queue:", error);
      throw error;
    }
  }

  /**
   * Approve AI-generated question
   */
  async approveQuestion(id: string, note?: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await api.post(`/superadmin/review-queue/${id}/approve`, { note });
      return response.data;
    } catch (error) {
      console.error(`Failed to approve question ${id}:`, error);
      throw error;
    }
  }

  /**
   * Reject AI-generated question
   */
  async rejectQuestion(
    id: string,
    reason: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const response = await api.post(`/superadmin/review-queue/${id}/reject`, {
        reason,
      });
      return response.data;
    } catch (error) {
      console.error(`Failed to reject question ${id}:`, error);
      throw error;
    }
  }

  // ── AI Content Studio ──────────────────────────────────────────────────────
  // All of these wrap the SAME /qb-ai/* engine endpoints AIGeneratorPage has
  // always used directly — formalized here as reusable service methods so
  // Content Studio (and anything else) shares one upload/generate/import path
  // instead of duplicating it.

  /** Engine reachability + knowledge-base size. */
  async getEngineHealth(): Promise<EngineHealth> {
    const response = await api.get("/qb-ai/health");
    return response.data?.data || { online: false, engine: null };
  }

  /** Upload a source document (PDF/DOCX/TXT/MD) — chunked + embedded for RAG. */
  async uploadSourceDocument(file: File): Promise<{ chunks_created?: number; total_chunks?: number }> {
    const form = new FormData();
    form.append("file", file);
    const response = await api.post("/qb-ai/documents", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data?.data || {};
  }

  /**
   * Fetch a URL server-side and return its plain text — used to turn a
   * Website/GitHub source into a File the SAME uploadSourceDocument() call
   * can embed, without a second ingestion code path.
   */
  async fetchUrlAsText(url: string): Promise<{ text: string; title: string | null; sourceUrl: string }> {
    const response = await api.post("/qb-ai/fetch-url", { url });
    return response.data?.data;
  }

  /** Generate content grounded in the uploaded/fetched source (or ungrounded by topic alone). */
  async generateContent(params: {
    topic: string;
    difficulty: "easy" | "medium" | "hard" | "expert";
    questionType?: "multiple_choice" | "true_false" | "short_answer" | "flashcard" | "lesson" | "voice_lesson";
    count: number;
    useRag: boolean;
  }): Promise<GeneratedContentItem[]> {
    const response = await api.post("/qb-ai/generate", {
      topic: params.topic,
      difficulty: params.difficulty,
      question_type: params.questionType || "multiple_choice",
      count: params.count,
      use_rag: params.useRag,
    });
    return response.data?.data?.questions || [];
  }

  /** Publish reviewed AI-generated items into the question bank. */
  async importGeneratedContent(
    questions: Array<{
      question: string;
      options?: string[];
      correct_answer: string;
      explanation?: string;
      category: string;
      difficulty: "easy" | "medium" | "hard";
      tags?: string[];
      marks?: number;
    }>,
    collegeIds?: string[]
  ): Promise<{ success: boolean; message: string; data?: { imported: number; total: number } }> {
    const response = await api.post("/qb-ai/import", {
      questions,
      college_ids: collegeIds && collegeIds.length > 0 ? collegeIds : undefined,
    });
    return response.data;
  }

  // ── AI Content Items (Flashcards / Lessons / Voice Lessons) ─────────────
  // Non-question AI content shares the generate/review pipeline above but
  // stages into ai_content_items (not question_bank) and publishes into
  // flashcards or lessons depending on content_type.

  /** Stage reviewed flashcard/lesson/voice-lesson items for review. */
  async importContentItems(
    contentType: "flashcard" | "lesson" | "voice_lesson",
    items: Array<{ title: string; body: string; explanation?: string; category: string; difficulty: string; tags?: string[] }>
  ): Promise<{ success: boolean; message: string; data?: { imported: number; total: number } }> {
    const response = await api.post("/qb-ai/import-content", { content_type: contentType, items });
    return response.data;
  }

  async listContentItems(filters?: { content_type?: string; status?: string }): Promise<AIContentItem[]> {
    const response = await api.get("/qb-ai/content-items", { params: filters });
    return response.data?.data || [];
  }

  async approveContentItem(id: string): Promise<void> {
    await api.post(`/qb-ai/content-items/${id}/approve`);
  }

  async rejectContentItem(id: string, reason: string): Promise<void> {
    await api.post(`/qb-ai/content-items/${id}/reject`, { reason });
  }

  async publishContentItem(id: string, moduleId?: string): Promise<void> {
    await api.post(`/qb-ai/content-items/${id}/publish`, { module_id: moduleId });
  }

  // ── AI Review Center ─────────────────────────────────────────────────────
  // No dedicated duplicate-detection or regeneration endpoint exists — both
  // are built from the SAME search/generate/import endpoints already used
  // elsewhere, not a new backend surface.

  /**
   * Real duplicate check: full-text search the bank for the pending item's
   * own wording and score word-overlap against each hit client-side. Not a
   * fabricated "AI similarity score" — it's the same search index the rest
   * of the app already uses, with a transparent overlap metric on top.
   */
  async checkDuplicateRisk(
    questionId: string,
    text: string
  ): Promise<{ level: "low" | "medium" | "high"; matches: Array<{ id: string; question_text: string; overlap: number }> }> {
    const words = text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3);
    const keyPhrase = words.slice(0, 8).join(" ");
    if (!keyPhrase) return { level: "low", matches: [] };

    const wordSet = new Set(words);
    const { questions } = await this.searchQuestions({ search: keyPhrase, limit: 5 });

    const matches = questions
      .filter((q) => q.id !== questionId)
      .map((q) => {
        const candidateWords = q.question_text
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, " ")
          .split(/\s+/)
          .filter((w) => w.length > 3);
        const overlap =
          candidateWords.length === 0
            ? 0
            : candidateWords.filter((w) => wordSet.has(w)).length / candidateWords.length;
        return { id: q.id, question_text: q.question_text, overlap: Math.round(overlap * 100) };
      })
      .filter((m) => m.overlap >= 30)
      .sort((a, b) => b.overlap - a.overlap);

    const level = matches.some((m) => m.overlap >= 70) ? "high" : matches.length > 0 ? "medium" : "low";
    return { level, matches };
  }

  /**
   * Regenerate a pending item: ask the engine for one fresh replacement using
   * the item's own text as the topic seed, publish it as a new pending item
   * (same pipeline as Content Studio), and leave rejecting the original to
   * the caller — regenerate never silently deletes what it's replacing.
   */
  async regenerateItem(item: {
    text: string;
    category: string;
    difficulty: "easy" | "medium" | "hard";
  }): Promise<GeneratedContentItem | null> {
    const topic = item.text.split(/\s+/).slice(0, 12).join(" ");
    const results = await this.generateContent({
      topic,
      difficulty: item.difficulty,
      questionType: "multiple_choice",
      count: 1,
      useRag: false,
    });
    if (results.length === 0) return null;
    const fresh = results[0];
    const importResult = await this.importGeneratedContent([
      {
        question: fresh.question,
        options: fresh.options,
        correct_answer: fresh.correct_answer,
        explanation: fresh.explanation,
        category: item.category,
        difficulty: item.difficulty,
        tags: ["ai-generated", "regenerated"],
        marks: 1,
      },
    ]);
    // The import endpoint can report success while importing 0 rows (per-row
    // failures are swallowed server-side) — only report a replacement as
    // real if it was actually persisted, so callers don't reject the
    // original for a replacement that never saved.
    if ((importResult.data?.imported ?? 0) < 1) return null;
    return fresh;
  }
}

export default new QuestionBankService();
