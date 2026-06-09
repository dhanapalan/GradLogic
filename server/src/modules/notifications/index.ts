/**
 * NOTIFICATIONS module — public interface.
 *
 * Cross-cutting module. Subscribes to domain events to push notifications.
 */

import { eventBus, type DrivePublishedPayload, type SessionInvalidatedPayload } from "../../shared/event-bus.js";
import { sendNotification } from "../../services/notification.service.js";
import { query } from "../../config/database.js";
import { logger } from "../../config/logger.js";

// Alert enrolled students when a drive is published/scheduled
eventBus.on<DrivePublishedPayload>("DrivePublished", async (payload) => {
  try {
    const students = await query<{ student_id: string }>(
      `SELECT student_id FROM drive_students WHERE drive_id = $1`,
      [payload.driveId],
    );
    for (const s of students) {
      await sendNotification(
        s.student_id,
        "Drive Scheduled",
        `Assessment "${payload.driveName}" has been scheduled. Check your dashboard.`,
        "info",
      );
    }
  } catch (err) {
    logger.error("[Notifications] DrivePublished handler error", err);
  }
});

// Inform student when session is invalidated
eventBus.on<SessionInvalidatedPayload>("SessionInvalidated", async (payload) => {
  try {
    await sendNotification(
      payload.studentId,
      "Session Invalidated",
      `Your exam session has been invalidated. Reason: ${payload.reason}. Please contact support if you believe this is an error.`,
      "error",
    );
  } catch (err) {
    logger.error("[Notifications] SessionInvalidated handler error", err);
  }
});

export { sendNotification } from "../../services/notification.service.js";
