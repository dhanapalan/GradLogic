/**
 * AI / INTELLIGENCE module — public interface.
 *
 * Single entry point for all AI capabilities: generation, embeddings, search.
 *
 * Risk gate reminder (architecture doc §8):
 *   riskLevel: "draft"   → question generation, matching — must go to review queue
 *   riskLevel: "practice" → tutor, practice questions — can run autonomously
 *   riskLevel: "graded"  → anything affecting a score/decision — human-in-loop required
 */

export { generate, generateJSON, embed } from "../../services/ai.service.js";
export { generateAssessment, generateDynamicAssessment } from "../../services/llm.service.js";
export { findSimilarQuestions } from "../../services/questionBank.service.js";
