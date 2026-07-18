import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_PATH = path.join(__dirname, "..", ".runtime", "sprint1a-state.json");

export type Sprint1AState = {
  collegeName?: string;
  collegeId?: string;
  tpoEmail?: string;
  tpoTempPassword?: string;
  tpoPassword?: string;
  studentEmail?: string;
  studentTempPassword?: string;
  studentPassword?: string;
  studentRoll?: string;
};

export function readState(): Sprint1AState {
  try {
    if (!fs.existsSync(STATE_PATH)) return {};
    return JSON.parse(fs.readFileSync(STATE_PATH, "utf8")) as Sprint1AState;
  } catch {
    return {};
  }
}

export function writeState(patch: Partial<Sprint1AState>): Sprint1AState {
  const dir = path.dirname(STATE_PATH);
  fs.mkdirSync(dir, { recursive: true });
  const next = { ...readState(), ...patch };
  fs.writeFileSync(STATE_PATH, JSON.stringify(next, null, 2), "utf8");
  return next;
}

export function clearState(): void {
  if (fs.existsSync(STATE_PATH)) fs.unlinkSync(STATE_PATH);
}
