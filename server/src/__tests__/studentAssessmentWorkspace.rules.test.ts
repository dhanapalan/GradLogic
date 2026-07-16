/**
 * Module 06 lifecycle rules — runnable with: npx tsx --test src/__tests__/studentAssessmentWorkspace.rules.test.ts
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isUuid,
  remainingSecondsMs,
  sanitizeSelectedAnswers,
  shouldCompleteAssignment,
  SHORT_ANSWER_MAX_CHARS,
} from "../services/studentAssessmentWorkspace.rules.js";

describe("studentAssessmentWorkspace.rules", () => {
  it("validates UUIDs", () => {
    assert.equal(isUuid("14c80fc1-b919-4117-a089-31d782ec9424"), true);
    assert.equal(isUuid("not-a-uuid"), false);
    assert.equal(isUuid(""), false);
  });

  it("computes remaining seconds from deadline and campaign end", () => {
    const now = Date.parse("2026-07-16T10:00:00.000Z");
    const left = remainingSecondsMs(
      "2026-07-16T10:05:00.000Z",
      "2026-07-16T11:00:00.000Z",
      now
    );
    assert.equal(left, 300);
  });

  it("caps remaining by earlier campaign end", () => {
    const now = Date.parse("2026-07-16T10:00:00.000Z");
    const left = remainingSecondsMs(
      "2026-07-16T10:30:00.000Z",
      "2026-07-16T10:02:00.000Z",
      now
    );
    assert.equal(left, 120);
  });

  it("marks assignment complete only when attempts exhausted", () => {
    assert.equal(shouldCompleteAssignment(1, 2), false);
    assert.equal(shouldCompleteAssignment(2, 2), true);
    assert.equal(shouldCompleteAssignment(1, 1), true);
  });

  it("filters MCQ selections to allowed labels", () => {
    const selected = sanitizeSelectedAnswers({
      questionType: "mcq",
      selected: ["A", "Z", "B"],
      allowedLabels: ["A", "B", "C"],
    });
    assert.deepEqual(selected, ["A"]);
  });

  it("keeps unique multi-select labels", () => {
    const selected = sanitizeSelectedAnswers({
      questionType: "multi_select",
      selected: ["A", "B", "A", "X"],
      allowedLabels: ["A", "B"],
    });
    assert.deepEqual(selected, ["A", "B"]);
  });

  it("truncates short answers", () => {
    const long = "x".repeat(SHORT_ANSWER_MAX_CHARS + 50);
    const selected = sanitizeSelectedAnswers({
      questionType: "short_answer",
      selected: [long],
      allowedLabels: [],
    });
    assert.equal(selected[0]?.length, SHORT_ANSWER_MAX_CHARS);
  });
});
