import app from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { connectDatabase } from "./config/database.js";
import { connectRedis } from "./config/redis.js";
import { ensureBucket } from "./config/storage.js";
import { initSocketIO } from "./config/socket.js";
import { ensureAuditTable } from "./services/audit.service.js";
import { ensureNotificationTable } from "./services/notification.service.js";
import { applyBootOverrides } from "./services/apiKeyStore.service.js";
import { ensureUserRoleEnum } from "./utils/ensureUserRoleEnum.js";
import { startDriveScheduler } from "./scheduler/driveScheduler.js";
import { startExamTimerWorker, stopExamTimerWorker } from "./workers/examTimer.worker.js";
import { startNotificationDigestWorker, stopNotificationDigestWorker } from "./workers/notificationDigest.worker.js";
import { scheduleDailyDigest } from "./queues/notificationDigest.queue.js";
// Bootstrap module event subscriptions (side-effect imports — order matters)
import "./modules/learning/index.js";
import "./modules/integrity/index.js";
import "./modules/notifications/index.js";
import http from "http";

const server = http.createServer(app);

async function bootstrap(): Promise<void> {
  try {
    // 1. Connect PostgreSQL
    await connectDatabase();

    // 2. Ensure RBAC audit table exists
    await ensureAuditTable();

    // 2b. Ensure Notifications table exists
    await ensureNotificationTable();

    // 2c. Ensure user_role enum includes instructor/mentor/company/etc.
    await ensureUserRoleEnum();
    logger.info("✓ user_role enum ready");

    // 2d. Load any superadmin-configured API key overrides from the DB
    await applyBootOverrides();

    // 3. Connect Redis
    await connectRedis();
    logger.info("✓ Redis connected");

    // 4. Ensure S3/MinIO bucket exists
    await ensureBucket();

    // 5. Initialize Socket.IO for real-time proctoring
    initSocketIO(server);
    logger.info("✓ Socket.IO initialized");

    // 6. Start HTTP server
    server.listen(env.PORT, () => {
      logger.info(`✓ GradLogic server running on port ${env.PORT}`);
      logger.info(`  Environment : ${env.NODE_ENV}`);
      logger.info(`  Client URLs : ${env.CLIENT_URLS.join(", ")}`);
      logger.info(`  AI Engine   : ${env.AI_ENGINE_URL}`);
    });

    // 7. Start drive scheduler (READY→LIVE and LIVE→COMPLETED auto-transitions)
    startDriveScheduler();

    // 8. Start exam timer worker (BullMQ — auto-submits sessions at server_deadline)
    startExamTimerWorker();

    // 9. Start notification digest worker + schedule the daily 6pm run
    startNotificationDigestWorker();
    await scheduleDailyDigest();
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Graceful shutdown
const shutdown = async (signal: string) => {
  logger.info(`${signal} received — shutting down gracefully`);
  await stopExamTimerWorker();
  await stopNotificationDigestWorker();
  server.close(() => {
    logger.info("HTTP server closed");
    process.exit(0);
  });
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

bootstrap();
