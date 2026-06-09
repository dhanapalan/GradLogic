/**
 * EXAM SESSION module — public interface.
 *
 * Handles the student exam runtime: start, resume, save, submit.
 * Timer authority lives here (server_deadline, BullMQ auto-submit).
 */

export {
  getStudentDrives,
  startSession,
  getSession,
  saveAnswer,
  submitExam,
} from "../../services/examSession.service.js";
