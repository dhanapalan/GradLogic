/**
 * Workflow-scoped state management for end-to-end workflow tests.
 * Each workflow maintains its own state file (workflow-1-state.json, workflow-2-state.json, etc.)
 * This ensures workflows are independent and can be run in any order or re-run multiple times.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export type WorkflowState = Record<string, any>;

/**
 * Workflow state helper — manages workflow-scoped state files.
 * Usage:
 *   const state = new WorkflowState('college-onboarding')
 *   state.read()  // returns { collegeId, collegeName, ... }
 *   state.write({ collegeId: '123', collegeAdminEmail: 'admin@college.edu' })
 *   state.clear() // delete state file
 */
export class WorkflowStateManager {
  private workflowName: string;
  private statePath: string;

  constructor(workflowName: string) {
    this.workflowName = workflowName;
    this.statePath = path.join(__dirname, "..", ".runtime", `workflow-${workflowName}-state.json`);
  }

  /**
   * Read workflow state from disk.
   * Returns empty object if file doesn't exist.
   */
  read(): WorkflowState {
    try {
      if (!fs.existsSync(this.statePath)) return {};
      return JSON.parse(fs.readFileSync(this.statePath, "utf8")) as WorkflowState;
    } catch {
      return {};
    }
  }

  /**
   * Write workflow state to disk (merge with existing).
   * Creates .runtime directory if needed.
   */
  write(patch: Partial<WorkflowState>): WorkflowState {
    const dir = path.dirname(this.statePath);
    fs.mkdirSync(dir, { recursive: true });
    const next = { ...this.read(), ...patch };
    fs.writeFileSync(this.statePath, JSON.stringify(next, null, 2), "utf8");
    return next;
  }

  /**
   * Clear workflow state (delete state file).
   */
  clear(): void {
    if (fs.existsSync(this.statePath)) {
      fs.unlinkSync(this.statePath);
    }
  }

  /**
   * Get the file path (useful for debugging).
   */
  getPath(): string {
    return this.statePath;
  }
}

/**
 * Convenience factory for creating workflow state managers.
 * Usage:
 *   const state = workflowState('college-onboarding')
 *   state.read()
 *   state.write({ collegeId: '123' })
 */
export function workflowState(workflowName: string): WorkflowStateManager {
  return new WorkflowStateManager(workflowName);
}
