import { test as base, expect, Page } from "@playwright/test";
import { ConsoleMonitor, NetworkMonitor } from "../utils/monitors";
import { StepLogger } from "../utils/step-logger";
import { PerformanceCollector } from "../utils/performance";
import { LifecycleScreenshots } from "../utils/lifecycle-screenshots";
import { bindDiagnostics } from "../diagnostics/context";
import { runStabilityTeardown } from "../hooks/stability.hooks";
import { LoginPage } from "../pages/auth/LoginPage";
import { PasswordSetupPage } from "../pages/auth/PasswordSetupPage";
import { SuperAdminDashboardPage } from "../pages/superadmin/SuperAdminDashboardPage";
import { CollegesListPage } from "../pages/superadmin/CollegesListPage";
import { CollegeCreatePage } from "../pages/superadmin/CollegeCreatePage";
import { CollegeDetailPage } from "../pages/superadmin/CollegeDetailPage";
import { CampusDashboardPage } from "../pages/college-portal/CampusDashboardPage";
import { StudentsListPage } from "../pages/college-portal/StudentsListPage";
import { StudentFormPage } from "../pages/college-portal/StudentFormPage";
import { StudentOnboardingPage } from "../pages/student/StudentOnboardingPage";
import { StudentDashboardPage } from "../pages/student/StudentDashboardPage";
import { ConfirmModal } from "../components/ConfirmModal";
import { AppNav } from "../components/AppNav";

type DiagnosticsBundle = {
  logger: StepLogger;
  perf: PerformanceCollector;
  shots: LifecycleScreenshots;
};

type Sprint1AFixtures = {
  consoleMon: ConsoleMonitor;
  networkMon: NetworkMonitor;
  /** Auto-armed stability + diagnostics (always runs). */
  _stability: void;
  /** Step logger, performance collector, lifecycle screenshots. */
  diagnostics: DiagnosticsBundle;
  logger: StepLogger;
  perf: PerformanceCollector;
  shots: LifecycleScreenshots;
  loginPage: LoginPage;
  passwordSetupPage: PasswordSetupPage;
  superAdminDashboard: SuperAdminDashboardPage;
  collegesList: CollegesListPage;
  collegeCreate: CollegeCreatePage;
  collegeDetail: CollegeDetailPage;
  campusDashboard: CampusDashboardPage;
  studentsList: StudentsListPage;
  studentForm: StudentFormPage;
  studentOnboarding: StudentOnboardingPage;
  studentDashboard: StudentDashboardPage;
  confirmModal: ConfirmModal;
  appNav: AppNav;
};

/**
 * Sprint 1A fixture pack —
 * monitors + diagnostics + stability teardown + POMs.
 * Existing specs keep working; new fixtures are additive.
 */
export const test = base.extend<Sprint1AFixtures>({
  consoleMon: async ({ page }, use) => {
    const mon = new ConsoleMonitor(page);
    mon.attach();
    await use(mon);
  },
  networkMon: async ({ page }, use) => {
    const mon = new NetworkMonitor(page);
    mon.attach();
    await use(mon);
  },
  diagnostics: async ({ page, consoleMon, networkMon }, use, testInfo) => {
    const logger = new StepLogger(testInfo.titlePath.join(" › "));
    const perf = new PerformanceCollector();
    const shots = new LifecycleScreenshots(testInfo);
    bindDiagnostics(page, { consoleMon, networkMon, logger, perf, shots });
    logger.info("test.start", "test begins", testInfo.title);
    await use({ logger, perf, shots });
  },
  /**
   * Auto fixture — guarantees stability teardown for every Sprint 1A test
   * without requiring specs to declare diagnostics explicitly.
   */
  _stability: [
    async ({ page, consoleMon, networkMon, diagnostics }, use, testInfo) => {
      await use();
      await runStabilityTeardown({
        page,
        testInfo,
        consoleMon,
        networkMon,
        logger: diagnostics.logger,
        perf: diagnostics.perf,
        shots: diagnostics.shots,
      });
    },
    { auto: true },
  ],
  logger: async ({ diagnostics }, use) => {
    await use(diagnostics.logger);
  },
  perf: async ({ diagnostics }, use) => {
    await use(diagnostics.perf);
  },
  shots: async ({ diagnostics }, use) => {
    await use(diagnostics.shots);
  },
  loginPage: async ({ page, consoleMon, networkMon }, use) => {
    await use(new LoginPage(page, consoleMon, networkMon));
  },
  passwordSetupPage: async ({ page, consoleMon, networkMon }, use) => {
    await use(new PasswordSetupPage(page, consoleMon, networkMon));
  },
  superAdminDashboard: async ({ page, consoleMon, networkMon }, use) => {
    await use(new SuperAdminDashboardPage(page, consoleMon, networkMon));
  },
  collegesList: async ({ page, consoleMon, networkMon }, use) => {
    await use(new CollegesListPage(page, consoleMon, networkMon));
  },
  collegeCreate: async ({ page, consoleMon, networkMon }, use) => {
    await use(new CollegeCreatePage(page, consoleMon, networkMon));
  },
  collegeDetail: async ({ page, consoleMon, networkMon }, use) => {
    await use(new CollegeDetailPage(page, consoleMon, networkMon));
  },
  campusDashboard: async ({ page, consoleMon, networkMon }, use) => {
    await use(new CampusDashboardPage(page, consoleMon, networkMon));
  },
  studentsList: async ({ page, consoleMon, networkMon }, use) => {
    await use(new StudentsListPage(page, consoleMon, networkMon));
  },
  studentForm: async ({ page, consoleMon, networkMon }, use) => {
    await use(new StudentFormPage(page, consoleMon, networkMon));
  },
  studentOnboarding: async ({ page, consoleMon, networkMon }, use) => {
    await use(new StudentOnboardingPage(page, consoleMon, networkMon));
  },
  studentDashboard: async ({ page, consoleMon, networkMon }, use) => {
    await use(new StudentDashboardPage(page, consoleMon, networkMon));
  },
  confirmModal: async ({ page }, use) => {
    await use(new ConfirmModal(page));
  },
  appNav: async ({ page }, use) => {
    await use(new AppNav(page));
  },
});

export { expect };
export type { Page };
