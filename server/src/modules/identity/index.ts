/**
 * IDENTITY & ACCESS module — public interface.
 *
 * Covers: login, OAuth, user management, role assignment.
 * Auth middleware is a cross-cutting utility (server/src/middleware/auth.ts)
 * and is used directly — not re-exported here.
 */

export {
  loginUser,
  getMe,
  updatePassword,
  getMicrosoftAuthUrl,
  loginWithMicrosoft,
  registerStudent,
  registerCompany,
} from "../../services/auth.service.js";
