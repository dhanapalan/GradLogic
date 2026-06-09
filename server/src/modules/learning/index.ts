/**
 * LEARNING (LMS) module — public interface.
 *
 * Subscribes to ResultsReleased events to generate personalized learning paths.
 * This is the flagship results→learning loop from the architecture doc.
 */

import { eventBus, type ExamSubmittedPayload } from "../../shared/event-bus.js";
import { logger } from "../../config/logger.js";

// Subscribe to ExamSubmitted — trigger learning path generation
eventBus.on<ExamSubmittedPayload>("ExamSubmitted", async (payload) => {
  // TODO (Phase 4): generate personalized learning path based on score + skill gaps
  // For now: log the event so the subscription wire is proven
  logger.debug("[Learning] ExamSubmitted received", {
    driveId: payload.driveId,
    studentId: payload.studentId,
    score: payload.score,
  });
});

// Re-export LMS service functions as this module's public API
// (LMS routes currently call services directly — migrate them to use this index)
export {};
