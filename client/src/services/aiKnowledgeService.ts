import api from "../lib/api";

// =============================================================================
// AI Knowledge Engine (Phase 5) — client wrapper over /api/ai-knowledge/*.
// Every call returns structured, backend-validated JSON. This service never
// writes question_bank itself — persisting a result is the caller's job via
// questionBankService's existing create/update methods.
// =============================================================================

export interface ExplainResult {
  explanation: string;
  keyPoints: string[];
  requiresReview: boolean;
}

export interface SummarizeResult {
  summary: string;
  requiresReview: boolean;
}

export interface ImproveResult {
  improved: string;
  changes: string[];
  requiresReview: boolean;
}

export interface GenerateItemsResult {
  items: string[];
  requiresReview: boolean;
}

export interface TranslateResult {
  translated: string;
  requiresReview: boolean;
}

export interface RecommendResult {
  recommendations: Array<{ title: string; reason: string }>;
  requiresReview: boolean;
}

export interface ValidateResult {
  valid: boolean;
  issues: string[];
  requiresReview: boolean;
}

export interface DifficultyResult {
  difficulty: "easy" | "medium" | "hard";
  confidence: number;
  rationale?: string;
  requiresReview: boolean;
}

export interface BloomResult {
  bloomLevel: "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create";
  confidence: number;
  requiresReview: boolean;
}

export interface SkillExtractionResult {
  skills: string[];
  requiresReview: boolean;
}

class AiKnowledgeService {
  async explain(content: string, audience?: string): Promise<ExplainResult> {
    const res = await api.post("/ai-knowledge/explain", { content, audience });
    return res.data.data;
  }

  async summarize(content: string, maxWords?: number): Promise<SummarizeResult> {
    const res = await api.post("/ai-knowledge/summarize", { content, maxWords });
    return res.data.data;
  }

  async improve(content: string, focus?: string): Promise<ImproveResult> {
    const res = await api.post("/ai-knowledge/improve", { content, focus });
    return res.data.data;
  }

  async generateItems(instruction: string, count = 3): Promise<GenerateItemsResult> {
    const res = await api.post("/ai-knowledge/generate", { instruction, count });
    return res.data.data;
  }

  async translate(content: string, targetLanguage: string): Promise<TranslateResult> {
    const res = await api.post("/ai-knowledge/translate", { content, targetLanguage });
    return res.data.data;
  }

  async recommend(context: string, count = 5): Promise<RecommendResult> {
    const res = await api.post("/ai-knowledge/recommend", { context, count });
    return res.data.data;
  }

  async validate(content: string, criteria?: string): Promise<ValidateResult> {
    const res = await api.post("/ai-knowledge/validate", { content, criteria });
    return res.data.data;
  }

  async predictDifficulty(questionText: string): Promise<DifficultyResult> {
    const res = await api.post("/ai-knowledge/difficulty", { questionText });
    return res.data.data;
  }

  async classifyBloom(questionText: string): Promise<BloomResult> {
    const res = await api.post("/ai-knowledge/bloom", { questionText });
    return res.data.data;
  }

  async extractSkills(content: string): Promise<SkillExtractionResult> {
    const res = await api.post("/ai-knowledge/skills", { content });
    return res.data.data;
  }
}

export default new AiKnowledgeService();
