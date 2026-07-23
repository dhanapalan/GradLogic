import { Worker } from "bullmq";
import { getRedis } from "../config/redis.js";
import { logger } from "../config/logger.js";
import { runDailyDigestForAllColleges } from "../services/notificationDigest.service.js";

let _worker: Worker | null = null;

export function startNotificationDigestWorker(): Worker {
  if (_worker) return _worker;

  _worker = new Worker(
    "notification-digest",
    async () => {
      logger.info("[NotificationDigest] running daily digest");
      await runDailyDigestForAllColleges();
      logger.info("[NotificationDigest] daily digest complete");
    },
    { connection: getRedis(), concurrency: 1 }
  );

  _worker.on("failed", (job, err) => {
    logger.error("[NotificationDigest] job failed", { jobId: job?.id, error: err.message });
  });

  logger.info("✓ Notification digest worker started");
  return _worker;
}

export async function stopNotificationDigestWorker(): Promise<void> {
  await _worker?.close();
  _worker = null;
}
