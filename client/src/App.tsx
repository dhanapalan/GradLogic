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
import { StudentFeatureGuard, CollegeFeatureGuard } from "./components/FeatureGuard";
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
const CollegePortalDepartmentsSettings = lazy(
  () => import("./pages/college-portal/DepartmentsSettingsPage")
);
const BillingPage = lazy(() => import("./pages/college/BillingPage"));
const CollegePortalDashboard = lazy(() => import("./pages/college-portal/DashboardPage"));
const CollegePortalStudents = lazy(() => import("./pages/college-portal/StudentsPage"));
const CollegePortalStudentDetail = lazy(() => import("./pages/college-portal/StudentDetailPage"));
const CollegePortalStudentForm = lazy(() => import("./pages/college-portal/StudentFormPage"));
const CollegePortalAnalytics = lazy(() => import("./pages/college-portal/AnalyticsPage"));
const CollegePortalEvaluationInsights = lazy(
  () => import("./pages/college-portal/EvaluationInsightsPage")
);
const CollegePortalComingSoon = lazy(() => import("./pages/college-portal/ComingSoonPage"));
const CollegePortalQuestionBank = lazy(() => import("./pages/college-portal/QuestionBankPage"));
const CollegePortalAIQuestionGenerator = lazy(
  () => import("./pages/college-portal/AIQuestionGeneratorPage")
);
const CollegePortalAssessments = lazy(
  () => import("./pages/college-portal/AssessmentManagementPage")
);
const CollegePortalCampaigns = lazy(
  () => import("./pages/college-portal/AssessmentCampaignsPage")
);
const CollegePortalCampaignResults = lazy(
  () => import("./pages/college-portal/AssessmentResultsPage")
);
const CollegePortalCampaignAnalytics = lazy(
  () => import("./pages/college-portal/AssessmentAnalyticsPage")
);
const CollegePortalCampaignIntegrity = lazy(
  () => import("./pages/college-portal/AssessmentIntegrityPage")
);;
const CollegeSkillsPage = lazy(() => import("./pages/college/CollegeSkillsPage"));
const LmsModulePage = lazy(() => import("./pages/lms/LmsModulePage"));
const StudentPaymentsPage = lazy(() => import("./pages/student/PaymentsPage"));
const StudentQuestionBankPage = lazy(() => import("./pages/student/QuestionBankPage"));
const StudentWorkflowPage = lazy(() => import("./pages/student/WorkflowPage"));
const StudentPortalLayout = lazy(() => import("./layouts/StudentPortalLayout"));
const StudentDashboardPage = lazy(() => import("./pages/student/portal/DashboardPage"));
const StudentTestsPage = lazy(() => import("./pages/student/portal/TestsPage"));
const StudentMyAssessmentsPage = lazy(
  () => import("./pages/student/portal/MyAssessmentsPage")
);
const StudentAssessmentDetailPage = lazy(
  () => import("./pages/student/portal/my-assessments/AssessmentDetailPage")
);
const StudentAssessmentInstructionsPage = lazy(
  () => import("./pages/student/portal/AssessmentInstructionsPage")
);
const StudentAssessmentAttemptPage = lazy(
  () => import("./pages/student/portal/AssessmentAttemptPage")
);
const StudentAssessmentSubmissionPage = lazy(
  () => import("./pages/student/portal/AssessmentSubmissionPage")
);
const StudentAssessmentCompletionPage = lazy(
  () => import("./pages/student/portal/AssessmentCompletionPage")
);
const StudentAssessmentResultPage = lazy(
  () => import("./pages/student/portal/AssessmentResultPage")
);
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
const ResultsAnalysisPage = lazy(() => import("./pages/student/ResultsAnalysisPage"));
const StudentResultsAnalyticsPage = lazy(
  () => import("./pages/student/portal/ResultsAnalyticsPage")
);
const StudentAttemptReportPage = lazy(
  () => import("./pages/student/portal/results/AttemptReportPage")
);
const StudentSettingsPage = lazy(() => import("./pages/student/portal/StudentSettingsPage"));
const MockExamPlayer = lazy(() => import("./pages/student/MockExamPlayer"));
const StudentProfile = lazy(() => import("./pages/student/StudentProfile"));
const StudentSessionsPage = lazy(() => import("./pages/student/SessionsPage"));
const PracticePage = lazy(() => import("./pages/student/PracticePage"));
const VoiceTutorPage = lazy(() => import("./pages/student/VoiceTutorPage"));
const AdaptiveLearningPage = lazy(() => import("./pages/student/AdaptiveLearningPage"));
const AiSearchPage = lazy(() => import("./pages/student/AiSearchPage"));
const DevelopmentPage = lazy(() => import("./pages/student/DevelopmentPage"));
const GamificationPage = lazy(() => import("./pages/student/GamificationPage"));
const MentorDashboardPage = lazy(() => import("./pages/mentor/MentorDashboardPage"));
const FacultyDashboardPage = lazy(() => import("./pages/faculty/FacultyDashboardPage"));

// ── Learning Portal ───────────────────────────────────────────────────────────
const LearnHomePage          = lazy(() => import("./pages/learn/LearnHomePage"));
const LearningPathDetailPage = lazy(() => import("./pages/learn/LearningPathDetailPage"));
const CertificatePage        = lazy(() => import("./pages/learn/CertificatePage"));

const SoftSkillsHubPage = lazy(() => import("./pages/student/SoftSkillsHubPage"));

