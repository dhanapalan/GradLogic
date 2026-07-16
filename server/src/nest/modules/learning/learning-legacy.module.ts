/**
 * LEARNING legacy module — mounts existing Express routers unchanged.
 * Covers: /api/lms, /api/learning-modules, /api/skill-programs,
 *         /api/skill-partners, /api/student-learning, /api/student-assessments,
 *         /api/practice, /api/course-builder, /api/course-catalog, /api/learning-journey
 * TODO: Port each to a full NestJS controller in a follow-up.
 */
import { Module, MiddlewareConsumer, NestModule } from "@nestjs/common";
import lmsRoutes from "../../../routes/lms.routes.js";
import learningModulesRoutes from "../../../routes/learningModules.routes.js";
import skillProgramsRoutes from "../../../routes/skillPrograms.routes.js";
import skillPartnersRoutes from "../../../routes/skillPartners.routes.js";
import studentLearningRoutes from "../../../routes/studentLearning.routes.js";
import studentAssessmentsRoutes from "../../../routes/studentAssessments.routes.js";
import assessmentWorkspaceRoutes from "../../../routes/assessmentWorkspace.routes.js";
import studentResultsRoutes from "../../../routes/studentResults.routes.js";
import studentQuestionsRoutes from "../../../routes/studentQuestions.routes.js";
import studentAiCoachRoutes from "../../../routes/studentAiCoach.routes.js";
import practiceRoutes from "../../../routes/practice.routes.js";
import courseBuilderRoutes from "../../../routes/courseBuilder.routes.js";
import courseCatalogRoutes from "../../../routes/courseCatalog.routes.js";
import learningJourneyRoutes from "../../../routes/learningJourney.routes.js";
import {
  dashboardRouter,
  assessmentsDashboardRouter,
  learningDashboardRouter,
  recommendationsRouter,
  campusDrivesStudentRouter,
  achievementsRouter,
  calendarRouter,
} from "../../../routes/studentDashboard.routes.js";
import { applyLegacyRouter } from "../../utils/legacy-router.middleware.js";

@Module({})
export class LearningLegacyModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    applyLegacyRouter(consumer, lmsRoutes, "/api/lms");
    applyLegacyRouter(consumer, learningModulesRoutes, "/api/learning-modules");
    applyLegacyRouter(consumer, skillProgramsRoutes, "/api/skill-programs");
    applyLegacyRouter(consumer, skillPartnersRoutes, "/api/skill-partners");
    applyLegacyRouter(consumer, studentLearningRoutes, "/api/student-learning");
    applyLegacyRouter(consumer, studentAssessmentsRoutes, "/api/student-assessments");
    applyLegacyRouter(consumer, assessmentWorkspaceRoutes, "/api/assessment-workspace");
    applyLegacyRouter(consumer, studentResultsRoutes, "/api/results");
    applyLegacyRouter(consumer, studentQuestionsRoutes, "/api/questions");
    applyLegacyRouter(consumer, studentAiCoachRoutes, "/api/ai");
    applyLegacyRouter(consumer, practiceRoutes, "/api/practice");
    applyLegacyRouter(consumer, courseBuilderRoutes, "/api/course-builder");
    applyLegacyRouter(consumer, courseCatalogRoutes, "/api/course-catalog");
    applyLegacyRouter(consumer, learningJourneyRoutes, "/api/learning-journey");
    // Student Portal Module 02 — dashboard facade
    applyLegacyRouter(consumer, dashboardRouter, "/api/dashboard");
    applyLegacyRouter(consumer, assessmentsDashboardRouter, "/api/assessments");
    applyLegacyRouter(consumer, learningDashboardRouter, "/api/learning");
    applyLegacyRouter(consumer, recommendationsRouter, "/api/recommendations");
    applyLegacyRouter(consumer, campusDrivesStudentRouter, "/api/campus-drives");
    applyLegacyRouter(consumer, achievementsRouter, "/api/achievements");
    applyLegacyRouter(consumer, calendarRouter, "/api/calendar");
  }
}
