/**
 * LEARNING module — ExamSubmitted runs the continuous learning loop:
 * Evaluate → Weak skills → Knowledge Library lesson → Practice set
 * → Learning Journey → Placement Readiness
 */

import { eventBus, type ExamSubmittedPayload } from "../../shared/event-bus.js";
import { logger } from "../../config/logger.js";
import { recordAssessmentInsightAndIntegrate } from "../../services/assessmentIntegration.service.js";

eventBus.on<ExamSubmittedPayload>("ExamSubmitted", async (payload) => {
  try {
    const result = await recordAssessmentInsightAndIntegrate({
      sessionId: payload.sessionId,
      driveId: payload.driveId,
      studentId: payload.studentId,
      score: payload.score,
    });

    logger.info("[Learning] Continuous learning loop from ExamSubmitted", {
      driveId: payload.driveId,
      studentId: payload.studentId,
      score: payload.score,
      insightId: result.insightId,
      journeysUpdated: result.journeysUpdated,
      avgReadiness: result.avgReadiness,
      recommendedObjectId: result.recommendedObjectId,
      recommendedLessonId: result.recommendedLessonId,
      assignedPracticeDriveId: result.assignedPracticeDriveId,
      loopStatus: result.loopStatus,
    });
  } catch (err) {
    logger.error("[Learning] Continuous learning loop failed on ExamSubmitted", {
      err,
      driveId: payload.driveId,
      studentId: payload.studentId,
    });
  }
});

export {};
