/**
 * CAMPUS legacy module — mounts existing Express routers unchanged.
 * Paths mirror server/src/app.ts so Nest and legacy bootstraps stay aligned.
 */
import { Module, MiddlewareConsumer, NestModule } from "@nestjs/common";
import campusRoutes from "../../../routes/campus.routes.js";
import collegeRoutes from "../../../routes/college.routes.js";
import collegeDashboardRoutes from "../../../routes/college.dashboard.routes.js";
import collegeProfileRoutes from "../../../routes/college.profile.routes.js";
import collegeModulesRoutes from "../../../routes/college.modules.routes.js";
import campusStudentRoutes from "../../../routes/campus.students.routes.js";
import campusQuestionsRoutes from "../../../routes/campus.questions.routes.js";
import campusDepartmentsRoutes from "../../../routes/campus.departments.routes.js";
import campusEvaluationRollupRoutes from "../../../routes/campus.evaluationRollup.routes.js";
import campusAssessmentsRoutes from "../../../routes/campus.assessments.routes.js";
import campusCampaignsRoutes from "../../../routes/campus.campaigns.routes.js";
import campusAssessmentAnalyticsRoutes from "../../../routes/campus.assessmentAnalytics.routes.js";
import campusDrivesRoutes from "../../../routes/campus.drives.routes.js";
import collegeSkillsRoutes from "../../../routes/collegeSkills.routes.js";
import { applyLegacyRouter } from "../../utils/legacy-router.middleware.js";

@Module({})
export class CampusLegacyModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // More specific /api/campus/* mounts first (before any bare /api/campus catch-alls)
    applyLegacyRouter(consumer, campusStudentRoutes, "/api/campus/students");
    applyLegacyRouter(consumer, campusQuestionsRoutes, "/api/campus/questions");
    applyLegacyRouter(consumer, campusDepartmentsRoutes, "/api/campus/departments");
    applyLegacyRouter(consumer, campusEvaluationRollupRoutes, "/api/campus/evaluation");
    applyLegacyRouter(consumer, campusAssessmentsRoutes, "/api/campus/assessments");
    applyLegacyRouter(consumer, campusCampaignsRoutes, "/api/campus/campaigns");
    applyLegacyRouter(consumer, campusAssessmentAnalyticsRoutes, "/api/campus/assessment-analytics");
    applyLegacyRouter(consumer, campusDrivesRoutes, "/api/campus/drives");

    // Super-admin campus CRUD lives at /api/campuses (not /api/campus)
    applyLegacyRouter(consumer, campusRoutes, "/api/campuses");
    applyLegacyRouter(consumer, collegeRoutes, "/api/colleges");
    applyLegacyRouter(consumer, collegeDashboardRoutes, "/api/college/dashboard");
    applyLegacyRouter(consumer, collegeProfileRoutes, "/api/college/profile");
    applyLegacyRouter(consumer, collegeModulesRoutes, "/api/college/modules");
    applyLegacyRouter(consumer, collegeSkillsRoutes, "/api/college-skills");
  }
}
