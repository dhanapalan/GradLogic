-- =============================================================================
-- Knowledge Object architecture (Phase 4) — additive fields on question_bank.
--
-- Question / Explanation / Coding Challenge (type + test_cases + starter_code)
-- / Topic (tags) / Skill Mapping (bloom_level + tags) already live on this row
-- — no changes needed there. Hint, Learning Objectives and References have no
-- existing home anywhere in the schema, so they're added here as nullable
-- columns on the SAME table (one row per question, still) rather than a new
-- table — extending the single source of truth, not duplicating it.
--
-- Flashcard and Voice Lesson are deliberately NOT stored: a flashcard is a
-- pure front/back transform of question_text + correct_answer + explanation,
-- and voice playback uses the browser's speech synthesis on demand — both
-- rendered client-side from data that already exists here.
-- =============================================================================

ALTER TABLE question_bank ADD COLUMN IF NOT EXISTS hint TEXT;
ALTER TABLE question_bank ADD COLUMN IF NOT EXISTS learning_objectives TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE question_bank ADD COLUMN IF NOT EXISTS reference_links TEXT[] NOT NULL DEFAULT '{}';
