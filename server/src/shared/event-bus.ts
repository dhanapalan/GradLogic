/**
 * In-process publish/subscribe event bus.
 *
 * Modules emit domain events; other modules subscribe. This is what keeps
 * cross-module orchestration decoupled — e.g. Results knows nothing about the
 * LMS, but a ResultsReleased event triggers the Learning module to generate a
 * personalized path.
 *
 * If the monolith is ever split, these events become the natural seams to
 * turn into real message queue topics. The option is free.
 */

type Handler<T = unknown> = (payload: T) => void | Promise<void>;

const registry = new Map<string, Handler[]>();

export const eventBus = {
  emit<T>(event: DomainEvent, payload: T): void {
    const handlers = registry.get(event) ?? [];
    for (const h of handlers) {
      // Fire-and-forget; errors are isolated so one bad handler can't block others
      Promise.resolve(h(payload)).catch((err) => {
        console.error(`[EventBus] Handler error on "${event}":`, err);
      });
    }
  },

  on<T>(event: DomainEvent, handler: Handler<T>): () => void {
    if (!registry.has(event)) registry.set(event, []);
    registry.get(event)!.push(handler as Handler);
    // Returns an unsubscribe function
    return () => {
      const list = registry.get(event);
      if (list) {
        const idx = list.indexOf(handler as Handler);
        if (idx !== -1) list.splice(idx, 1);
      }
    };
  },
};

// ── Domain event catalog ──────────────────────────────────────────────────────
// All valid event names are listed here; type-checker catches typos.

export type DomainEvent =
  | "DrivePublished"
  | "DriveActivated"
  | "DriveCompleted"
  | "DriveCancelled"
  | "ExamStarted"
  | "ViolationRecorded"
  | "ExamSubmitted"
  | "ExamAutoSubmitted"
  | "ExamAutoTerminated"
  | "ResultsReleased"
  | "SessionInvalidated"
  | "OfferReleased";

// ── Typed event payloads ──────────────────────────────────────────────────────

export interface DrivePublishedPayload {
  driveId: string;
  driveName: string;
  assignedCollegeIds: string[];
}

export interface ExamSubmittedPayload {
  sessionId: string;
  driveId: string;
  studentId: string;
  score: number;
  triggeredBy: "student" | "timer";
}

export interface ResultsReleasedPayload {
  driveId: string;
  studentIds: string[];
}

export interface ViolationRecordedPayload {
  sessionId: string;
  driveId: string;
  studentId: string;
  violationType: string;
}

export interface SessionInvalidatedPayload {
  sessionId: string;
  driveId: string;
  studentId: string;
  reason: string;
}
