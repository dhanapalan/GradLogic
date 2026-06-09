/**
 * ASSESSMENT module — public interface.
 *
 * Covers: assessment rule templates, question bank, drive pool generation.
 */

export {
  listRules,
  getRuleById,
  createRule,
  updateRule,
  archiveRule,
  createVersion,
  listVersions,
} from "../../services/assessmentRule.service.js";

export {
  filterQuestions,
  getQuestionById,
  createQuestion,
  updateQuestion,
  deactivateQuestion,
  deleteQuestion,
  findSimilarQuestions,
} from "../../services/questionBank.service.js";
