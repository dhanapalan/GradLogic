/**
 * Phase 11 — lightweight, fire-and-forget AI usage logging. Every AI-powered
 * route calls this once; failures are swallowed (usage analytics must never
 * break the actual feature).
 */
import { query } from "../config/database.js";
import { logger } from "../config/logger.js";

export function logAiUsage(feature: string, studentId: string | null): void {
  query(`INSERT INTO ai_usage_events (student_id, feature) VALUES ($1, $2)`, [studentId, feature]).catch((err) =>
    logger.warn("[AI Usage] log failed", { feature, error: (err as Error).message }),
  );
}
