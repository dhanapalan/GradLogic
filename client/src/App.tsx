import { Suspense, lazy } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import { useAuthStore } from "./stores/authStore";
import {
  ProtectedRoute,
  RoleGuard,
  getLandingPath,
} from "./components/ProtectedRoute";
import { CollegeLegacyFeatureGuard } from "./components/CollegeLegacyFeatureGuard";
import { StudentFeatureGuard } from "./components/FeatureGuard";
import { PermissionGuard } from "./components/PermissionGuard";

// ── Layouts ──────────────────────────────────────────────────────────────────
import PublicLayout from "./layouts/PublicLayout";
const SuperAdminLayout = lazy(() => import("./pages/superadmin/SuperAdminLayout"));
const CollegeLayout = lazy(() => import("./layouts/CollegeLayout"));

// ── Public pages (eagerly loaded for fast initial paint) ─────────────────────
import LandingPage from "./pages/public/LandingPage";
import PricingPage from "./pages/public/PricingPage";
import AboutPage from "./pages/public/AboutPage";
import ContactPage from "./pages/public/ContactPage";
import CampusPage from "./pages/public/CampusPage";
import CampusContactPage from "./pages/public/CampusContactPage";
import PrivacyPage from "./pages/public/PrivacyPage";
import TermsPage from "./pages/public/TermsPage";
import NotFoundPage from "./pages/NotFoundPage";

// ── Lazy-loaded routes ────────────────────────────────────────────────────────
const DashboardLayout = lazy(() => import("./layouts/DashboardLayout"));
const AuthLayout = lazy(() => import("./layouts/AuthLayout"));

const LoginPage = lazy(() => import("./pages/auth/LoginPage"));
const RegisterPage = lazy(() => import("./pages/auth/RegisterPage"));
const PasswordSetupPage = lazy(() => import("./pages/auth/PasswordSetupPage"));
const MicrosoftCallback = lazy(() => import("./pages/auth/MicrosoftCallback"));
const ForgotPasswordPage = lazy(() => import("./pages/auth/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./pages/auth/ResetPasswordPage"));
const AuthChangePasswordPage = lazy(() => import("./pages/auth/ChangePasswordPage"));
const TwoFactorLoginPage = lazy(() => import("./pages/auth/TwoFactorLoginPage"));
const SecurityPage = lazy(() => import("./pages/settings/SecurityPage"));

const HRDashboardPage = lazy(() => import("./pages/hr/HRDashboardPage"));
const EngineerPanelPage = lazy(() => import("./pages/engineer/EngineerPanelPage"));
const CXOAnalyticsPage = lazy(() => import("./pages/cxo/CXOAnalyticsPage"));
const CampusDrivesListPage = lazy(() => import("./pages/college/DrivesListPage"));
const CampusDriveDetailPage = lazy(() => import("./pages/college/DriveDetailPage"));
const CampusResultsPage = lazy(() => import("./pages/college/ResultsPage"));
const CampusInsightsPage = lazy(() => import("./pages/college/InsightsPage"));
const CampusIntegrityPage = lazy(() => import("./pages/college/IntegrityPage"));
const CampusCommunicationsPage = lazy(() => import("./pages/college/CommunicationsPage"));
const CampusAdminsPage = lazy(() => import("./pages/college/CampusAdminsPage"));
const CampusSettingsPage = lazy(() => import("./pages/college/SettingsPage"));
const BillingPage = lazy(() => import("./pages/college/BillingPage"));
const CollegePortalDashboard = lazy(() => import("./pages/college-portal/DashboardPage"));
const CollegePortalStudents = lazy(() => import("./pages/college-portal/StudentsPage"));
const CollegePortalStudentDetail = lazy(() => import("./pages/college-portal/StudentDetailPage"));
const CollegePortalAnalytics = lazy(() => import("./pages/college-portal/AnalyticsPage"));
const CollegePortalComingSoon = lazy(() => import("./pages/college-portal/ComingSoonPage"));
const LmsModulePage = lazy(() => import("./pages/lms/LmsModulePage"));
const StudentPaymentsPage = lazy(() => import("./pages/student/PaymentsPage"));
const StudentQuestionBankPage = lazy(() => import("./pages/student/QuestionBankPage"));
const StudentWorkflowPage = lazy(() => import("./pages/student/WorkflowPage"));
const StudentPortalLayout = lazy(() => import("./layouts/StudentPortalLayout"));
const StudentDashboardPage = lazy(() => import("./pages/student/portal/DashboardPage"));
const StudentTestsPage = lazy(() => import("./pages/student/portal/TestsPage"));
const StudentNotificationsPage = lazy(() => import("./pages/student/portal/NotificationsPage"));
const StudentLearnPage = lazy(() => import("./pages/student/portal/LearnPage"));
const CampusListPage = lazy(() => import("./pages/hr/CampusListPage"));
const CampusDetailPage = lazy(() => import("./pages/hr/CampusDetailPage"));
const PendingApprovalsPage = lazy(() => import("./pages/hr/PendingApprovalsPage"));
const DashboardPage = lazy(() => import("./pages/dashboard/DashboardPage"));

const StudentListPage = lazy(() => import("./pages/students/StudentListPage"));
const StudentDetailPage = lazy(() => import("./pages/students/StudentDetailPage"));
const BulkImportStudentsPage = lazy(() => import("./pages/students/BulkImportStudentsPage"));

