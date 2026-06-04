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

// ── Layouts ──────────────────────────────────────────────────────────────────
import PublicLayout from "./layouts/PublicLayout";

// ── Public pages (eagerly loaded for fast initial paint) ─────────────────────
import LandingPage from "./pages/public/LandingPage";
import PricingPage from "./pages/public/PricingPage";
import AboutPage from "./pages/public/AboutPage";
import ContactPage from "./pages/public/ContactPage";
import LateralPage from "./pages/public/LateralPage";
import LateralContactPage from "./pages/public/LateralContactPage";
import CampusPage from "./pages/public/CampusPage";
import CampusContactPage from "./pages/public/CampusContactPage";
import PrivacyPage from "./pages/public/PrivacyPage";
import TermsPage from "./pages/public/TermsPage";
import NotFoundPage from "./pages/NotFoundPage";

// ── Lazy-loaded routes ────────────────────────────────────────────────────────
const DashboardLayout = lazy(() => import("./layouts/DashboardLayout"));
const AuthLayout = lazy(() => import("./layouts/AuthLayout"));

const LoginPage = lazy(() => import("./pages/auth/LoginPage"));
const PasswordSetupPage = lazy(() => import("./pages/auth/PasswordSetupPage"));
const MicrosoftCallback = lazy(() => import("./pages/auth/MicrosoftCallback"));

const HRDashboardPage = lazy(() => import("./pages/hr/HRDashboardPage"));
const EngineerPanelPage = lazy(() => import("./pages/engineer/EngineerPanelPage"));
const CXOAnalyticsPage = lazy(() => import("./pages/cxo/CXOAnalyticsPage"));
const CollegeDashboardPage = lazy(() => import("./pages/college/CollegeDashboardPage"));
const CampusDrivesListPage = lazy(() => import("./pages/college/DrivesListPage"));
const CampusDriveDetailPage = lazy(() => import("./pages/college/DriveDetailPage"));
const CampusResultsPage = lazy(() => import("./pages/college/ResultsPage"));
const CampusInsightsPage = lazy(() => import("./pages/college/InsightsPage"));
const CampusIntegrityPage = lazy(() => import("./pages/college/IntegrityPage"));
const CampusCommunicationsPage = lazy(() => import("./pages/college/CommunicationsPage"));
const CampusAdminsPage = lazy(() => import("./pages/college/CampusAdminsPage"));
const CampusSettingsPage = lazy(() => import("./pages/college/SettingsPage"));
const StudentPortalPage = lazy(() => import("./pages/student/StudentPortalPage"));
const CampusListPage = lazy(() => import("./pages/hr/CampusListPage"));
const CampusDetailPage = lazy(() => import("./pages/hr/CampusDetailPage"));
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

const AddQuestionPage = lazy(() => import("./pages/assessments/AddQuestionPage"));


const ExamInstructionsPage = lazy(() => import("./pages/student/ExamInstructionsPage"));
const ExamPlayerPage = lazy(() => import("./pages/student/ExamPlayerPage"));
const MockExamPlayer = lazy(() => import("./pages/student/MockExamPlayer"));
const StudentProfile = lazy(() => import("./pages/student/StudentProfile"));
const PracticePage = lazy(() => import("./pages/student/PracticePage"));
const DevelopmentPage = lazy(() => import("./pages/student/DevelopmentPage"));
const GamificationPage = lazy(() => import("./pages/student/GamificationPage"));
const MentorDashboardPage = lazy(() => import("./pages/mentor/MentorDashboardPage"));
const PlacementPage = lazy(() => import("./pages/hr/PlacementPage"));

const MockInterviewPage = lazy(() => import("./pages/student/MockInterviewPage"));
const MockInterviewRoom = lazy(() => import("./pages/student/MockInterviewRoom"));

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
const CollegeSkillsPage = lazy(() => import("./pages/college/CollegeSkillsPage"));

const NotAuthorizedPage = lazy(() => import("./pages/NotAuthorizedPage"));
const StudentOnboardingWizard = lazy(() => import("./components/StudentOnboardingWizard"));

