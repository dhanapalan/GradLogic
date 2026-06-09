/**
 * DRIVE module — public interface.
 *
 * External code (other modules, routes) must only import from this file.
 * Never import directly from drive.service.ts or internal files.
 * This boundary is what makes the modular monolith work.
 */

export {
  listDrives,
  getDriveById,
  createDrive,
  updateDrive,
  publishDrive,
  cancelDrive,
  transitionDrivesToLive,
  transitionDrivesToCompleted,
  getDriveAssignments,
  addDriveAssignment,
} from "../../services/drive.service.js";
