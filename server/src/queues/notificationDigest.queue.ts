import { Queue } from "bullmq";
import { getRedis } from "../config/redis.js";

let _queue: Queue | null = null;

export function getNotificationDigestQueue(): Queue {
  if (!_queue) {
    _queue = new Queue("notification-digest", {
      connection: getRedis(),
      defaultJobOptions: { removeOnComplete: true, removeOnFail: 50 },
    });
  }
  return _queue;
}

/**
 * Registers the daily 6pm digest as a BullMQ repeatable job. Safe to call on
 * every boot — BullMQ dedupes repeatable jobs by name + pattern, matching the
 * idempotent-on-resume pattern already used by scheduleAutoSubmit.
 */
export async function scheduleDailyDigest(): Promise<void> {
  const queue = getNotificationDigestQueue();
  await queue.add(
    "daily-digest",
    {},
    { repeat: { pattern: "0 18 * * *" }, jobId: "daily-digest-repeat" }
  );
}

/** Manual trigger (ops/testing) — runs the digest immediately, once. */
export async function runDigestNow(): Promise<void> {
  const queue = getNotificationDigestQueue();
  await queue.add("daily-digest-manual", {});
}
