/**
 * Diagnostics barrel — quality / stability / reporting utilities.
 * Import from here in new specs; existing flows need no changes.
 */
export { QUALITY } from "../config/quality.config";
export { ConsoleMonitor, NetworkMonitor } from "../utils/monitors";
export { StepLogger } from "../utils/step-logger";
export { PerformanceCollector } from "../utils/performance";
export { LifecycleScreenshots } from "../utils/lifecycle-screenshots";
export {
  validateApiResponse,
  waitAndValidateApi,
  assertLastApi,
  assertJsonSchema,
} from "../utils/api-validator";
export {
  runQualityGates,
  assertTestStability,
  checkBrokenImages,
  checkBasicA11y,
} from "../utils/quality-gates";
export {
  measureLogin,
  measureNavigation,
  measureSave,
  measureLogout,
  measureApi,
} from "../helpers/quality-actions";
export { bindDiagnostics, getDiagnostics, requireDiagnostics } from "./context";
