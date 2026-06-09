/**
 * AUDIT module — public interface.
 *
 * Append-only audit log. Every score override, invalidation, or
 * AI-influenced decision must be logged here.
 */

export {
  logLogin,
  logLoginFailure,
  logPermissionDenied,
} from "../../services/audit.service.js";
