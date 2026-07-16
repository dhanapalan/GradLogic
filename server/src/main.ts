/**
 * NestJS entry point — replaces the old index.ts Express bootstrap.
 *
 * Uses @nestjs/platform-express so the existing Socket.IO config, multer
 * file uploads, and Express-style middleware all continue to work unchanged.
 */

import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import cors from "cors";
import express from "express";
import { AppModule } from "./nest/app.module.js";
import { env } from "./config/env.js";
import { corsOriginDelegate } from "./config/corsOrigins.js";
import { logger } from "./config/logger.js";
import { connectDatabase } from "./config/database.js";
import { connectRedis } from "./config/redis.js";
import { ensureBucket } from "./config/storage.js";
import { initSocketIO } from "./config/socket.js";
import { ensureAuditTable } from "./services/audit.service.js";
import { ensureNotificationTable } from "./services/notification.service.js";
import { ensureUserRoleEnum } from "./utils/ensureUserRoleEnum.js";
import { startDriveScheduler, stopDriveScheduler } from "./scheduler/driveScheduler.js";
import { startExamTimerWorker, stopExamTimerWorker } from "./workers/examTimer.worker.js";

// Bootstrap module event subscriptions
import "./modules/learning/index.js";
import "./modules/integrity/index.js";
import "./modules/notifications/index.js";

async function bootstrap() {
  // 1. Connect PostgreSQL + Redis before the app starts
  await connectDatabase();
  await ensureAuditTable();
  await ensureNotificationTable();
  await ensureUserRoleEnum();
  await connectRedis();
  logger.info("✓ Database + Redis connected");

  // 2. Ensure S3/MinIO bucket
  await ensureBucket();

  // 3. Create NestJS app (Express adapter)
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    logger: ["error", "warn", "log"],
  });

  // 4. Security middleware (same as old app.ts)
  // cross-origin: SPA on gradlogic.* calls API on api.gradlogic.* (Socket.IO + XHR)
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
      crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    })
  );
  app.use(
    cors({
      origin: corsOriginDelegate,
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    }),
  );

  // 5. Body parsing
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));

  // 6. Initialize Socket.IO (attaches to the underlying HTTP server)
  const httpAdapter = app.getHttpAdapter();
  const httpServer = httpAdapter.getHttpServer();
  initSocketIO(httpServer);
  logger.info("✓ Socket.IO initialized");

  // 7. Start background workers
  startDriveScheduler();
  startExamTimerWorker();
  logger.info("✓ Background workers started");

  // 8. Disable automatic body parser (NestJS) so Express middleware handles it
  app.set("trust proxy", 1);

  // 9. Setup Swagger/OpenAPI documentation
  if (env.NODE_ENV !== "production") {
    const config = new DocumentBuilder()
      .setTitle("TalentSecure Phase 2 API")
      .setDescription("Users, Roles, Audit Trail, and Workflows Management API")
      .setVersion("2.0.0")
      .addBearerAuth(
        { type: "http", scheme: "bearer", bearerFormat: "JWT" },
        "access_token"
      )
      .addTag("Users", "User management endpoints")
      .addTag("Roles", "Role and permission management")
      .addTag("Audit", "Audit trail and logging")
      .addTag("Workflows", "Workflow management")
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup("api/docs", app, document);
    logger.info("✓ Swagger documentation available at /api/docs");
  }

  await app.listen(env.PORT);
  logger.info(`✓ GradLogic server running on port ${env.PORT} [NestJS]`);
  logger.info(`  Environment : ${env.NODE_ENV}`);
  logger.info(`  Client URLs : ${env.CLIENT_URLS.join(", ")}`);

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`${signal} received — shutting down gracefully`);
    await stopExamTimerWorker();
    stopDriveScheduler();
    await app.close();
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

bootstrap().catch((err) => {
  logger.error("Failed to start server", err);
  process.exit(1);
});
