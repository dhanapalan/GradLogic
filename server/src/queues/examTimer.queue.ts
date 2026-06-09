import { Queue } from "bullmq";
import { getRedis } from "../config/redis.js";

export interface ExamAutoSubmitJob {
  sessionId: string;   // drive_students.id
  driveId: string;
  studentId: string;
}

let _queue: Queue<ExamAutoSubmitJob> | null = null;

export function getExamTimerQueue(): Queue<ExamAutoSubmitJob> {
  if (!_queue) {
    _queue = new Queue<ExamAutoSubmitJob>("exam-auto-submit", {
      connection: getRedis(),
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: 1000,
      },
    });
  }
  return _queue;
}

/**
 * Schedule an auto-submit job to fire at the session deadline.
 * If a job for this session already exists it is replaced (idempotent on resume).
 */
export async function scheduleAutoSubmit(
  job: ExamAutoSubmitJob,
  fireAt: Date,
): Promise<void> {
  const delayMs = Math.max(0, fireAt.getTime() - Date.now());
  const queue = getExamTimerQueue();
  await queue.add(`submit-${job.sessionId}`, job, {
    delay: delayMs,
    jobId: `auto-submit-${job.sessionId}`,
  });
}

export async function cancelAutoSubmit(sessionId: string): Promise<void> {
  const job = await getExamTimerQueue().getJob(`auto-submit-${sessionId}`);
  await job?.remove();
}
