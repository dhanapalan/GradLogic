/**
 * Exam session lifecycle state machine.
 *
 * Status transitions must go through this class. Raw `status = '...'` updates
 * in service code are prohibited — they bypass the guards that enforce
 * invariants like "a completed session cannot be resumed" and "only one
 * in_progress session per student per drive" (enforced at DB level by the
 * partial unique index, but the guard here catches it before the round-trip).
 */

import { eventBus } from "./event-bus.js";

export type SessionStatus =
  | "assigned"
  | "in_progress"
  | "completed"
  | "invalidated";

interface SessionRecord {
  id: string;
  status: SessionStatus;
  driveId: string;
  studentId: string;
  serverDeadline?: Date | null;
}

interface Transition {
  from: SessionStatus[];
  guard?: (session: SessionRecord) => void;
}

const TRANSITIONS: Record<SessionStatus, Transition> = {
  assigned: {
    from: [], // initial state, not a valid transition target
  },
  in_progress: {
    from: ["assigned"],
    guard: (s) => {
      if (s.serverDeadline && s.serverDeadline < new Date()) {
        throw new Error("Cannot start session: deadline has already passed");
      }
    },
  },
  completed: {
    from: ["in_progress"],
  },
  invalidated: {
    from: ["in_progress", "completed"],
  },
};

export class ExamSessionStateMachine {
  /**
   * Validate the transition and throw if illegal.
   * Call BEFORE the SQL UPDATE.
   */
  static guard(session: SessionRecord, to: SessionStatus): void {
    const rule = TRANSITIONS[to];
    if (!rule) throw new Error(`Unknown target session state: ${to}`);
    if (!rule.from.includes(session.status)) {
      throw new Error(
        `Illegal session transition: ${session.status} → ${to} (session ${session.id})`,
      );
    }
    rule.guard?.(session);
  }

  /**
   * Emit the corresponding domain event after the transition is committed.
   */
  static emitEvent(
    session: Pick<SessionRecord, "id" | "driveId" | "studentId">,
    to: SessionStatus,
    extra?: Record<string, unknown>,
  ): void {
    const eventMap: Partial<Record<SessionStatus, Parameters<typeof eventBus.emit>[0]>> = {
      in_progress: "ExamStarted",
      invalidated: "SessionInvalidated",
    };
    const event = eventMap[to];
    if (event) {
      eventBus.emit(event, {
        sessionId: session.id,
        driveId: session.driveId,
        studentId: session.studentId,
        ...extra,
      });
    }
  }
}
