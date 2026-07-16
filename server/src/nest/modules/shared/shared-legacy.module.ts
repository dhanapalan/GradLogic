/**
 * SHARED legacy module — mounts remaining Express routers unchanged.
 * Covers: /api/analytics, /api/admin, /api/audit-logs, /api/notifications,
 *         /api/gamification, /api/mentor, /api/mock-interviews,
 *         /api/development, /api/skills, /api/roles, /api/cheating,
 *         /api/billing, /api/qb-ai, /api/ai-knowledge, /api/assessment-hub,
 *         /api/question-collections, /api/platform/proctoring
 * TODO: Port each to a full NestJS controller in a follow-up.
 */
import { Module, MiddlewareConsumer, NestModule } from "@nestjs/common";
import analyticsRoutes from "../../../routes/analytics.routes.js";
import adminRoutes from "../../../routes/admin.routes.js";
import auditLogRoutes from "../../../routes/auditLog.routes.js";
import notificationRoutes from "../../../routes/notification.routes.js";
import gamificationRoutes from "../../../routes/gamification.routes.js";
import mentorRoutes from "../../../routes/mentor.routes.js";
import mockInterviewRoutes from "../../../routes/mockInterview.routes.js";
import developmentRoutes from "../../../routes/development.routes.js";
import skillsRoutes from "../../../routes/skills.routes.js";
import roleRoutes from "../../../routes/role.routes.js";
import cheatingRoutes from "../../../routes/cheating.routes.js";
import billingRoutes from "../../../routes/billing.routes.js";
import questionBankAIRoutes from "../../../routes/questionBankAI.routes.js";
import aiKnowledgeEngineRoutes from "../../../routes/aiKnowledgeEngine.routes.js";
import voiceTutorRoutes from "../../../routes/voiceTutor.routes.js";
import adaptiveLearningRoutes from "../../../routes/adaptiveLearning.routes.js";
import placementCoachRoutes from "../../../routes/placementCoach.routes.js";
import aiSearchRoutes from "../../../routes/aiSearch.routes.js";
import aiAnalyticsRoutes from "../../../routes/aiAnalytics.routes.js";
import knowledgeGraphRoutes from "../../../routes/knowledgeGraph.routes.js";
import contentImproverRoutes from "../../../routes/contentImprover.routes.js";
import translatorRoutes from "../../../routes/translator.routes.js";
import learningCompanionRoutes from "../../../routes/learningCompanion.routes.js";
import assessmentHubRoutes from "../../../routes/assessmentHub.routes.js";
import questionCollectionsRoutes from "../../../routes/questionCollections.routes.js";
import platformProctoringRoutes from "../../../routes/platformProctoring.routes.js";
import { applyLegacyRouter } from "../../utils/legacy-router.middleware.js";

@Module({})
export class SharedLegacyModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    applyLegacyRouter(consumer, analyticsRoutes, "/api/analytics");
    applyLegacyRouter(consumer, adminRoutes, "/api/admin");
    applyLegacyRouter(consumer, auditLogRoutes, "/api/audit-logs");
    applyLegacyRouter(consumer, notificationRoutes, "/api/notifications");
    applyLegacyRouter(consumer, gamificationRoutes, "/api/gamification");
    applyLegacyRouter(consumer, mentorRoutes, "/api/mentors");
    applyLegacyRouter(consumer, mockInterviewRoutes, "/api/mock-interviews");
    applyLegacyRouter(consumer, developmentRoutes, "/api/development");
    applyLegacyRouter(consumer, skillsRoutes, "/api/skills");
    applyLegacyRouter(consumer, roleRoutes, "/api/roles");
    applyLegacyRouter(consumer, cheatingRoutes, "/api/cheating");
    applyLegacyRouter(consumer, billingRoutes, "/api/billing");
    applyLegacyRouter(consumer, questionBankAIRoutes, "/api/qb-ai");
    applyLegacyRouter(consumer, aiKnowledgeEngineRoutes, "/api/ai-knowledge");
    applyLegacyRouter(consumer, voiceTutorRoutes, "/api/voice-tutor");
    applyLegacyRouter(consumer, adaptiveLearningRoutes, "/api/adaptive-learning");
    applyLegacyRouter(consumer, placementCoachRoutes, "/api/placement-coach");
    applyLegacyRouter(consumer, aiSearchRoutes, "/api/ai-search");
    applyLegacyRouter(consumer, aiAnalyticsRoutes, "/api/ai-analytics");
    applyLegacyRouter(consumer, knowledgeGraphRoutes, "/api/knowledge-graph");
    applyLegacyRouter(consumer, contentImproverRoutes, "/api/content-improver");
    applyLegacyRouter(consumer, translatorRoutes, "/api/translator");
    applyLegacyRouter(consumer, learningCompanionRoutes, "/api/learning-companion");
    applyLegacyRouter(consumer, assessmentHubRoutes, "/api/assessment-hub");
    applyLegacyRouter(consumer, questionCollectionsRoutes, "/api/question-collections");
    applyLegacyRouter(consumer, platformProctoringRoutes, "/api/platform/proctoring");
  }
}