const AdministrativePanel = lazy(() => import("./pages/admin/AdministrativePanel"));
const ChangePasswordPage = lazy(() => import("./pages/admin/ChangePasswordPage"));

const AssessmentStudioPage = lazy(() => import("./pages/assessments/AssessmentStudioPage"));
const AssessmentTakePage = lazy(() => import("./pages/assessments/AssessmentTakePage"));
const QuestionWizard = lazy(() => import("./pages/assessments/QuestionWizard"));
const CodeEditor = lazy(() => import("./pages/assessments/CodeEditor"));
const AssessmentBlueprintWizard = lazy(() => import("./pages/assessments/AssessmentBlueprintWizard"));
const ExamQuestionsPage = lazy(() => import("./pages/assessments/ExamQuestionsPage"));

const SegmentationPage = lazy(() => import("./pages/segmentation/SegmentationPage"));
const ProctoringMonitorPage = lazy(() => import("./pages/proctoring/ProctoringMonitorPage"));
const AnalyticsPage = lazy(() => import("./pages/analytics/AnalyticsPage"));

const LiveMonitoringDashboard = lazy(() => import("./pages/admin/LiveMonitoringDashboard"));
const StudentSessionDetail = lazy(() => import("./pages/admin/StudentSessionDetail"));

const RuleDashboardPage = lazy(() => import("./pages/assessments/RuleDashboardPage"));
const RuleWizardPage = lazy(() => import("./pages/assessments/RuleWizardPage"));
const DrivesDashboardPage = lazy(() => import("./pages/drives/DrivesDashboardPage"));
const DriveDetailPage = lazy(() => import("./pages/drives/DriveDetailPage"));
const CreateDrivePage = lazy(() => import("./pages/drives/CreateDrivePage"));
const AssignCampusPage = lazy(() => import("./pages/drives/AssignCampusPage"));

const CreateUserPage = lazy(() => import("./pages/admin/CreateUserPage"));
const EditUserPage = lazy(() => import("./pages/admin/EditUserPage"));

const QuestionBankPage = lazy(() => import("./pages/assessments/QuestionBankPage"));
const AddQuestionPage = lazy(() => import("./pages/assessments/AddQuestionPage"));
const AIQuestionGeneratorPage = lazy(() => import("./pages/assessments/AIQuestionGeneratorPage"));


const ExamInstructionsPage = lazy(() => import("./pages/student/ExamInstructionsPage"));
const ExamPlayerPage = lazy(() => import("./pages/student/ExamPlayerPage"));
const MockExamPlayer = lazy(() => import("./pages/student/MockExamPlayer"));
const StudentProfile = lazy(() => import("./pages/student/StudentProfile"));
const PracticePage = lazy(() => import("./pages/student/PracticePage"));
const DevelopmentPage = lazy(() => import("./pages/student/DevelopmentPage"));
const GamificationPage = lazy(() => import("./pages/student/GamificationPage"));
const MentorDashboardPage = lazy(() => import("./pages/mentor/MentorDashboardPage"));
const PlacementPage = lazy(() => import("./pages/hr/PlacementPage"));

// ── Learning Portal ───────────────────────────────────────────────────────────
const LearnHomePage          = lazy(() => import("./pages/learn/LearnHomePage"));
const LearningPathDetailPage = lazy(() => import("./pages/learn/LearningPathDetailPage"));
const CertificatePage        = lazy(() => import("./pages/learn/CertificatePage"));

// ── Company Portal ────────────────────────────────────────────────────────────
const CompanyDashboardPage   = lazy(() => import("./pages/company/CompanyDashboardPage"));
const CompanyCandidatesPage  = lazy(() => import("./pages/company/CompanyCandidatesPage"));
const CompanyProfilePage     = lazy(() => import("./pages/company/CompanyProfilePage"));
const JDExtractPage          = lazy(() => import("./pages/company/JDExtractPage"));
const CampusSetupPage        = lazy(() => import("./pages/company/CampusSetupPage"));

const MockInterviewPage = lazy(() => import("./pages/student/MockInterviewPage"));
const SoftSkillsHubPage = lazy(() => import("./pages/student/SoftSkillsHubPage"));
const MockInterviewRoom = lazy(() => import("./pages/student/MockInterviewRoom"));
const MockInterviewFeedbackPage = lazy(() => import("./pages/student/MockInterviewFeedbackPage"));

const StudentLearningPage = lazy(() => import("./pages/lms/StudentLearningPage"));
const CourseDetailPage = lazy(() =>
  import("./pages/lms/StudentLearningPage").then((m) => ({ default: m.CourseDetailPage }))
);
const CourseBuilderPage = lazy(() => import("./pages/lms/CourseBuilderPage"));
const CourseDetailBuilder = lazy(() =>
  import("./pages/lms/CourseBuilderPage").then((m) => ({ default: m.CourseDetailBuilder }))
);
const StudentProgramPage = lazy(() => import("./pages/student/StudentProgramPage"));
const ModulePlayerPage = lazy(() => import("./pages/student/ModulePlayerPage"));

const NotAuthorizedPage = lazy(() => import("./pages/NotAuthorizedPage"));
const StudentOnboardingWizard = lazy(() => import("./components/StudentOnboardingWizard"));

// ── Skill Development Layer ───────────────────────────────────────────────────
const SkillsTaxonomyPage = lazy(() => import("./pages/skills/SkillsTaxonomyPage"));
const LearningModulesPage = lazy(() => import("./pages/skills/LearningModulesPage"));
const SkillProgramsPage = lazy(() => import("./pages/skills/SkillProgramsPage"));
const ProgramDetailPage = lazy(() => import("./pages/skills/ProgramDetailPage"));
const SkillPartnersPage = lazy(() => import("./pages/skills/SkillPartnersPage"));

