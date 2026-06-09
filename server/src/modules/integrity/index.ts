/**
 * INTEGRITY module — public interface.
 *
 * Covers: violation recording, integrity score computation, adjudication.
 * Subscribes to ViolationRecorded events to recompute session integrity scores.
 */

import { eventBus, type ViolationRecordedPayload } from "../../shared/event-bus.js";
import { logger } from "../../config/logger.js";

eventBus.on<ViolationRecordedPayload>("ViolationRecorded", async (payload) => {
  // TODO (Phase 3): recompute integrity score for session
  logger.debug("[Integrity] ViolationRecorded received", {
    sessionId: payload.sessionId,
    violationType: payload.violationType,
  });
});

export {};
