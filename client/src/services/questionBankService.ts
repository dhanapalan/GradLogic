import api from "../lib/api";

// Mirrors the question_bank row shape returned by the API.
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
}

export interface QuestionSearchFilters {
  search?: string;
  category?: string;
  type?: string;
  difficulty?: string;
  bloomLevel?: string;
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
   * Count questions carrying a tag (used to detect already-imported packs)
   */
  async countByTag(tag: string): Promise<number> {
    const response = await api.get(
      `/superadmin/question-bank?tags=${encodeURIComponent(tag)}&limit=1`
    );
    return response.data?.meta?.total ?? (response.data?.data?.length || 0);
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
}

export default new QuestionBankService();
