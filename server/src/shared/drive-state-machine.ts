/**
 * Drive lifecycle state machine.
 *
 * The ONLY way drive.status changes is by calling a transition here.
 * This eliminates a whole class of bugs: illegal transitions, missing state
 * guards, concurrent updates putting a drive into an inconsistent state.
 *
 * Transitions are guarded (preconditions checked before the SQL update) and
 * emit a domain event after success so subscribers (Notifications, Monitoring)
 * react without coupling to this module.
 */

import { eventBus } from "./event-bus.js";

export type DriveStatus =
  | "draft"
  | "pool_pending"
  | "pool_ready"
  | "scheduled"
  | "active"
  | "completed"
  | "cancelled";

interface Transition {
  from: DriveStatus[];
  guard?: (drive: DriveRecord) => void;
}

interface DriveRecord {
  id: string;
  status: DriveStatus;
  scheduled_start?: Date | null;
  scheduled_end?: Date | null;
  pool_id?: string | null;
}

// Allowed transitions — any other (from, to) pair is illegal
const TRANSITIONS: Record<DriveStatus, Transition> = {
  pool_pending: {
    from: ["draft"],
    guard: (d) => {
      if (!d.scheduled_start) throw new Error("scheduled_start is required before pool generation");
    },
  },
  pool_ready: {
    from: ["pool_pending"],
    guard: (d) => {
      if (!d.pool_id) throw new Error("pool_id must be set before marking pool ready");
    },
  },
  scheduled: {
    from: ["pool_ready", "draft"],
  },
  active: {
    from: ["scheduled"],
    guard: (d) => {
      if (!d.scheduled_start) throw new Error("scheduled_start required for activation");
    },
  },
  completed: {
    from: ["active"],
  },
  cancelled: {
    from: ["draft", "pool_pending", "pool_ready", "scheduled", "active"],
  },
  draft: {
    from: [], // terminal re-entry not allowed
  },
};

export class DriveStateMachine {
  /**
   * Validate the transition is legal for this drive.
   * Throws if not allowed — call BEFORE issuing the SQL update.
   */
  static guard(drive: DriveRecord, to: DriveStatus): void {
    const rule = TRANSITIONS[to];
    if (!rule) throw new Error(`Unknown target state: ${to}`);
    if (!rule.from.includes(drive.status)) {
      throw new Error(
        `Illegal drive transition: ${drive.status} → ${to} (drive ${drive.id})`,
      );
    }
    rule.guard?.(drive);
  }

  /**
   * Emit the corresponding domain event after a transition is committed to DB.
   */
  static emitEvent(driveId: string, to: DriveStatus, extra?: Record<string, unknown>): void {
    const eventMap: Partial<Record<DriveStatus, Parameters<typeof eventBus.emit>[0]>> = {
      active: "DriveActivated",
      completed: "DriveCompleted",
      cancelled: "DriveCancelled",
      scheduled: "DrivePublished",
    };
    const event = eventMap[to];
    if (event) eventBus.emit(event, { driveId, ...extra });
  }
}