// ── Skill Development Layer ───────────────────────────────────────────────────
const SkillsTaxonomyPage = lazy(() => import("./pages/skills/SkillsTaxonomyPage"));
const LearningModulesPage = lazy(() => import("./pages/skills/LearningModulesPage"));
const SkillProgramsPage = lazy(() => import("./pages/skills/SkillProgramsPage"));
const ProgramDetailPage = lazy(() => import("./pages/skills/ProgramDetailPage"));
const SkillPartnersPage = lazy(() => import("./pages/skills/SkillPartnersPage"));

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
              <Route path="/lateral" element={<LateralPage />} />
              <Route path="/lateral/contact" element={<LateralContactPage />} />
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
              <Route path="setup-password" element={<PasswordSetupPage />} />
              <Route path="callback" element={<MicrosoftCallback />} />
            </Route>

            {/* ── Not-authorized ──────────────────────────────────────── */}
            <Route path="/not-authorized" element={<NotAuthorizedPage />} />

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
                    <ExamPlayerPage />
                  </RoleGuard>
                </ProtectedRoute>
              }
            />

            <Route
              path="/app/student-portal/mock/:mockId"
              element={
                <ProtectedRoute>
                  <RoleGuard allowed={["student"]}>
                    <MockExamPlayer />
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

              {/* College Dashboard */}
              <Route
                path="college-dashboard"
                element={
                  <RoleGuard allowed={["college_admin", "college", "college_staff"]}>
                    <CollegeDashboardPage />
                  </RoleGuard>
                }
              />
              {/* College Drives */}
              <Route
                path="college/drives"
                element={
                  <RoleGuard allowed={["college_admin", "college", "college_staff"]}>
                    <CampusDrivesListPage />
                  </RoleGuard>
                }
              />
              <Route
                path="college/drives/:id"
                element={
                  <RoleGuard allowed={["college_admin", "college", "college_staff"]}>
                    <CampusDriveDetailPage />
                  </RoleGuard>
                }
              />

              <Route
                path="college/results"
                element={
                  <RoleGuard allowed={["college_admin", "college", "college_staff"]}>
                    <CampusResultsPage />
                  </RoleGuard>
                }
              />
              <Route
                path="college/insights"
                element={
                  <RoleGuard allowed={["college_admin", "college", "college_staff"]}>
                    <CampusInsightsPage />
                  </RoleGuard>
                }
              />
              <Route
                path="college/communications"
                element={
                  <RoleGuard allowed={["college_admin", "college", "college_staff"]}>
                    <CampusCommunicationsPage />
                  </RoleGuard>
                }
              />
              <Route
                path="college/settings"
                element={
                  <RoleGuard allowed={["college_admin", "college"]}>
                    <CampusSettingsPage />
                  </RoleGuard>
                }
              />
              <Route
                path="college/integrity"
                element={
                  <RoleGuard allowed={["college_admin", "college", "college_staff"]}>
                    <CampusIntegrityPage />
                  </RoleGuard>
                }
              />
              <Route
                path="college/campus-admins"
                element={
                  <RoleGuard allowed={["college_admin", "college"]}>
                    <CampusAdminsPage />
                  </RoleGuard>
                }
              />

              {/* Student Portal */}
              <Route
                path="student-portal"
                element={
                  <RoleGuard allowed={["student"]}>
                    <StudentPortalPage />
                  </RoleGuard>
                }
              />
              <Route
                path="student-portal/exam/:driveId/instructions"
                element={
                  <RoleGuard allowed={["student"]}>
                    <ExamInstructionsPage />
                  </RoleGuard>
                }
              />
              <Route
                path="student"
                element={
                  <RoleGuard allowed={["student"]}>
                    <StudentPortalPage />
                  </RoleGuard>
                }
              />
              <Route
                path="student-portal/profile"
                element={
                  <RoleGuard allowed={["student"]}>
                    <StudentProfile />
                  </RoleGuard>
                }
              />
              <Route
                path="student-portal/practice"
                element={
                  <RoleGuard allowed={["student"]}>
                    <PracticePage />
                  </RoleGuard>
                }
              />
              <Route
                path="student-portal/mock-interview"
                element={
                  <RoleGuard allowed={["student"]}>
                    <MockInterviewPage />
                  </RoleGuard>
                }
              />
              <Route
                path="student-portal/mock-interview/room"
                element={
                  <RoleGuard allowed={["student"]}>
                    <MockInterviewRoom />
                  </RoleGuard>
                }
              />
              {/* feedback page — built in Phase 2 */}
              <Route
                path="student-portal/mock-interview/:sessionId/feedback"
                element={
                  <RoleGuard allowed={["student"]}>
                    <MockInterviewPage />
                  </RoleGuard>
                }
              />
              <Route
                path="student-portal/development"
                element={
                  <RoleGuard allowed={["student"]}>
                    <DevelopmentPage />
                  </RoleGuard>
                }
              />
              <Route
                path="student-portal/gamification"
                element={
                  <RoleGuard allowed={["student"]}>
                    <GamificationPage />
                  </RoleGuard>
                }
              />
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
              <Route
                path="student-portal/programs/:programId"
                element={
                  <RoleGuard allowed={["student"]}>
                    <StudentProgramPage />
                  </RoleGuard>
                }
              />
              <Route
                path="student-portal/programs/:programId/modules/:moduleId"
                element={
                  <RoleGuard allowed={["student"]}>
                    <ModulePlayerPage />
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
                    <StudentListPage />
                  </RoleGuard>
                }
              />
              <Route
                path="students/new"
                element={
                  <RoleGuard allowed={["super_admin", "hr", "cxo", "college_admin"]}>
                    <StudentDetailPage />
                  </RoleGuard>
                }
              />
              <Route
                path="students/:id"
                element={
                  <RoleGuard allowed={["super_admin", "hr", "cxo", "college_admin", "college", "college_staff"]}>
                    <StudentDetailPage />
                  </RoleGuard>
                }
              />
              <Route
                path="students/:id/edit"
                element={
                  <RoleGuard allowed={["super_admin", "hr", "cxo", "college_admin"]}>
                    <StudentDetailPage />
                  </RoleGuard>
                }
              />
              <Route
                path="students/bulk-import"
                element={
                  <RoleGuard allowed={["super_admin", "hr", "cxo", "college_admin"]}>
                    <BulkImportStudentsPage />
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