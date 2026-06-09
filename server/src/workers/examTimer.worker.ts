import { Worker, Job } from "bullmq";
import { getRedis } from "../config/redis.js";
import { logger } from "../config/logger.js";
import { ExamAutoSubmitJob } from "../queues/examTimer.queue.js";
import { submitExam } from "../services/examSession.service.js";

let _worker: Worker | null = null;

export function startExamTimerWorker(): Worker {
  if (_worker) return _worker;

  _worker = new Worker<ExamAutoSubmitJob>(
    "exam-auto-submit",
    async (job: Job<ExamAutoSubmitJob>) => {
      const { sessionId, driveId, studentId } = job.data;
      logger.info(`Auto-submitting exam session ${sessionId}`);

      try {
        await submitExam(driveId, studentId, { triggeredBy: "timer" });
        logger.info(`Auto-submit complete for session ${sessionId}`);
      } catch (err: any) {
        // Session already submitted or not found — both are acceptable terminal states
        if (err?.statusCode === 409 || err?.statusCode === 404) {
          logger.debug(`Auto-submit skipped (already done): ${sessionId}`);
          return;
        }
        throw err;
      }
    },
    { connection: getRedis(), concurrency: 10 },
  );

  _worker.on("failed", (job, err) => {
    logger.error(`Exam timer job failed`, { jobId: job?.id, error: err.message });
  });

  logger.info("✓ Exam timer worker started");
  return _worker;
}

export async function stopExamTimerWorker(): Promise<void> {
  await _worker?.close();
  _worker = null;
}
