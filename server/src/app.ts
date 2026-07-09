import express from "express";
import cors from "cors";
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
import collegeDashboardRoutes from "./routes/college.dashboard.routes.js";
import questionBankRoutes from "./routes/questionBank.routes.js";
import campusRoutes from "./routes/campus.routes.js";
import campusStudentRoutes from "./routes/campus.students.routes.js";
import campusDrivesRoutes from "./routes/campus.drives.routes.js";
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
import collegeSkillsRoutes from "./routes/collegeSkills.routes.js";
import mockInterviewRoutes from "./routes/mockInterview.routes.js";
import companyRoutes from "./routes/company.routes.js";
import billingRoutes from "./routes/billing.routes.js";
import questionBankAIRoutes from "./routes/questionBankAI.routes.js";
import superadminRoutes from "./routes/superadmin.routes.js";
import collegeModulesRoutes from "./routes/college.modules.routes.js";

const app = express();

// ── Security ─────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || env.CLIENT_URLS.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
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
app.use("/api/students", studentRoutes);
app.use("/api/cheating-logs", cheatingRoutes);
app.use("/api/exams", examRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/colleges", collegeRoutes);
app.use("/api/college/dashboard", collegeDashboardRoutes);
app.use("/api/college/modules", collegeModulesRoutes);
app.use("/api/campuses", campusRoutes);
app.use("/api/campus/students", campusStudentRoutes);
app.use("/api/campus/drives", campusDrivesRoutes);
app.use("/api/hr", hrRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/users", userRoutes);
app.use("/api/audit-logs", auditLogRoutes);
app.use("/api/question-bank", questionBankRoutes);
app.use("/api/segmentation", segmentationRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/assessment-rules", assessmentRuleRoutes);
app.use("/api/drives", driveRoutes);
app.use("/api/exam-sessions", examSessionRoutes);
app.use("/api/proctoring", proctoringRoutes);
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
app.use("/api/college-skills", collegeSkillsRoutes);
app.use("/api/mock-interviews", mockInterviewRoutes);
app.use("/api/company", companyRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/qb-ai", questionBankAIRoutes);
// ── SuperAdmin Portal ─────────────────────────────────────────────────────────
app.use("/api/superadmin", superadminRoutes);

// ── Error Handling ───────────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