// ── SuperAdmin Portal ──────────────────────────────────────────────────────────
const SuperAdminDashboard = lazy(() => import("./pages/superadmin/dashboard/DashboardPage"));

// Colleges
const SuperAdminColleges = lazy(() => import("./pages/superadmin/colleges/AllCollegesPage"));
const SuperAdminCollegeRequests = lazy(() => import("./pages/superadmin/colleges/CollegeRequestsPage"));
const SuperAdminAddCollege = lazy(() => import("./pages/superadmin/colleges/AddCollegePage"));
const SuperAdminCollegeDetail = lazy(() => import("./pages/superadmin/colleges/CollegeDetailPage"));

// Students (global roster across all colleges)
const SuperAdminStudents = lazy(() => import("./pages/superadmin/students/AllStudentsPage"));
const SuperAdminStudentDetail = lazy(() => import("./pages/superadmin/students/StudentDetailPage"));

// Approvals (dedicated cross-cutting page)
const SuperAdminApprovals = lazy(() => import("./pages/superadmin/approvals/ApprovalsPage"));

// Users
const SuperAdminUsers = lazy(() => import("./pages/superadmin/users/AllUsersPage"));
const SuperAdminUserDetail = lazy(() => import("./pages/superadmin/users/UserDetailPage"));

// Roles
const SuperAdminRoleManagement = lazy(() => import("./pages/superadmin/roles/RoleManagementPage"));
const SuperAdminPermissionMatrix = lazy(() => import("./pages/superadmin/roles/PermissionMatrixPage"));

// Audit Trail
const SuperAdminAuditTrail = lazy(() => import("./pages/superadmin/audit/AuditTrailPage"));

// Question Bank
const SuperAdminQuestionBank = lazy(() => import("./pages/superadmin/question-bank/AllQuestionsPage"));
const SuperAdminAIGenerator = lazy(() => import("./pages/superadmin/question-bank/AIGeneratorPage"));
const SuperAdminCategories = lazy(() => import("./pages/superadmin/question-bank/CategoriesPage"));
const SuperAdminReviewQueue = lazy(() => import("./pages/superadmin/question-bank/ReviewQueuePage"));
const SuperAdminImportBooks = lazy(() => import("./pages/superadmin/question-bank/ImportBooksPage"));

// Workflows
const SuperAdminWorkflows = lazy(() => import("./pages/superadmin/workflows/WorkflowsPage"));
const SuperAdminWorkflowDetail = lazy(() => import("./pages/superadmin/workflows/WorkflowDetailPage"));

// Analytics
const SuperAdminAnalytics = lazy(() => import("./pages/superadmin/analytics/AnalyticsPage"));

// Notifications
const SuperAdminNotifications = lazy(() => import("./pages/superadmin/notifications/NotificationsPage"));

// AI Configuration
const SuperAdminAIConfig = lazy(() => import("./pages/superadmin/ai-config/AIConfigPage"));

// Billing
const SuperAdminBilling = lazy(() => import("./pages/superadmin/billing/BillingPage"));

// Settings
const SuperAdminSettings = lazy(() => import("./pages/superadmin/settings/SettingsPage"));
const SuperAdminModules = lazy(() => import("./pages/superadmin/modules/ModulesPage"));

// ── QueryClient ───────────────────────────────────────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

// ── Helper components ─────────────────────────────────────────────────────────

function RootRedirect() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // If authenticated, redirect to the appropriate dashboard
  if (isAuthenticated && user) {
    return <Navigate to={getLandingPath(user)} replace />;
  }

  // Handle subdomains: redirect unauthenticated users to login
  const hostname = window.location.hostname;
  if (
    hostname.startsWith("admin.") ||
    hostname.startsWith("college.") ||
    hostname.startsWith("student.") ||
    hostname.startsWith("campus.") // Deprecated, but catch just in case
  ) {
    return <Navigate to="/auth/login" replace />;
  }

  // Otherwise, show the public landing page
  return <LandingPage />;
}



function RouteLoadingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={<RouteLoadingFallback />}>
          <Routes>
            {/* ── Public website ──────────────────────────────────────── */}
            <Route element={<PublicLayout />}>
              <Route path="/" element={<RootRedirect />} />
              <Route path="/pricing" element={<PricingPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/contact" element={<ContactPage />} />
              {/* Lateral hiring — hidden, enable later by restoring these routes */}
              <Route path="/lateral" element={<Navigate to="/" replace />} />
              <Route path="/lateral/contact" element={<Navigate to="/" replace />} />
              <Route path="/campus" element={<CampusPage />} />
              <Route path="/campus/contact" element={<CampusContactPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/terms" element={<TermsPage />} />
            </Route>

            {/* ── Subdomain handling ──────────────────────────────────── */}
            {/* When already logged in and at root on college subdomain, RootRedirect handles to /app/college-dashboard based on role */}

            {/* ── Auth ────────────────────────────────────────────────── */}
            <Route path="/auth" element={<AuthLayout />}>
              <Route path="login" element={<LoginPage />} />
              <Route path="register" element={<RegisterPage />} />
              <Route path="setup-password" element={<PasswordSetupPage />} />
              <Route path="forgot-password" element={<ForgotPasswordPage />} />
              <Route path="reset-password" element={<ResetPasswordPage />} />
              <Route path="change-password" element={<AuthChangePasswordPage />} />
              <Route path="2fa" element={<TwoFactorLoginPage />} />
              <Route path="callback" element={<MicrosoftCallback />} />
            </Route>

            {/* ── Not-authorized ──────────────────────────────────────── */}
            <Route path="/not-authorized" element={<NotAuthorizedPage />} />

            {/* ── Account security (any authenticated user) ───────────── */}
            <Route
              path="/app/security"
              element={
                <ProtectedRoute>
                  <SecurityPage />
                </ProtectedRoute>
              }
            />

            {/* ── SuperAdmin Portal ──────────────────────────────────────── */}
            <Route
              path="/app/superadmin"
              element={
                <ProtectedRoute>
                  <RoleGuard allowed={["super_admin"]}>
                    <SuperAdminLayout />
                  </RoleGuard>
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/app/superadmin/dashboard" replace />} />

              {/* Dashboard */}
              <Route path="dashboard" element={<PermissionGuard permission="dashboard_view" redirect><SuperAdminDashboard /></PermissionGuard>} />

              {/* Colleges */}
              <Route path="colleges" element={<PermissionGuard permission="colleges_view" redirect><SuperAdminColleges /></PermissionGuard>} />
              <Route path="colleges/requests" element={<PermissionGuard permission="colleges_view" redirect><SuperAdminCollegeRequests /></PermissionGuard>} />
              <Route path="colleges/new" element={<PermissionGuard permission="colleges_manage" redirect><SuperAdminAddCollege /></PermissionGuard>} />
              <Route path="colleges/:id" element={<PermissionGuard permission="colleges_view" redirect><SuperAdminCollegeDetail /></PermissionGuard>} />

              {/* Students */}
              <Route path="students" element={<PermissionGuard permission="students_view" redirect><SuperAdminStudents /></PermissionGuard>} />
              <Route path="students/:id" element={<PermissionGuard permission="students_view" redirect><SuperAdminStudentDetail /></PermissionGuard>} />

              {/* Approvals */}
              <Route path="approvals" element={<PermissionGuard permission="colleges_manage" redirect><SuperAdminApprovals /></PermissionGuard>} />

              <Route path="modules" element={<PermissionGuard permission="modules_view" redirect><SuperAdminModules /></PermissionGuard>} />

              {/* Users */}
              <Route path="users" element={<PermissionGuard permission="users_view" redirect><SuperAdminUsers /></PermissionGuard>} />
              <Route path="users/:id" element={<PermissionGuard permission="users_view" redirect><SuperAdminUserDetail /></PermissionGuard>} />

              {/* Roles */}
              <Route path="roles" element={<PermissionGuard permission="roles_view" redirect><SuperAdminRoleManagement /></PermissionGuard>} />
              <Route path="roles/matrix" element={<PermissionGuard permission="permissions_view" redirect><SuperAdminPermissionMatrix /></PermissionGuard>} />

              {/* Audit Trail */}
              <Route path="audit-trail" element={<PermissionGuard permission="audit_view" redirect><SuperAdminAuditTrail /></PermissionGuard>} />

              {/* Question Bank */}
              <Route path="question-bank" element={<PermissionGuard permission="assessments_view" redirect><SuperAdminQuestionBank /></PermissionGuard>} />
              <Route path="question-bank/ai-generator" element={<PermissionGuard permission="assessments_manage" redirect><SuperAdminAIGenerator /></PermissionGuard>} />
              <Route path="question-bank/categories" element={<PermissionGuard permission="assessments_view" redirect><SuperAdminCategories /></PermissionGuard>} />
              <Route path="question-bank/review-queue" element={<PermissionGuard permission="assessments_view" redirect><SuperAdminReviewQueue /></PermissionGuard>} />
              <Route path="question-bank/import-books" element={<PermissionGuard permission="assessments_manage" redirect><SuperAdminImportBooks /></PermissionGuard>} />

              {/* Workflows */}
              <Route path="workflows" element={<PermissionGuard permission="workflows_view" redirect><SuperAdminWorkflows /></PermissionGuard>} />
              <Route path="workflows/:id" element={<PermissionGuard permission="workflows_view" redirect><SuperAdminWorkflowDetail /></PermissionGuard>} />

              {/* Analytics */}
              <Route path="analytics" element={<PermissionGuard permission="analytics_view" redirect><SuperAdminAnalytics /></PermissionGuard>} />

              {/* Notifications */}
              <Route path="notifications" element={<PermissionGuard permission="notifications_view" redirect><SuperAdminNotifications /></PermissionGuard>} />

              {/* AI Configuration */}
              <Route path="ai-config" element={<PermissionGuard permission="settings_view" redirect><SuperAdminAIConfig /></PermissionGuard>} />

              {/* Billing */}
              <Route path="billing" element={<PermissionGuard permission="billing_view" redirect><SuperAdminBilling /></PermissionGuard>} />

              {/* Settings */}
              <Route path="settings" element={<PermissionGuard permission="settings_view" redirect><SuperAdminSettings /></PermissionGuard>} />
            </Route>

            {/* ── College / Campus Portal (redesigned) ───────────────────── */}
            <Route
              path="/app/college-portal"
              element={
                <ProtectedRoute>
                  <RoleGuard allowed={["college_admin", "college", "college_staff"]}>
                    <CollegeLayout />
                  </RoleGuard>
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/app/college-portal/dashboard" replace />} />
              <Route path="dashboard" element={<CollegePortalDashboard />} />
              <Route path="students" element={<CollegePortalStudents />} />
              <Route path="students/:id" element={<CollegePortalStudentDetail />} />
              <Route
                path="question-bank"
                element={
                  <CollegePortalComingSoon
                    title="Question Bank"
                    description="Browse and assign questions scoped to your campus."
                  />
                }
              />
              <Route
                path="workflows"
                element={
                  <CollegePortalComingSoon
                    title="Workflows"
                    description="Aptitude, soft skills, and technical skill pathways for your students."
                  />
                }
              />
              <Route path="assessments" element={<CampusDrivesListPage />} />
              <Route path="analytics" element={<CollegePortalAnalytics />} />
              <Route
                path="soft-skills"
                element={
                  <CollegePortalComingSoon
                    title="Soft Skills"
                    description="Communication, teamwork, and interview readiness programs."
                  />
                }
              />
              <Route
                path="technical-skills"
                element={
                  <CollegePortalComingSoon
                    title="Technical Skills"
                    description="Coding, aptitude, and domain-specific skill tracks."
                  />
                }
              />
              <Route path="settings" element={<CampusSettingsPage />} />
              <Route path="lms/:moduleKey" element={<LmsModulePage portal="college" />} />
            </Route>

            {/* ── Student Portal (dedicated layout) ───────────────────── */}
            <Route
              path="/app/student-portal"
              element={
                <ProtectedRoute>
                  <RoleGuard allowed={["student"]}>
                    <StudentPortalLayout />
                  </RoleGuard>
                </ProtectedRoute>
              }
            >
              <Route index element={<StudentDashboardPage />} />
              <Route path="workflow" element={<StudentWorkflowPage />} />
              <Route path="learn" element={<StudentLearnPage />} />
              <Route path="practice" element={<PracticePage />} />
              <Route path="tests" element={<StudentTestsPage />} />
              <Route path="question-bank" element={<StudentQuestionBankPage />} />
              <Route path="achievements" element={<GamificationPage />} />
              <Route path="payments" element={<StudentPaymentsPage />} />
              <Route path="notifications" element={<StudentNotificationsPage />} />
              <Route path="profile" element={<StudentProfile />} />
              <Route path="lms/:moduleKey" element={<LmsModulePage portal="student" />} />
              <Route path="soft-skills" element={<SoftSkillsHubPage />} />
              <Route path="development" element={<DevelopmentPage />} />
              <Route path="mock-interview" element={<MockInterviewPage />} />
              <Route path="mock-interview/room" element={<MockInterviewRoom />} />
              <Route path="mock-interview/:sessionId/feedback" element={<MockInterviewFeedbackPage />} />
              <Route path="exam/:driveId/instructions" element={<ExamInstructionsPage />} />
              <Route path="programs/:programId" element={<StudentProgramPage />} />
              <Route path="programs/:programId/modules/:moduleId" element={<ModulePlayerPage />} />
            </Route>

            {/* ── Student onboarding (protected) ──────────────────────── */}
            <Route
              path="/student-onboarding"
              element={
                <ProtectedRoute>
                  <StudentOnboardingWizard />
                </ProtectedRoute>
              }
            />

            {/* ── Exam Player (drive-based, full-screen) ─────────────── */}
            <Route
              path="/app/student-portal/exam/:driveId/play"
              element={
                <ProtectedRoute>
                  <RoleGuard allowed={["student"]}>
                    <StudentFeatureGuard feature="tests">
                      <ExamPlayerPage />
                    </StudentFeatureGuard>
                  </RoleGuard>
                </ProtectedRoute>
              }
            />

            <Route
              path="/app/student-portal/mock/:mockId"
              element={
                <ProtectedRoute>
                  <RoleGuard allowed={["student"]}>
                    <StudentFeatureGuard feature="tests">
                      <MockExamPlayer />
                    </StudentFeatureGuard>
                  </RoleGuard>
                </ProtectedRoute>
              }
            />

            {/* ── Protected dashboard routes (/app) ───────────────────── */}
            <Route
              path="/app"
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<RootRedirect />} />

              {/* HR Dashboard */}
              <Route
                path="hr-dashboard"
                element={
                  <RoleGuard allowed={["super_admin", "hr", "cxo"]}>
                    <HRDashboardPage />
                  </RoleGuard>
                }
              />

              {/* Engineer Panel */}
              <Route
                path="engineer-panel"
                element={
                  <RoleGuard allowed={["engineer"]}>
                    <EngineerPanelPage />
                  </RoleGuard>
                }
              />

              {/* CXO Analytics */}
              <Route
                path="cxo-analytics"
                element={
                  <RoleGuard allowed={["cxo", "super_admin"]}>
                    <CXOAnalyticsPage />
                  </RoleGuard>
                }
              />

              {/* College Dashboard — redirect to redesigned portal */}
              <Route
                path="college-dashboard"
                element={<Navigate to="/app/college-portal/dashboard" replace />}
              />
              {/* College Drives */}
              <Route
                path="college/drives"
                element={
                  <RoleGuard allowed={["college_admin", "college", "college_staff"]}>
                    <CollegeLegacyFeatureGuard>
                      <CampusDrivesListPage />
                    </CollegeLegacyFeatureGuard>
                  </RoleGuard>
                }
              />
              <Route
                path="college/drives/:id"
                element={
                  <RoleGuard allowed={["college_admin", "college", "college_staff"]}>
                    <CollegeLegacyFeatureGuard>
                      <CampusDriveDetailPage />
                    </CollegeLegacyFeatureGuard>
                  </RoleGuard>
                }
              />

              <Route
                path="college/results"
                element={
                  <RoleGuard allowed={["college_admin", "college", "college_staff"]}>
                    <CollegeLegacyFeatureGuard>
                      <CampusResultsPage />
                    </CollegeLegacyFeatureGuard>
                  </RoleGuard>
                }
              />
              <Route
                path="college/insights"
                element={
                  <RoleGuard allowed={["college_admin", "college", "college_staff"]}>
                    <CollegeLegacyFeatureGuard>
                      <CampusInsightsPage />
                    </CollegeLegacyFeatureGuard>
                  </RoleGuard>
                }
              />
              <Route
                path="college/communications"
                element={
                  <RoleGuard allowed={["college_admin", "college", "college_staff"]}>
                    <CollegeLegacyFeatureGuard>
                      <CampusCommunicationsPage />
                    </CollegeLegacyFeatureGuard>
                  </RoleGuard>
                }
              />
              <Route
                path="college/settings"
                element={
                  <RoleGuard allowed={["college_admin", "college"]}>
                    <CollegeLegacyFeatureGuard>
                      <CampusSettingsPage />
                    </CollegeLegacyFeatureGuard>
                  </RoleGuard>
                }
              />
              <Route
                path="college/billing"
                element={
                  <RoleGuard allowed={["college_admin", "college"]}>
                    <CollegeLegacyFeatureGuard>
                      <BillingPage />
                    </CollegeLegacyFeatureGuard>
                  </RoleGuard>
                }
              />
              <Route
                path="college/integrity"
                element={
                  <RoleGuard allowed={["college_admin", "college", "college_staff"]}>
                    <CollegeLegacyFeatureGuard>
                      <CampusIntegrityPage />
                    </CollegeLegacyFeatureGuard>
                  </RoleGuard>
                }
              />
              <Route
                path="college/campus-admins"
                element={
                  <RoleGuard allowed={["college_admin", "college"]}>
                    <CollegeLegacyFeatureGuard>
                      <CampusAdminsPage />
                    </CollegeLegacyFeatureGuard>
                  </RoleGuard>
                }
              />

              {/* Student Portal routes moved to the dedicated StudentPortalLayout
                  group below (/app/student-portal/*). */}
              <Route
                path="mentor"
                element={
                  <RoleGuard allowed={["mentor", "super_admin", "hr"]}>
                    <MentorDashboardPage />
                  </RoleGuard>
                }
              />
              <Route
                path="placements"
                element={
                  <RoleGuard allowed={["super_admin", "hr", "college_admin"]}>
                    <PlacementPage />
                  </RoleGuard>
                }
              />

              {/* ── Learning Portal ─────────────────────────────────── */}
              <Route
                path="learn"
                element={
                  <RoleGuard allowed={["student"]}>
                    <LearnHomePage />
                  </RoleGuard>
                }
              />
              <Route
                path="learn/paths/:pathId"
                element={
                  <RoleGuard allowed={["student"]}>
                    <LearningPathDetailPage />
                  </RoleGuard>
                }
              />
              <Route
                path="certificate/:certId"
                element={
                  <RoleGuard allowed={["student", "super_admin", "hr"]}>
                    <CertificatePage />
                  </RoleGuard>
                }
              />

              {/* ── Company Portal ──────────────────────────────────── */}
              <Route
                path="company"
                element={
                  <RoleGuard allowed={["company", "super_admin", "hr"]}>
                    <CompanyDashboardPage />
                  </RoleGuard>
                }
              />
              <Route
                path="company/candidates"
                element={
                  <RoleGuard allowed={["company", "super_admin", "hr"]}>
                    <CompanyCandidatesPage />
                  </RoleGuard>
                }
              />
              <Route
                path="company/profile"
                element={
                  <RoleGuard allowed={["company"]}>
                    <CompanyProfilePage />
                  </RoleGuard>
                }
              />
              <Route
                path="company/campus-setup"
                element={
                  <RoleGuard allowed={["company", "super_admin", "hr"]}>
                    <CampusSetupPage />
                  </RoleGuard>
                }
              />
              <Route
                path="company/jd-extract"
                element={
                  <RoleGuard allowed={["company", "super_admin", "hr", "engineer"]}>
                    <JDExtractPage />
                  </RoleGuard>
                }
              />
              {/* LMS — Student */}
              <Route
                path="lms/catalog"
                element={
                  <RoleGuard allowed={["student", "mentor", "super_admin", "hr", "college_admin", "instructor"]}>
                    <StudentLearningPage />
                  </RoleGuard>
                }
              />
              <Route
                path="lms/courses/:courseId"
                element={
                  <RoleGuard allowed={["student", "mentor", "super_admin", "hr", "college_admin", "instructor"]}>
                    <CourseDetailPage />
                  </RoleGuard>
                }
              />

              {/* LMS — Instructor / Admin */}
              <Route
                path="lms/builder"
                element={
                  <RoleGuard allowed={["super_admin", "hr", "instructor"]}>
                    <CourseBuilderPage />
                  </RoleGuard>
                }
              />
              <Route
                path="lms/builder/:courseId"
                element={
                  <RoleGuard allowed={["super_admin", "hr", "instructor"]}>
                    <CourseDetailBuilder />
                  </RoleGuard>
                }
              />

              {/* Admin overview */}
              <Route
                path="overview"
                element={
                  <RoleGuard allowed={["super_admin", "hr", "cxo"]}>
                    <DashboardPage />
                  </RoleGuard>
                }
              />

              {/* Monitoring */}
              <Route
                path="admin/monitoring"
                element={
                  <RoleGuard allowed={["college_admin", "super_admin", "hr", "cxo", "engineer"]}>
                    <LiveMonitoringDashboard />
                  </RoleGuard>
                }
              />
              <Route
                path="admin/monitoring/live/:driveId"
                element={
                  <RoleGuard allowed={["college_admin", "super_admin", "hr", "cxo", "engineer"]}>
                    <LiveMonitoringDashboard />
                  </RoleGuard>
                }
              />
              <Route
                path="admin/monitoring/session/:sessionId"
                element={
                  <RoleGuard allowed={["college_admin", "super_admin", "hr", "cxo", "engineer"]}>
                    <StudentSessionDetail />
                  </RoleGuard>
                }
              />
              {/* Students */}
              <Route
                path="students"
                element={
                  <RoleGuard allowed={["super_admin", "hr", "cxo", "college_admin", "college", "college_staff"]}>
                    <CollegeLegacyFeatureGuard>
                      <StudentListPage />
                    </CollegeLegacyFeatureGuard>
                  </RoleGuard>
                }
              />
              <Route
                path="students/new"
                element={
                  <RoleGuard allowed={["super_admin", "hr", "cxo", "college_admin"]}>
                    <CollegeLegacyFeatureGuard>
                      <StudentDetailPage />
                    </CollegeLegacyFeatureGuard>
                  </RoleGuard>
                }
              />
              <Route
                path="students/:id"
                element={
                  <RoleGuard allowed={["super_admin", "hr", "cxo", "college_admin", "college", "college_staff"]}>
                    <CollegeLegacyFeatureGuard>
                      <StudentDetailPage />
                    </CollegeLegacyFeatureGuard>
                  </RoleGuard>
                }
              />
              <Route
                path="students/:id/edit"
                element={
                  <RoleGuard allowed={["super_admin", "hr", "cxo", "college_admin"]}>
                    <CollegeLegacyFeatureGuard>
                      <StudentDetailPage />
                    </CollegeLegacyFeatureGuard>
                  </RoleGuard>
                }
              />
              <Route
                path="students/bulk-import"
                element={
                  <RoleGuard allowed={["super_admin", "hr", "cxo", "college_admin"]}>
                    <CollegeLegacyFeatureGuard>
                      <BulkImportStudentsPage />
                    </CollegeLegacyFeatureGuard>
                  </RoleGuard>
                }
              />
              {/* Administration */}
              <Route
                path="administration"
                element={
                  <RoleGuard allowed={["super_admin", "admin", "hr", "cxo"]}>
                    <AdministrativePanel />
                  </RoleGuard>
                }
              />
              <Route path="users" element={<Navigate to="/app/administration" replace />} />
              <Route path="roles" element={<Navigate to="/app/administration" replace />} />
              <Route
                path="administration/users/:id/change-password"
                element={
                  <RoleGuard allowed={["super_admin", "admin"]}>
                    <ChangePasswordPage />
                  </RoleGuard>
                }
              />
              <Route
                path="administration/users/new"
                element={
                  <RoleGuard allowed={["super_admin", "admin"]}>
                    <CreateUserPage />
                  </RoleGuard>
                }
              />
              <Route
                path="administration/users/:id/edit"
                element={
                  <RoleGuard allowed={["super_admin", "admin"]}>
                    <EditUserPage />
                  </RoleGuard>
                }
              />

              {/* Assessments */}
              <Route
                path="assessments"
                element={
                  <RoleGuard allowed={["super_admin", "hr", "engineer"]}>
                    <AssessmentStudioPage />
                  </RoleGuard>
                }
              />
              <Route
                path="assessments/bank"
                element={<Navigate to="/app/assessments?tab=bank" replace />}
              />
              <Route
                path="assessments/bank/new"
                element={
                  <RoleGuard allowed={["super_admin", "hr", "engineer"]}>
                    <AddQuestionPage />
                  </RoleGuard>
                }
              />
              <Route
                path="assessments/wizard"
                element={
                  <RoleGuard allowed={["super_admin", "hr"]}>
                    <QuestionWizard />
                  </RoleGuard>
                }
              />
              <Route
                path="assessments/blueprint"
                element={
                  <RoleGuard allowed={["super_admin", "hr"]}>
                    <AssessmentBlueprintWizard />
                  </RoleGuard>
                }
              />
              <Route
                path="assessments/:id/questions"
                element={
                  <RoleGuard allowed={["super_admin", "hr", "engineer"]}>
                    <ExamQuestionsPage />
                  </RoleGuard>
                }
              />
              <Route
                path="assessments/code-editor"
                element={
                  <RoleGuard allowed={["super_admin", "hr", "engineer"]}>
                    <CodeEditor />
                  </RoleGuard>
                }
              />
              <Route
                path="assessments/:id/take"
                element={
                  <RoleGuard allowed={["student"]}>
                    <AssessmentTakePage />
                  </RoleGuard>
                }
              />

              {/* Assessment Rules */}
              <Route
                path="assessment-rules"
                element={
                  <RoleGuard allowed={["super_admin", "hr", "engineer"]}>
                    <RuleDashboardPage />
                  </RoleGuard>
                }
              />
              <Route
                path="assessment-rules/new"
                element={
                  <RoleGuard allowed={["super_admin", "hr", "engineer"]}>
                    <RuleWizardPage />
                  </RoleGuard>
                }
              />
              <Route
                path="assessment-rules/:id"
                element={
                  <RoleGuard allowed={["super_admin", "hr", "engineer"]}>
                    <RuleWizardPage />
                  </RoleGuard>
                }
              />

              {/* Global Question Bank */}
              <Route
                path="question-bank"
                element={
                  <RoleGuard allowed={["super_admin", "hr", "engineer"]}>
                    <QuestionBankPage />
                  </RoleGuard>
                }
              />
              <Route
                path="question-bank/new"
                element={
                  <RoleGuard allowed={["super_admin", "hr", "engineer"]}>
                    <AddQuestionPage />
                  </RoleGuard>
                }
              />
              <Route
                path="question-bank/ai-generate"
                element={
                  <RoleGuard allowed={["super_admin", "hr", "engineer"]}>
                    <AIQuestionGeneratorPage />
                  </RoleGuard>
                }
              />
              <Route
                path="question-bank/:id"
                element={
                  <RoleGuard allowed={["super_admin", "hr", "engineer"]}>
                    <AddQuestionPage />
                  </RoleGuard>
                }
              />

              {/* Drives */}
              <Route
                path="drives"
                element={
                  <RoleGuard allowed={["super_admin", "hr", "college_admin", "engineer"]}>
                    <DrivesDashboardPage />
                  </RoleGuard>
                }
              />
              <Route
                path="drives/new"
                element={
                  <RoleGuard allowed={["super_admin", "hr", "college_admin", "engineer"]}>
                    <CreateDrivePage />
                  </RoleGuard>
                }
              />
              <Route
                path="drives/:id"
                element={
                  <RoleGuard allowed={["super_admin", "hr", "college_admin", "engineer"]}>
                    <DriveDetailPage />
                  </RoleGuard>
                }
              />
              <Route
                path="drives/:id/assign-campus"
                element={
                  <RoleGuard allowed={["super_admin", "hr", "college_admin", "engineer"]}>
                    <AssignCampusPage />
                  </RoleGuard>
                }
              />

              {/* Segmentation */}
              <Route
                path="segmentation"
                element={
                  <RoleGuard allowed={["super_admin", "hr"]}>
                    <SegmentationPage />
                  </RoleGuard>
                }
              />

              {/* Campuses */}
              <Route
                path="campuses"
                element={
                  <RoleGuard allowed={["super_admin", "hr"]}>
                    <CampusListPage />
                  </RoleGuard>
                }
              />
              <Route
                path="campuses/:id"
                element={
                  <RoleGuard allowed={["super_admin", "hr"]}>
                    <CampusDetailPage />
                  </RoleGuard>
                }
              />
              <Route
                path="campuses/:id/edit"
                element={
                  <RoleGuard allowed={["super_admin", "hr"]}>
                    <CampusDetailPage />
                  </RoleGuard>
                }
              />
              <Route
                path="approvals/pending"
                element={
                  <RoleGuard allowed={["super_admin", "admin", "hr"]}>
                    <PendingApprovalsPage />
                  </RoleGuard>
                }
              />

              {/* Proctoring */}
              <Route
                path="proctoring"
                element={
                  <RoleGuard allowed={["super_admin", "hr", "engineer", "college_admin"]}>
                    <ProctoringMonitorPage />
                  </RoleGuard>
                }
              />

              {/* Analytics */}
              <Route
                path="analytics"
                element={
                  <RoleGuard allowed={["super_admin", "hr", "cxo", "engineer"]}>
                    <AnalyticsPage />
                  </RoleGuard>
                }
              />

              {/* Skill Development Layer */}
              <Route
                path="skills"
                element={
                  <RoleGuard allowed={["super_admin", "hr", "cxo"]}>
                    <SkillsTaxonomyPage />
                  </RoleGuard>
                }
              />
              <Route
                path="learning-modules"
                element={
                  <RoleGuard allowed={["super_admin", "hr", "cxo"]}>
                    <LearningModulesPage />
                  </RoleGuard>
                }
              />
              <Route
                path="skill-programs"
                element={
                  <RoleGuard allowed={["super_admin", "hr", "cxo"]}>
                    <SkillProgramsPage />
                  </RoleGuard>
                }
              />
              <Route
                path="skill-programs/new"
                element={
                  <RoleGuard allowed={["super_admin", "hr", "cxo"]}>
                    <ProgramDetailPage />
                  </RoleGuard>
                }
              />
              <Route
                path="skill-programs/:id"
                element={
                  <RoleGuard allowed={["super_admin", "hr", "cxo"]}>
                    <ProgramDetailPage />
                  </RoleGuard>
                }
              />
              <Route
                path="skill-programs/:id/edit"
                element={
                  <RoleGuard allowed={["super_admin", "hr", "cxo"]}>
                    <ProgramDetailPage />
                  </RoleGuard>
                }
              />
              <Route
                path="skill-partners"
                element={
                  <RoleGuard allowed={["super_admin", "hr", "cxo"]}>
                    <SkillPartnersPage />
                  </RoleGuard>
                }
              />
            </Route>

            {/* 404 */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: { borderRadius: "10px", fontSize: "13px" },
        }}
      />
    </QueryClientProvider>
  );
}