const StudentLearningPage = lazy(() => import("./pages/lms/StudentLearningPage"));
const CourseDetailPage = lazy(() =>
  import("./pages/lms/StudentLearningPage").then((m) => ({ default: m.CourseDetailPage }))
);
const MyLearningPage = lazy(() => import("./pages/student/portal/my-learning/MyLearningPage"));
const MyLearningPathPage = lazy(() => import("./pages/student/portal/my-learning/PathDetailPage"));
const MyLearningCoursePage = lazy(() => import("./pages/student/portal/my-learning/CourseDetailPage"));
const MyLearningLessonPage = lazy(() => import("./pages/student/portal/my-learning/LessonPlayerPage"));
const MyLearningProgressPage = lazy(() =>
  import("./pages/student/portal/my-learning/SecondaryPages").then((m) => ({ default: m.ProgressPage }))
);
const MyLearningBookmarksPage = lazy(() =>
  import("./pages/student/portal/my-learning/SecondaryPages").then((m) => ({ default: m.BookmarksPage }))
);
const MyLearningCalendarPage = lazy(() =>
  import("./pages/student/portal/my-learning/SecondaryPages").then((m) => ({ default: m.CalendarPage }))
);
const MyLearningCertificatesPage = lazy(() =>
  import("./pages/student/portal/my-learning/SecondaryPages").then((m) => ({ default: m.CertificatesPage }))
);
const MyLearningResourcesPage = lazy(() =>
  import("./pages/student/portal/my-learning/SecondaryPages").then((m) => ({ default: m.ResourcesPage }))
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

// Question Bank (legacy routes — kept working, no longer in the sidebar;
// superseded by AI Learning Companion below)
const SuperAdminQuestionBank = lazy(() => import("./pages/superadmin/question-bank/AllQuestionsPage"));
const SuperAdminAIGenerator = lazy(() => import("./pages/superadmin/question-bank/AIGeneratorPage"));
const SuperAdminCategories = lazy(() => import("./pages/superadmin/question-bank/CategoriesPage"));
const SuperAdminReviewQueue = lazy(() => import("./pages/superadmin/question-bank/ReviewQueuePage"));
const SuperAdminImportBooks = lazy(() => import("./pages/superadmin/question-bank/ImportBooksPage"));

// AI Learning Companion (replaces Question Bank as the primary UI — same
// backend, same database, new information architecture)
const LearningCompanionDashboard = lazy(() => import("./pages/superadmin/learning-companion/DashboardPage"));
const LearningCompanionCategories = lazy(() => import("./pages/superadmin/learning-companion/CategoriesPage"));
const LearningCompanionSubjects = lazy(() => import("./pages/superadmin/learning-companion/SubjectsPage"));
const LearningCompanionTopics = lazy(() => import("./pages/superadmin/learning-companion/TopicsPage"));
const LearningCompanionSkills = lazy(() => import("./pages/superadmin/learning-companion/SkillsPage"));
const LearningCompanionContentStudio = lazy(() => import("./pages/superadmin/learning-companion/ContentStudioPage"));
const LearningCompanionReviewCenter = lazy(() => import("./pages/superadmin/learning-companion/ReviewCenterPage"));
const LearningCompanionKnowledgeEngine = lazy(() => import("./pages/superadmin/learning-companion/KnowledgeEnginePage"));
const LearningCompanionAnalytics = lazy(() => import("./pages/superadmin/learning-companion/AiAnalyticsPage"));
const LearningCompanionGraph = lazy(() => import("./pages/superadmin/learning-companion/KnowledgeGraphPage"));
const LearningCompanionImprove = lazy(() => import("./pages/superadmin/learning-companion/ImproveQuestionPage"));
const KnowledgeLibraryLayout = lazy(() => import("./pages/superadmin/knowledge-library/KnowledgeLibraryLayout"));
const KnowledgeLibraryDashboard = lazy(() => import("./pages/superadmin/knowledge-library/DashboardPage"));
const KnowledgeLibraryAll = lazy(() => import("./pages/superadmin/knowledge-library/AllKnowledgePage"));
const KnowledgeLibraryLessons = lazy(() => import("./pages/superadmin/knowledge-library/LessonsAssetPage"));
const KnowledgeLibraryQuestions = lazy(() => import("./pages/superadmin/knowledge-library/QuestionsAssetPage"));
const KnowledgeLibraryCreate = lazy(() => import("./pages/superadmin/knowledge-library/CreateKnowledgeAssetPage"));
const KnowledgeLibraryFlashcards = lazy(() => import("./pages/superadmin/knowledge-library/FlashcardsAssetPage"));
const KnowledgeLibraryCoding = lazy(() => import("./pages/superadmin/knowledge-library/CodingChallengesAssetPage"));
const KnowledgeLibraryVoice = lazy(() => import("./pages/superadmin/knowledge-library/VoiceLessonsAssetPage"));
const KnowledgeLibraryVideos = lazy(() => import("./pages/superadmin/knowledge-library/VideosAssetPage"));
const KnowledgeLibraryCaseStudies = lazy(() =>
  import("./pages/superadmin/knowledge-library/ContentAssetPages").then((m) => ({ default: m.CaseStudiesAssetPage }))
);
const KnowledgeLibraryInterview = lazy(() =>
  import("./pages/superadmin/knowledge-library/ContentAssetPages").then((m) => ({ default: m.InterviewQuestionsAssetPage }))
);
const KnowledgeLibraryDocuments = lazy(() =>
  import("./pages/superadmin/knowledge-library/ContentAssetPages").then((m) => ({ default: m.DocumentsAssetPage }))
);
const KnowledgeLibraryOrganization = lazy(() => import("./pages/superadmin/knowledge-library/OrganizationHubPage"));
const KnowledgeLibraryCategoriesOrg = lazy(() => import("./pages/superadmin/knowledge-library/CategoriesOrgPage"));
const KnowledgeLibrarySubjectsOrg = lazy(() => import("./pages/superadmin/knowledge-library/SubjectsOrgPage"));
const KnowledgeLibraryTopicsOrg = lazy(() => import("./pages/superadmin/knowledge-library/TopicsOrgPage"));
const KnowledgeLibrarySkillsOrg = lazy(() => import("./pages/superadmin/knowledge-library/SkillsOrgPage"));
const KnowledgeLibraryTagsOrg = lazy(() => import("./pages/superadmin/knowledge-library/TagsOrgPage"));
const KnowledgeLibraryCollections = lazy(() => import("./pages/superadmin/knowledge-library/CollectionsPage"));
const KnowledgeLibraryTopicDetail = lazy(() => import("./pages/superadmin/knowledge-library/TopicDetailPage"));
const KnowledgeLibraryAiHub = lazy(() => import("./pages/superadmin/knowledge-library/ai/AiHubPage"));
const KnowledgeLibraryAiSearch = lazy(() => import("./pages/superadmin/knowledge-library/ai/AiSearchToolPage"));
const KnowledgeLibraryAiMetadata = lazy(() => import("./pages/superadmin/knowledge-library/ai/AiMetadataToolPage"));
const KnowledgeLibraryAiTranslate = lazy(() => import("./pages/superadmin/knowledge-library/ai/AiTranslateToolPage"));
const KnowledgeLibraryAiVoice = lazy(() => import("./pages/superadmin/knowledge-library/ai/AiVoiceToolPage"));
const KnowledgeLibraryAiEmbeddings = lazy(() => import("./pages/superadmin/knowledge-library/ai/AiEmbeddingsToolPage"));
const KnowledgeLibraryAiDuplicates = lazy(() =>
  import("./pages/superadmin/knowledge-library/ai/AiRelatedDupesPages").then((m) => ({ default: m.AiDuplicatesToolPage }))
);
const KnowledgeLibraryAiRelated = lazy(() =>
  import("./pages/superadmin/knowledge-library/ai/AiRelatedDupesPages").then((m) => ({ default: m.AiRelatedToolPage }))
);
const KnowledgeLibraryEnterprise = lazy(() => import("./pages/superadmin/knowledge-library/enterprise/EnterpriseHubPage"));
const KnowledgeLibraryEnterpriseVersions = lazy(() => import("./pages/superadmin/knowledge-library/enterprise/EnterpriseVersionsPage"));
const KnowledgeLibraryEnterpriseArchive = lazy(() => import("./pages/superadmin/knowledge-library/enterprise/EnterpriseArchivePage"));
const KnowledgeLibraryEnterpriseBulk = lazy(() => import("./pages/superadmin/knowledge-library/enterprise/EnterpriseBulkPage"));
const KnowledgeLibraryEnterpriseImportExport = lazy(() => import("./pages/superadmin/knowledge-library/enterprise/EnterpriseImportExportPage"));
const KnowledgeLibraryEnterpriseAnalytics = lazy(() => import("./pages/superadmin/knowledge-library/enterprise/EnterpriseAnalyticsPage"));
const LegacyLibraryRedirect = lazy(() => import("./pages/superadmin/knowledge-library/LegacyLibraryRedirect"));
const CompanyManagementPage = lazy(() => import("./pages/superadmin/companies/CompanyManagementPage"));
const RecruitmentManagementPage = lazy(() => import("./pages/superadmin/recruitment/RecruitmentManagementPage"));
const PlacementAnalyticsPage = lazy(() => import("./pages/superadmin/analytics/PlacementAnalyticsPage"));
const OrgComingSoonRoute = lazy(() => import("./pages/superadmin/organization/OrgComingSoonRoute"));
const FeatureComingSoonRoute = lazy(() => import("./pages/superadmin/FeatureComingSoonRoute"));
const CoursesPage = lazy(() => import("./pages/superadmin/courses/CoursesPage"));
const AdminCourseDetailPage = lazy(() => import("./pages/superadmin/courses/CourseDetailPage"));
const CourseBuilderLayout = lazy(() => import("./pages/superadmin/course-builder/CourseBuilderLayout"));
const CourseBuilderDashboard = lazy(() => import("./pages/superadmin/course-builder/DashboardPage"));
const CourseBuilderList = lazy(() => import("./pages/superadmin/course-builder/CourseListPage"));
const CourseBuilderNew = lazy(() => import("./pages/superadmin/course-builder/NewCourseWizardPage"));
const CourseBuilderWorkspace = lazy(() => import("./pages/superadmin/course-builder/CourseWorkspacePage"));
const CourseBuilderAiStub = lazy(() => import("./pages/superadmin/course-builder/AiCourseBuilderPage"));
const CourseBuilderTemplatesStub = lazy(() => import("./pages/superadmin/course-builder/TemplatesPage"));
const CourseBuilderReviewStub = lazy(() => import("./pages/superadmin/course-builder/ReviewPublishPage"));
const CourseBuilderAnalytics = lazy(() => import("./pages/superadmin/course-builder/CourseBuilderAnalyticsPage"));
const CourseCatalogLayout = lazy(() => import("./pages/superadmin/course-catalog/CourseCatalogLayout"));
const CatalogDashboardPage = lazy(() => import("./pages/superadmin/course-catalog/CatalogDashboardPage"));
const PlacementTracksPage = lazy(() =>
  import("./pages/superadmin/course-catalog/PlacementTracksPage").then((m) => ({ default: m.PlacementTracksPage }))
);
const PlacementTrackDetailPage = lazy(() =>
  import("./pages/superadmin/course-catalog/PlacementTracksPage").then((m) => ({ default: m.PlacementTrackDetailPage }))
);
const CatalogCoursesBrowsePage = lazy(() => import("./pages/superadmin/course-catalog/CatalogCoursesBrowsePage"));
const CatalogCourseDetailPage = lazy(() => import("./pages/superadmin/course-catalog/CatalogCourseDetailPage"));
const CatalogAnalyticsStubPage = lazy(() => import("./pages/superadmin/course-catalog/CatalogAnalyticsStubPage"));
const LegacyCourseCatalogRedirect = lazy(() => import("./pages/superadmin/course-catalog/LegacyCourseCatalogRedirect"));
const AssessmentHubDashboardPage = lazy(() => import("./pages/superadmin/assessment-hub/AssessmentHubDashboardPage"));
const QuestionBankHubPage = lazy(() => import("./pages/superadmin/assessment-hub/QuestionBankHubPage"));
const LearningJourneyLayout = lazy(() => import("./pages/superadmin/learning-journey/LearningJourneyLayout"));
const JourneyDashboardPage = lazy(() => import("./pages/superadmin/learning-journey/JourneyDashboardPage"));
const JourneyTemplatesListPage = lazy(() => import("./pages/superadmin/learning-journey/JourneyTemplatesListPage"));
const StudentJourneysStub = lazy(() =>
  import("./pages/superadmin/learning-journey/JourneyStubs").then((m) => ({ default: m.StudentJourneysStub }))
);
const JourneyPlacementTracksStub = lazy(() =>
  import("./pages/superadmin/learning-journey/JourneyStubs").then((m) => ({ default: m.PlacementTracksStub }))
);
const JourneyAiRecommendationsStub = lazy(() =>
  import("./pages/superadmin/learning-journey/JourneyStubs").then((m) => ({ default: m.AiRecommendationsStub }))
);
const JourneyMilestonesStub = lazy(() =>
  import("./pages/superadmin/learning-journey/JourneyStubs").then((m) => ({ default: m.MilestonesStub }))
);
const JourneyProgressStub = lazy(() =>
  import("./pages/superadmin/learning-journey/JourneyStubs").then((m) => ({ default: m.ProgressMonitoringStub }))
);
const JourneyDailyPlanStub = lazy(() =>
  import("./pages/superadmin/learning-journey/JourneyStubs").then((m) => ({ default: m.DailyPlanStub }))
);
const JourneyWeeklyGoalsStub = lazy(() =>
  import("./pages/superadmin/learning-journey/JourneyStubs").then((m) => ({ default: m.WeeklyGoalsStub }))
);
const JourneyRevisionStub = lazy(() =>
  import("./pages/superadmin/learning-journey/JourneyStubs").then((m) => ({ default: m.RevisionPlannerStub }))
);
const JourneyAnalyticsStub = lazy(() =>
  import("./pages/superadmin/learning-journey/JourneyStubs").then((m) => ({ default: m.JourneyAnalyticsStub }))
);
const QuestionCollectionsPage = lazy(() => import("./pages/superadmin/question-collections/QuestionCollectionsPage"));
const QuestionCollectionDetailPage = lazy(() => import("./pages/superadmin/question-collections/QuestionCollectionDetailPage"));
const LessonsLibraryPage = lazy(() => import("./pages/superadmin/features/LessonsLibraryPage"));
const VoiceLessonsLibraryPage = lazy(() => import("./pages/superadmin/features/VoiceLessonsLibraryPage"));
const FlashcardsLibraryPage = lazy(() => import("./pages/superadmin/features/FlashcardsLibraryPage"));
const InterviewQuestionsPage = lazy(() => import("./pages/superadmin/features/InterviewQuestionsPage"));
const CaseStudiesPage = lazy(() => import("./pages/superadmin/features/CaseStudiesPage"));
const LearningResourcesPage = lazy(() => import("./pages/superadmin/features/LearningResourcesPage"));
const ResourceLibraryPage = lazy(() => import("./pages/superadmin/features/ResourceLibraryPage"));
const AssessmentTemplatesPage = lazy(() => import("./pages/superadmin/features/AssessmentTemplatesPage"));
const TemplateFormPage = lazy(() => import("./pages/superadmin/features/templates/TemplateFormPage"));
const TemplatePreviewPage = lazy(() => import("./pages/superadmin/features/templates/TemplatePreviewPage"));
const CodingAssessmentsPage = lazy(() => import("./pages/superadmin/features/CodingAssessmentsPage"));
const MockTestsPage = lazy(() => import("./pages/superadmin/features/MockTestsPage"));
const PracticeSetsPage = lazy(() => import("./pages/superadmin/features/PracticeSetsPage"));
const AssessmentResultsPage = lazy(() => import("./pages/superadmin/features/AssessmentResultsPage"));
const ContentImproverLandingPage = lazy(() => import("./pages/superadmin/features/ContentImproverLandingPage"));
const TranslationStudioPage = lazy(() => import("./pages/superadmin/features/TranslationStudioPage"));
const EmbeddingManagerPage = lazy(() => import("./pages/superadmin/features/EmbeddingManagerPage"));
const AiTutorVoicesPage = lazy(() => import("./pages/superadmin/features/AiTutorVoicesPage"));
const VoiceLanguagesPage = lazy(() => import("./pages/superadmin/features/VoiceLanguagesPage"));
const AudioLibraryPage = lazy(() => import("./pages/superadmin/features/AudioLibraryPage"));
const VoiceTemplatesPage = lazy(() => import("./pages/superadmin/features/VoiceTemplatesPage"));
const SkillsAnalyticsPage = lazy(() => import("./pages/superadmin/features/SkillsAnalyticsPage"));
const AssessmentsAnalyticsPage = lazy(() => import("./pages/superadmin/features/AssessmentsAnalyticsPage"));
const LicensePage = lazy(() => import("./pages/superadmin/features/LicensePage"));
const BatchesPage = lazy(() => import("./pages/superadmin/features/BatchesPage"));
const EnrollmentsPage = lazy(() => import("./pages/superadmin/features/EnrollmentsPage"));
const CertificatesAdminPage = lazy(() => import("./pages/superadmin/features/CertificatesPage"));
const AiAssistantPage = lazy(() => import("./pages/superadmin/features/AiAssistantPage"));
const LearningAnalyticsPage = lazy(() => import("./pages/superadmin/features/LearningAnalyticsPage"));
const StudentAnalyticsPage = lazy(() => import("./pages/superadmin/features/StudentAnalyticsPage"));
const CourseAnalyticsPage = lazy(() => import("./pages/superadmin/features/CourseAnalyticsPage"));
const VoiceAnalyticsPage = lazy(() => import("./pages/superadmin/features/VoiceAnalyticsPage"));
const BrandingPage = lazy(() => import("./pages/superadmin/features/BrandingPage"));
const IntegrationsPage = lazy(() => import("./pages/superadmin/features/IntegrationsPage"));


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

              {/* Question Bank — Assessment Hub master repository hub + legacy tools */}
              <Route path="question-bank" element={<PermissionGuard permission="assessments_view" redirect><QuestionBankHubPage /></PermissionGuard>} />
              <Route path="question-bank/browse" element={<PermissionGuard permission="assessments_view" redirect><SuperAdminQuestionBank /></PermissionGuard>} />
              <Route path="question-bank/ai-generator" element={<PermissionGuard permission="assessments_manage" redirect><SuperAdminAIGenerator /></PermissionGuard>} />
              <Route path="question-bank/categories" element={<PermissionGuard permission="assessments_view" redirect><SuperAdminCategories /></PermissionGuard>} />
              <Route path="question-bank/review-queue" element={<PermissionGuard permission="assessments_view" redirect><SuperAdminReviewQueue /></PermissionGuard>} />
              <Route path="question-bank/import-books" element={<PermissionGuard permission="assessments_manage" redirect><SuperAdminImportBooks /></PermissionGuard>} />

              {/* AI Learning Companion — replaces Question Bank as the primary UI.
                  Same backend/database. Phase 2: AI Content Studio (below) replaces
                  AI Generator + Import from Books as the sidebar entry point for
                  content creation — those two routes stay live (direct links still
                  work) but are no longer linked from the sidebar. Review Queue is
                  unaffected and still reachable. */}
              <Route path="learning-companion" element={<PermissionGuard permission="assessments_view" redirect><LearningCompanionDashboard /></PermissionGuard>} />
              <Route path="learning-companion/library" element={<LegacyLibraryRedirect />} />
              <Route path="knowledge-library" element={<PermissionGuard permission="assessments_view" redirect><KnowledgeLibraryLayout /></PermissionGuard>}>
                <Route index element={<KnowledgeLibraryDashboard />} />
                <Route path="all" element={<KnowledgeLibraryAll />} />
                <Route path="assets/lessons" element={<KnowledgeLibraryLessons />} />
                <Route path="assets/questions" element={<KnowledgeLibraryQuestions />} />
                <Route path="assets/flashcards" element={<KnowledgeLibraryFlashcards />} />
                <Route path="assets/coding" element={<KnowledgeLibraryCoding />} />
                <Route path="assets/case-studies" element={<KnowledgeLibraryCaseStudies />} />
                <Route path="assets/interview-questions" element={<KnowledgeLibraryInterview />} />
                <Route path="assets/voice-lessons" element={<KnowledgeLibraryVoice />} />
                <Route path="assets/videos" element={<KnowledgeLibraryVideos />} />
                <Route path="assets/documents" element={<KnowledgeLibraryDocuments />} />
                <Route path="organization" element={<KnowledgeLibraryOrganization />} />
                <Route path="organization/categories" element={<KnowledgeLibraryCategoriesOrg />} />
                <Route path="organization/subjects" element={<KnowledgeLibrarySubjectsOrg />} />
                <Route path="organization/topics" element={<KnowledgeLibraryTopicsOrg />} />
                <Route path="organization/skills" element={<KnowledgeLibrarySkillsOrg />} />
                <Route path="organization/tags" element={<KnowledgeLibraryTagsOrg />} />
                <Route path="collections" element={<KnowledgeLibraryCollections />} />
                <Route path="topics/:topicId" element={<KnowledgeLibraryTopicDetail />} />
                <Route path="ai" element={<KnowledgeLibraryAiHub />} />
                <Route path="ai/search" element={<KnowledgeLibraryAiSearch />} />
                <Route path="ai/metadata" element={<KnowledgeLibraryAiMetadata />} />
                <Route path="ai/translate" element={<KnowledgeLibraryAiTranslate />} />
                <Route path="ai/voice" element={<KnowledgeLibraryAiVoice />} />
                <Route path="ai/embeddings" element={<KnowledgeLibraryAiEmbeddings />} />
                <Route path="ai/duplicates" element={<KnowledgeLibraryAiDuplicates />} />
                <Route path="ai/related" element={<KnowledgeLibraryAiRelated />} />
                <Route path="enterprise" element={<KnowledgeLibraryEnterprise />} />
                <Route path="enterprise/versions" element={<KnowledgeLibraryEnterpriseVersions />} />
                <Route path="enterprise/archive" element={<KnowledgeLibraryEnterpriseArchive />} />
                <Route path="enterprise/bulk" element={<KnowledgeLibraryEnterpriseBulk />} />
                <Route path="enterprise/import-export" element={<KnowledgeLibraryEnterpriseImportExport />} />
                <Route path="enterprise/analytics" element={<KnowledgeLibraryEnterpriseAnalytics />} />
                <Route path="create" element={<KnowledgeLibraryCreate />} />
              </Route>
              <Route path="learning-companion/categories" element={<PermissionGuard permission="assessments_view" redirect><LearningCompanionCategories /></PermissionGuard>} />
              <Route path="learning-companion/subjects" element={<PermissionGuard permission="assessments_view" redirect><LearningCompanionSubjects /></PermissionGuard>} />
              <Route path="learning-companion/topics" element={<PermissionGuard permission="assessments_view" redirect><LearningCompanionTopics /></PermissionGuard>} />
              <Route path="learning-companion/skills" element={<PermissionGuard permission="assessments_view" redirect><LearningCompanionSkills /></PermissionGuard>} />
              <Route path="learning-companion/studio" element={<PermissionGuard permission="assessments_manage" redirect><LearningCompanionContentStudio /></PermissionGuard>} />
              <Route path="learning-companion/review" element={<PermissionGuard permission="assessments_manage" redirect><LearningCompanionReviewCenter /></PermissionGuard>} />
              <Route path="learning-companion/knowledge-engine" element={<PermissionGuard permission="assessments_manage" redirect><LearningCompanionKnowledgeEngine /></PermissionGuard>} />
              <Route path="learning-companion/analytics" element={<PermissionGuard permission="analytics_view" redirect><LearningCompanionAnalytics /></PermissionGuard>} />
              <Route path="learning-companion/graph" element={<PermissionGuard permission="analytics_view" redirect><LearningCompanionGraph /></PermissionGuard>} />
              <Route path="learning-companion/improve/:questionId" element={<PermissionGuard permission="assessments_manage" redirect><LearningCompanionImprove /></PermissionGuard>} />
              <Route path="companies" element={<PermissionGuard permission="colleges_manage" redirect><CompanyManagementPage /></PermissionGuard>} />
              <Route path="recruitment" element={<PermissionGuard permission="colleges_manage" redirect><RecruitmentManagementPage /></PermissionGuard>} />
              <Route path="placement-analytics" element={<PermissionGuard permission="analytics_view" redirect><PlacementAnalyticsPage /></PermissionGuard>} />
              <Route path="organization/:entity" element={<PermissionGuard permission="colleges_manage" redirect><OrgComingSoonRoute /></PermissionGuard>} />
              <Route path="coming-soon/:feature" element={<PermissionGuard permission="dashboard_view" redirect><FeatureComingSoonRoute /></PermissionGuard>} />

              {/* Legacy type views → Knowledge Library Sprint 2 */}
              <Route path="library/lessons" element={<Navigate to="/app/superadmin/knowledge-library/assets/lessons" replace />} />
              <Route path="library/flashcards" element={<Navigate to="/app/superadmin/knowledge-library/assets/flashcards" replace />} />
              <Route path="library/voice-lessons" element={<Navigate to="/app/superadmin/knowledge-library/assets/voice-lessons" replace />} />
              <Route path="library/interview-questions" element={<Navigate to="/app/superadmin/knowledge-library/assets/interview-questions" replace />} />
              <Route path="library/case-studies" element={<Navigate to="/app/superadmin/knowledge-library/assets/case-studies" replace />} />
              <Route path="library/learning-resources" element={<Navigate to="/app/superadmin/knowledge-library/assets/documents" replace />} />
              <Route path="journey-templates" element={<Navigate to="/app/superadmin/learning-journey/templates" replace />} />
              <Route path="resource-library" element={<PermissionGuard permission="assessments_view" redirect><ResourceLibraryPage /></PermissionGuard>} />
              <Route path="ai-assistant" element={<PermissionGuard permission="assessments_manage" redirect><AiAssistantPage /></PermissionGuard>} />
              <Route path="ai-studio/content-improver" element={<PermissionGuard permission="assessments_manage" redirect><ContentImproverLandingPage /></PermissionGuard>} />
              <Route path="ai-studio/translation" element={<PermissionGuard permission="assessments_manage" redirect><TranslationStudioPage /></PermissionGuard>} />
              <Route path="ai-studio/embeddings" element={<PermissionGuard permission="assessments_manage" redirect><EmbeddingManagerPage /></PermissionGuard>} />
              <Route path="voice-studio/tutor-voices" element={<PermissionGuard permission="settings_view" redirect><AiTutorVoicesPage /></PermissionGuard>} />
              <Route path="voice-studio/languages" element={<PermissionGuard permission="settings_view" redirect><VoiceLanguagesPage /></PermissionGuard>} />
              <Route path="voice-studio/audio-library" element={<PermissionGuard permission="assessments_view" redirect><AudioLibraryPage /></PermissionGuard>} />
              <Route path="voice-studio/templates" element={<PermissionGuard permission="settings_view" redirect><VoiceTemplatesPage /></PermissionGuard>} />
              <Route path="mock-tests" element={<PermissionGuard permission="assessments_manage" redirect><MockTestsPage /></PermissionGuard>} />
              <Route path="practice-sets" element={<PermissionGuard permission="assessments_manage" redirect><PracticeSetsPage /></PermissionGuard>} />
              <Route path="coding-assessments" element={<PermissionGuard permission="assessments_manage" redirect><CodingAssessmentsPage /></PermissionGuard>} />
              <Route path="assessment-templates" element={<PermissionGuard permission="assessments_manage" redirect><AssessmentTemplatesPage /></PermissionGuard>} />
              <Route path="assessment-templates/new" element={<PermissionGuard permission="assessments_manage" redirect><TemplateFormPage /></PermissionGuard>} />
              <Route path="assessment-templates/:id/preview" element={<PermissionGuard permission="assessments_manage" redirect><TemplatePreviewPage /></PermissionGuard>} />
              <Route path="assessment-templates/:id" element={<PermissionGuard permission="assessments_manage" redirect><TemplateFormPage /></PermissionGuard>} />
              <Route path="assessment-results" element={<PermissionGuard permission="assessments_view" redirect><AssessmentResultsPage /></PermissionGuard>} />
              <Route path="batches" element={<PermissionGuard permission="colleges_manage" redirect><BatchesPage /></PermissionGuard>} />
              <Route path="enrollments" element={<PermissionGuard permission="colleges_manage" redirect><EnrollmentsPage /></PermissionGuard>} />
              <Route path="certificates" element={<PermissionGuard permission="assessments_view" redirect><CertificatesAdminPage /></PermissionGuard>} />
              <Route path="analytics/learning" element={<PermissionGuard permission="analytics_view" redirect><LearningAnalyticsPage /></PermissionGuard>} />
              <Route path="analytics/students" element={<PermissionGuard permission="analytics_view" redirect><StudentAnalyticsPage /></PermissionGuard>} />
              <Route path="analytics/courses" element={<PermissionGuard permission="analytics_view" redirect><CourseAnalyticsPage /></PermissionGuard>} />
              <Route path="analytics/voice" element={<PermissionGuard permission="analytics_view" redirect><VoiceAnalyticsPage /></PermissionGuard>} />
              <Route path="analytics/skills" element={<PermissionGuard permission="analytics_view" redirect><SkillsAnalyticsPage /></PermissionGuard>} />
              <Route path="analytics/assessments" element={<PermissionGuard permission="analytics_view" redirect><AssessmentsAnalyticsPage /></PermissionGuard>} />
              <Route path="branding" element={<PermissionGuard permission="settings_view" redirect><BrandingPage /></PermissionGuard>} />
              <Route path="integrations" element={<PermissionGuard permission="settings_view" redirect><IntegrationsPage /></PermissionGuard>} />
              <Route path="license" element={<PermissionGuard permission="billing_view" redirect><LicensePage /></PermissionGuard>} />

              <Route path="course-builder" element={<PermissionGuard permission="assessments_manage" redirect><CourseBuilderLayout /></PermissionGuard>}>
                <Route index element={<CourseBuilderDashboard />} />
                <Route path="all" element={<CourseBuilderList />} />
                <Route path="draft" element={<CourseBuilderList />} />
                <Route path="published" element={<CourseBuilderList />} />
                <Route path="archived" element={<CourseBuilderList />} />
                <Route path="new" element={<CourseBuilderNew />} />
                <Route path="ai" element={<CourseBuilderAiStub />} />
                <Route path="templates" element={<CourseBuilderTemplatesStub />} />
                <Route path="review" element={<CourseBuilderReviewStub />} />
                <Route path="analytics" element={<CourseBuilderAnalytics />} />
                <Route path=":courseId" element={<CourseBuilderWorkspace />} />
              </Route>

              <Route path="course-catalog" element={<PermissionGuard permission="assessments_manage" redirect><CourseCatalogLayout /></PermissionGuard>}>
                <Route index element={<CatalogDashboardPage />} />
                <Route path="tracks" element={<PlacementTracksPage />} />
                <Route path="tracks/:slug" element={<PlacementTrackDetailPage />} />
                <Route path="all" element={<CatalogCoursesBrowsePage />} />
                <Route path="featured" element={<CatalogCoursesBrowsePage />} />
                <Route path="recent" element={<CatalogCoursesBrowsePage />} />
                <Route path="drafts" element={<CatalogCoursesBrowsePage />} />
                <Route path="archived" element={<CatalogCoursesBrowsePage />} />
                <Route path="analytics" element={<CatalogAnalyticsStubPage />} />
                <Route path="courses/:courseId" element={<CatalogCourseDetailPage />} />
              </Route>

              <Route path="learning-journey" element={<PermissionGuard permission="assessments_manage" redirect><LearningJourneyLayout /></PermissionGuard>}>
                <Route index element={<JourneyDashboardPage />} />
                <Route path="templates" element={<JourneyTemplatesListPage />} />
                <Route path="student-journeys" element={<StudentJourneysStub />} />
                <Route path="placement-tracks" element={<JourneyPlacementTracksStub />} />
                <Route path="ai-recommendations" element={<JourneyAiRecommendationsStub />} />
                <Route path="milestones" element={<JourneyMilestonesStub />} />
                <Route path="progress" element={<JourneyProgressStub />} />
                <Route path="daily-plan" element={<JourneyDailyPlanStub />} />
                <Route path="weekly-goals" element={<JourneyWeeklyGoalsStub />} />
                <Route path="revision" element={<JourneyRevisionStub />} />
                <Route path="analytics" element={<JourneyAnalyticsStub />} />
              </Route>

              <Route path="courses" element={<Navigate to="/app/superadmin/course-catalog/tracks" replace />} />
              <Route path="courses/:courseId" element={<LegacyCourseCatalogRedirect />} />
              <Route path="question-collections" element={<PermissionGuard permission="assessments_manage" redirect><QuestionCollectionsPage /></PermissionGuard>} />
              <Route path="question-collections/:collectionId" element={<PermissionGuard permission="assessments_manage" redirect><QuestionCollectionDetailPage /></PermissionGuard>} />

              <Route path="assessment-hub" element={<PermissionGuard permission="assessments_manage" redirect><AssessmentHubDashboardPage /></PermissionGuard>} />

              {/* Assessment Builder — mirrors /app/drives/* so the superadmin sidebar shell
                  never switches to DashboardLayout. Same components, base path is computed
                  from location.pathname inside them. /app/drives/* stays untouched for
                  hr/engineer/college_admin, who still use DashboardLayout. */}
              <Route path="drives" element={<PermissionGuard permission="assessments_manage" redirect><DrivesDashboardPage /></PermissionGuard>} />
              <Route path="drives/new" element={<PermissionGuard permission="assessments_manage" redirect><CreateDrivePage /></PermissionGuard>} />
              <Route path="drives/:id" element={<PermissionGuard permission="assessments_manage" redirect><DriveDetailPage /></PermissionGuard>} />
              <Route path="drives/:id/assign-campus" element={<PermissionGuard permission="assessments_manage" redirect><AssignCampusPage /></PermissionGuard>} />

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
                  <RoleGuard
                    allowed={[
                      "college_admin",
                      "college",
                      "college_staff",
                      "instructor",
                      "placement_cell",
                    ]}
                  >
                    <CollegeLayout />
                  </RoleGuard>
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/app/college-portal/dashboard" replace />} />
              <Route path="dashboard" element={<CollegePortalDashboard />} />
              <Route path="students" element={<CollegePortalStudents />} />
              <Route path="students/new" element={<CollegePortalStudentForm />} />
              <Route path="students/:id/edit" element={<CollegePortalStudentForm />} />
              <Route path="students/:id" element={<CollegePortalStudentDetail />} />
              <Route path="question-bank" element={<CollegePortalQuestionBank />} />
              <Route
                path="question-bank/ai-generate"
                element={
                  <CollegeFeatureGuard feature="ai_question_generation">
                    <CollegePortalAIQuestionGenerator />
                  </CollegeFeatureGuard>
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
              <Route path="assessments" element={<CollegePortalAssessments />} />
              <Route path="campaigns" element={<CollegePortalCampaigns />} />
              <Route
                path="campaigns/:campaignId/results"
                element={<CollegePortalCampaignResults />}
              />
              <Route
                path="campaigns/:campaignId/analytics"
                element={<CollegePortalCampaignAnalytics />}
              />
              <Route
                path="campaigns/:campaignId/integrity"
                element={<CollegePortalCampaignIntegrity />}
              />
              <Route path="drives" element={<CampusDrivesListPage />} />
              <Route path="drives/:id" element={<CampusDriveDetailPage />} />
              <Route path="analytics" element={<CollegePortalAnalytics />} />
              <Route path="evaluation-insights" element={<CollegePortalEvaluationInsights />} />
              <Route path="integrity" element={<CampusIntegrityPage />} />
              <Route path="soft-skills" element={<CollegeSkillsPage />} />
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
              <Route path="settings/departments" element={<CollegePortalDepartmentsSettings />} />
              <Route path="results" element={<CampusResultsPage />} />
              <Route path="insights" element={<CampusInsightsPage />} />
              <Route path="communications" element={<CampusCommunicationsPage />} />
              <Route
                path="billing"
                element={
                  <RoleGuard allowed={["college_admin", "college"]}>
                    <BillingPage />
                  </RoleGuard>
                }
              />
              <Route
                path="campus-admins"
                element={
                  <RoleGuard allowed={["college_admin", "college"]}>
                    <CampusAdminsPage />
                  </RoleGuard>
                }
              />
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
              <Route path="my-learning" element={<MyLearningPage />} />
              <Route path="my-learning/paths/:pathId" element={<MyLearningPathPage />} />
              <Route path="my-learning/courses/:courseId" element={<MyLearningCoursePage />} />
              <Route path="my-learning/lessons/:lessonId" element={<MyLearningLessonPage />} />
              <Route path="my-learning/progress" element={<MyLearningProgressPage />} />
              <Route path="my-learning/bookmarks" element={<MyLearningBookmarksPage />} />
              <Route path="my-learning/calendar" element={<MyLearningCalendarPage />} />
              <Route path="my-learning/certificates" element={<MyLearningCertificatesPage />} />
              <Route path="my-learning/resources" element={<MyLearningResourcesPage />} />
              <Route path="learn" element={<StudentLearnPage />} />
              <Route path="practice" element={<PracticePage />} />
              <Route path="voice-tutor/:questionId" element={<VoiceTutorPage />} />
              <Route path="adaptive-learning" element={<AdaptiveLearningPage />} />
              <Route path="ai-search" element={<AiSearchPage />} />
              <Route path="my-assessments" element={<StudentMyAssessmentsPage />} />
              <Route path="my-assessments/:campaignId" element={<StudentAssessmentDetailPage />} />
              <Route
                path="my-assessments/:campaignId/instructions"
                element={<StudentAssessmentInstructionsPage />}
              />
              <Route
                path="my-assessments/:campaignId/complete"
                element={<StudentAssessmentCompletionPage />}
              />
              <Route
                path="my-assessments/:campaignId/result"
                element={<StudentAssessmentResultPage />}
              />
              <Route path="tests" element={<StudentTestsPage />} />
              <Route path="results" element={<StudentResultsAnalyticsPage />} />
              <Route path="results/report/:attemptId" element={<StudentAttemptReportPage />} />
              <Route path="results/:driveId" element={<ResultsAnalysisPage />} />
              <Route path="question-bank" element={<StudentQuestionBankPage />} />
              <Route path="achievements" element={<GamificationPage />} />
              <Route path="payments" element={<StudentPaymentsPage />} />
              <Route path="notifications" element={<StudentNotificationsPage />} />
              <Route path="profile" element={<StudentProfile />} />
              <Route path="settings" element={<StudentSettingsPage />} />
              <Route path="sessions" element={<StudentSessionsPage />} />
              <Route path="lms/:moduleKey" element={<LmsModulePage portal="student" />} />
              <Route path="soft-skills" element={<SoftSkillsHubPage />} />
              <Route path="development" element={<DevelopmentPage />} />
              <Route path="exam/:driveId/instructions" element={<ExamInstructionsPage />} />
              <Route path="programs/:programId" element={<StudentProgramPage />} />
              <Route path="programs/:programId/modules/:moduleId" element={<ModulePlayerPage />} />
            </Route>

            {/* ── Student onboarding (protected, student role) ────────── */}
            <Route
              path="/student-onboarding"
              element={
                <ProtectedRoute>
                  <RoleGuard allowed={["student"]}>
                    <StudentOnboardingWizard />
                  </RoleGuard>
                </ProtectedRoute>
              }
            />

            {/* ── Module 06 Assessment Workspace (full-screen, no portal chrome) ── */}
            <Route
              path="/app/student-portal/my-assessments/:campaignId/attempt"
              element={
                <ProtectedRoute>
                  <RoleGuard allowed={["student"]}>
                    <StudentAssessmentAttemptPage />
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/student-portal/my-assessments/:campaignId/submit"
              element={
                <ProtectedRoute>
                  <RoleGuard allowed={["student"]}>
                    <StudentAssessmentSubmissionPage />
                  </RoleGuard>
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
                path="faculty-dashboard"
                element={
                  <RoleGuard allowed={["instructor", "super_admin", "hr"]}>
                    <FacultyDashboardPage />
                  </RoleGuard>
                }
              />
              <Route
                path="placement-cell-dashboard"
                element={
                  <RoleGuard allowed={["placement_cell", "super_admin", "hr", "college_admin"]}>
                    <PlacementCellDashboardPage />
                  </RoleGuard>
                }
              />
              {/* College Profile — view-only for Placement Cell / Faculty (no sidebar change) */}
              <Route
                path="college-profile"
                element={
                  <RoleGuard
                    allowed={[
                      "placement_cell",
                      "instructor",
                      "college_admin",
                      "college",
                      "college_staff",
                      "super_admin",
                      "hr",
                    ]}
                  >
                    <CampusSettingsPage />
                  </RoleGuard>
                }
              />
              {/* Sprint 2.1 — Student Details for Placement / Faculty (list page unchanged) */}
              <Route
                path="college-student/:id"
                element={
                  <RoleGuard
                    allowed={[
                      "placement_cell",
                      "instructor",
                      "college_admin",
                      "college",
                      "college_staff",
                      "super_admin",
                      "hr",
                    ]}
                  >
                    <CollegePortalStudentDetail />
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