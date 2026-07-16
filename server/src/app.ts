import express from "express";
import cors from "cors";
import { corsOriginDelegate } from "./config/corsOrigins.js";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { notFoundHandler } from "./middleware/notFoundHandler.js";

// Route imports
import authRoutes from "./routes/auth.routes.js";
import studentRoutes from "./routes/student.routes.js";
import cheatingRoutes from "./routes/cheating.routes.js";
import examRoutes from "./routes/exam.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import collegeRoutes from "./routes/college.routes.js";
import collegeProfileRoutes from "./routes/college.profile.routes.js";
import collegeDashboardRoutes from "./routes/college.dashboard.routes.js";
import questionBankRoutes from "./routes/questionBank.routes.js";
import questionCollectionsRoutes from "./routes/questionCollections.routes.js";
import campusRoutes from "./routes/campus.routes.js";
import campusStudentRoutes from "./routes/campus.students.routes.js";
import campusQuestionsRoutes from "./routes/campus.questions.routes.js";
import campusAssessmentsRoutes from "./routes/campus.assessments.routes.js";
import campusCampaignsRoutes from "./routes/campus.campaigns.routes.js";
import campusAssessmentAnalyticsRoutes from "./routes/campus.assessmentAnalytics.routes.js";
import campusDrivesRoutes from "./routes/campus.drives.routes.js";
import sessionsRoutes from "./routes/sessions.routes.js";
import hrRoutes from "./routes/hr.routes.js";
import roleRoutes from "./routes/role.routes.js";
import userRoutes from "./routes/user.routes.js";
import auditLogRoutes from "./routes/auditLog.routes.js";
import segmentationRoutes from "./routes/segmentation.routes.js";
import analyticsRoutes from "./routes/analytics.routes.js";
import assessmentRuleRoutes from "./routes/assessmentRule.routes.js";
import driveRoutes from "./routes/drive.routes.js";
import examSessionRoutes from "./routes/examSession.routes.js";
import { proctoringRoutes } from "./routes/proctoring.routes.js";
import platformProctoringRoutes from "./routes/platformProctoring.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import lmsRoutes from "./routes/lms.routes.js";
import practiceRoutes from "./routes/practice.routes.js";
import developmentRoutes from "./routes/development.routes.js";
import gamificationRoutes from "./routes/gamification.routes.js";
import mentorRoutes from "./routes/mentor.routes.js";
import placementRoutes from "./routes/placement.routes.js";
import skillsRoutes from "./routes/skills.routes.js";
import learningModulesRoutes from "./routes/learningModules.routes.js";
import skillProgramsRoutes from "./routes/skillPrograms.routes.js";
import skillPartnersRoutes from "./routes/skillPartners.routes.js";
import studentLearningRoutes from "./routes/studentLearning.routes.js";
import studentAssessmentsRoutes from "./routes/studentAssessments.routes.js";
import assessmentWorkspaceRoutes from "./routes/assessmentWorkspace.routes.js";
import studentResultsRoutes from "./routes/studentResults.routes.js";
import studentQuestionsRoutes from "./routes/studentQuestions.routes.js";
import studentAiCoachRoutes from "./routes/studentAiCoach.routes.js";
import {
  dashboardRouter,
  assessmentsDashboardRouter,
  learningDashboardRouter,
  recommendationsRouter,
  campusDrivesStudentRouter,
  achievementsRouter,
  calendarRouter,
} from "./routes/studentDashboard.routes.js";
import collegeSkillsRoutes from "./routes/collegeSkills.routes.js";
import mockInterviewRoutes from "./routes/mockInterview.routes.js";
import companyRoutes from "./routes/company.routes.js";
import billingRoutes from "./routes/billing.routes.js";
import questionBankAIRoutes from "./routes/questionBankAI.routes.js";
import aiKnowledgeEngineRoutes from "./routes/aiKnowledgeEngine.routes.js";
import voiceTutorRoutes from "./routes/voiceTutor.routes.js";
import adaptiveLearningRoutes from "./routes/adaptiveLearning.routes.js";
import placementCoachRoutes from "./routes/placementCoach.routes.js";
import aiSearchRoutes from "./routes/aiSearch.routes.js";
import aiAnalyticsRoutes from "./routes/aiAnalytics.routes.js";
import knowledgeGraphRoutes from "./routes/knowledgeGraph.routes.js";
import contentImproverRoutes from "./routes/contentImprover.routes.js";
import translatorRoutes from "./routes/translator.routes.js";
import learningCompanionRoutes from "./routes/learningCompanion.routes.js";
import superadminFeaturesRoutes from "./routes/superadminFeatures.routes.js";
import knowledgeTaxonomyRoutes from "./routes/knowledgeTaxonomy.routes.js";
import knowledgeLibraryAiRoutes from "./routes/knowledgeLibraryAi.routes.js";
import knowledgeLibraryEnterpriseRoutes from "./routes/knowledgeLibraryEnterprise.routes.js";
import courseBuilderRoutes from "./routes/courseBuilder.routes.js";
import courseCatalogRoutes from "./routes/courseCatalog.routes.js";
import learningJourneyRoutes from "./routes/learningJourney.routes.js";
import assessmentHubRoutes from "./routes/assessmentHub.routes.js";
import superadminRoutes from "./routes/superadmin.routes.js";
import collegeModulesRoutes from "./routes/college.modules.routes.js";

const app = express();

// ── Security ─────────────────────────────────────────────────────────────────
// cross-origin: SPA on gradlogic.* calls API on api.gradlogic.* (Socket.IO + XHR)
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  })
);
app.use(
  cors({
    origin: corsOriginDelegate,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  }),
);

// ── Rate Limiting ────────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});

// Strict limiter for auth endpoints — prevents brute-force credential attacks
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please try again in 15 minutes." },
  skipSuccessfulRequests: true, // only count failed attempts
});

// Allow test environments to explicitly opt out while keeping rate limiting on by default.
if (!env.DISABLE_RATE_LIMIT) {
  app.use("/api/auth/login", authLimiter);
  app.use("/api/auth/microsoft", authLimiter);
  app.use("/api/", limiter);
}

// ── Body Parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ── Logging ──────────────────────────────────────────────────────────────────
if (env.NODE_ENV !== "test") {
  app.use(morgan("short"));
}

// ── Health Check ─────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({
    status: "healthy",
    service: "GradLogic API",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

// ── API Routes ───────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/sessions", sessionsRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/cheating-logs", cheatingRoutes);
app.use("/api/exams", examRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/colleges", collegeRoutes);
app.use("/api/college/profile", collegeProfileRoutes);
app.use("/api/college/dashboard", collegeDashboardRoutes);
app.use("/api/college/modules", collegeModulesRoutes);
app.use("/api/campuses", campusRoutes);
app.use("/api/campus/students", campusStudentRoutes);
app.use("/api/campus/questions", campusQuestionsRoutes);
app.use("/api/campus/assessments", campusAssessmentsRoutes);
app.use("/api/campus/campaigns", campusCampaignsRoutes);
app.use("/api/campus/assessment-analytics", campusAssessmentAnalyticsRoutes);
app.use("/api/campus/drives", campusDrivesRoutes);
app.use("/api/hr", hrRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/users", userRoutes);
app.use("/api/audit-logs", auditLogRoutes);
app.use("/api/question-bank", questionBankRoutes);
app.use("/api/question-collections", questionCollectionsRoutes);
app.use("/api/segmentation", segmentationRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/assessment-rules", assessmentRuleRoutes);
app.use("/api/drives", driveRoutes);
app.use("/api/exam-sessions", examSessionRoutes);
app.use("/api/proctoring", proctoringRoutes);
app.use("/api/platform/proctoring", platformProctoringRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/lms", lmsRoutes);
app.use("/api/practice", practiceRoutes);
app.use("/api/development", developmentRoutes);
app.use("/api/gamification", gamificationRoutes);
app.use("/api/mentor", mentorRoutes);
app.use("/api/placements", placementRoutes);
// ── Skill Development Layer ───────────────────────────────────────────────────
app.use("/api/skills", skillsRoutes);
app.use("/api/learning-modules", learningModulesRoutes);
app.use("/api/skill-programs", skillProgramsRoutes);
app.use("/api/skill-partners", skillPartnersRoutes);
app.use("/api/student-learning", studentLearningRoutes);
app.use("/api/student-assessments", studentAssessmentsRoutes);
app.use("/api/assessment-workspace", assessmentWorkspaceRoutes);
// Student Portal Module 07 — Results & Performance Analytics
app.use("/api/results", studentResultsRoutes);
app.use("/api/questions", studentQuestionsRoutes);
// Student Portal Module 08 — AI Learning Coach
app.use("/api/ai", studentAiCoachRoutes);
// Student Portal Module 02 — dashboard facade (thin adapters)
app.use("/api/dashboard", dashboardRouter);
app.use("/api/assessments", assessmentsDashboardRouter);
app.use("/api/learning", learningDashboardRouter);
app.use("/api/recommendations", recommendationsRouter);
app.use("/api/campus-drives", campusDrivesStudentRouter);
app.use("/api/achievements", achievementsRouter);
app.use("/api/calendar", calendarRouter);
app.use("/api/college-skills", collegeSkillsRoutes);
app.use("/api/mock-interviews", mockInterviewRoutes);
app.use("/api/company", companyRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/qb-ai", questionBankAIRoutes);
app.use("/api/ai-knowledge", aiKnowledgeEngineRoutes);
app.use("/api/voice-tutor", voiceTutorRoutes);
app.use("/api/adaptive-learning", adaptiveLearningRoutes);
app.use("/api/placement-coach", placementCoachRoutes);
app.use("/api/ai-search", aiSearchRoutes);
app.use("/api/ai-analytics", aiAnalyticsRoutes);
app.use("/api/knowledge-graph", knowledgeGraphRoutes);
app.use("/api/content-improver", contentImproverRoutes);
app.use("/api/translator", translatorRoutes);
app.use("/api/learning-companion", learningCompanionRoutes);
app.use("/api/superadmin-features", superadminFeaturesRoutes);
app.use("/api/knowledge-taxonomy", knowledgeTaxonomyRoutes);
app.use("/api/knowledge-library-ai", knowledgeLibraryAiRoutes);
app.use("/api/knowledge-library-enterprise", knowledgeLibraryEnterpriseRoutes);
app.use("/api/course-builder", courseBuilderRoutes);
app.use("/api/course-catalog", courseCatalogRoutes);
app.use("/api/learning-journey", learningJourneyRoutes);
app.use("/api/assessment-hub", assessmentHubRoutes);
// ── SuperAdmin Portal ─────────────────────────────────────────────────────────
app.use("/api/superadmin", superadminRoutes);

// ── Error Handling ───────────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
