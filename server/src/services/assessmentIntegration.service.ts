/**
 * Assessment Hub continuous learning loop (ExamSubmitted):
 * Evaluate → Detect weak skills → Recommend Knowledge Library lesson
 * → Assign practice set → Update AI Learning Journey → Recalculate Placement Readiness
 */
import { query, queryOne } from "../config/database.js";
import { getAttemptEvaluation } from "./assessmentEvaluation.service.js";
import { applyAssessmentToJourneys } from "./learningJourney.service.js";
import * as adaptive from "./adaptive.service.js";
import { PHASE1_BANK_CATEGORIES } from "../shared/phase1PlacementDomains.js";
import { logger } from "../config/logger.js";
import type { QuestionCategory } from "../types/index.js";

export interface LearningLoopStatus {
  evaluated: boolean;
  weak_skills_detected: boolean;
  lesson_recommended: boolean;
  practice_assigned: boolean;
  journey_updated: boolean;
  readiness_recalculated: boolean;
}

export interface LearningLoopResult {
  insightId: string | null;
  journeysUpdated: number;
  avgReadiness: number | null;
  recommendedObjectId: string | null;
  recommendedLessonId: string | null;
  assignedPracticeDriveId: string | null;
  assignedPracticeHref: string | null;
  loopStatus: LearningLoopStatus;
}

const TOPIC_TO_CATEGORY: Record<string, QuestionCategory> = {
  aptitude: "aptitude",
  reasoning: "reasoning",
  "logical reasoning": "reasoning",
  python: "python_coding",
  python_coding: "python_coding",
  java: "java_coding",
  java_coding: "java_coding",
  ai_fundamentals: "data_science",
  "ai fundamentals": "data_science",
  data_science: "data_science",
  "data science": "data_science",
  programming: "programming",
  maths: "maths",
  math: "maths",
  data_structures: "data_structures",
  "data structures": "data_structures",
};

function mapTopicToCategory(topic: string | undefined | null): QuestionCategory | null {
  if (!topic) return null;
  const key = topic.trim().toLowerCase().replace(/\s+/g, "_");
  const spaced = topic.trim().toLowerCase();
  if (TOPIC_TO_CATEGORY[key]) return TOPIC_TO_CATEGORY[key];
  if (TOPIC_TO_CATEGORY[spaced]) return TOPIC_TO_CATEGORY[spaced];
  if ((PHASE1_BANK_CATEGORIES as readonly string[]).includes(key)) {
    return key as QuestionCategory;
  }
  return null;
}

/** Practice question for Companion chat (question_bank knowledge object). */
async function findRecommendedObject(weakTopics: string[]): Promise<string | null> {
  const aliases: Record<string, string[]> = {
    ai_fundamentals: ["data_science", "ai_fundamentals"],
    data_science: ["data_science", "ai_fundamentals"],
  };

  for (const topic of weakTopics) {
    const normalized = topic.trim().toLowerCase().replace(/\s+/g, "_");
    const category = mapTopicToCategory(topic);
    const candidates = [
      ...(category ? [category] : []),
      ...(aliases[normalized] || []),
      normalized,
      topic,
    ];
    for (const key of [...new Set(candidates)]) {
      const row = await queryOne<{ id: string }>(
        `SELECT id FROM question_bank
         WHERE is_active = TRUE AND status = 'published'
           AND (
             category::text ILIKE $1
             OR category::text = $2
             OR EXISTS (
               SELECT 1 FROM unnest(COALESCE(tags, ARRAY[]::text[])) t
               WHERE t ILIKE $1 OR t ILIKE $3
             )
           )
         ORDER BY RANDOM()
         LIMIT 1`,
        [`%${key}%`, key, `%${topic}%`]
      );
      if (row?.id) return row.id;
    }
  }

  const any = await queryOne<{ id: string }>(
    `SELECT id FROM question_bank
     WHERE is_active = TRUE AND status = 'published'
       AND category::text = ANY($1::text[])
     ORDER BY RANDOM() LIMIT 1`,
    [PHASE1_BANK_CATEGORIES as unknown as string[]]
  );
  return any?.id || null;
}

type LessonHit = {
  id: string;
  title: string;
  source: "learning_module" | "ai_content_lesson" | "lesson";
  href: string;
};

/** Prefer Knowledge Library / learning catalog over question_bank for "lesson". */
async function findKnowledgeLibraryLesson(weakTopics: string[]): Promise<LessonHit | null> {
  const categories = weakTopics
    .map((t) => mapTopicToCategory(t))
    .filter((c): c is QuestionCategory => !!c);

  for (const category of categories) {
    try {
      const module = await adaptive.findLessonForCategory(category);
      if (module) {
        return {
          id: module.id,
          title: module.title,
          source: "learning_module",
          href: `/app/student-portal/adaptive-learning`,
        };
      }
    } catch {
      /* optional */
    }

    const label = category.replace(/_/g, " ");
    const aiLesson = await queryOne<{ id: string; title: string }>(
      `SELECT id, title FROM ai_content_items
       WHERE status = 'published' AND content_type = 'lesson'
         AND (
           category ILIKE $1 OR category = $2
           OR EXISTS (
             SELECT 1 FROM unnest(COALESCE(tags, ARRAY[]::text[])) t
             WHERE t ILIKE $1 OR t ILIKE $3
           )
         )
       ORDER BY updated_at DESC NULLS LAST
       LIMIT 1`,
      [`%${label}%`, category, `%${category}%`]
    ).catch(() => null);

    if (aiLesson) {
      return {
        id: aiLesson.id,
        title: aiLesson.title,
        source: "ai_content_lesson",
        href: `/app/student-portal/adaptive-learning`,
      };
    }

    const lesson = await queryOne<{ id: string; title: string }>(
      `SELECT id, title FROM lessons
       WHERE title ILIKE $1
       ORDER BY updated_at DESC NULLS LAST
       LIMIT 1`,
      [`%${label}%`]
    ).catch(() => null);

    if (lesson) {
      return {
        id: lesson.id,
        title: lesson.title,
        source: "lesson",
        href: `/app/student-portal/adaptive-learning`,
      };
    }
  }

  // Any published Phase-1-ish module as soft fallback
  const anyModule = await queryOne<{ id: string; title: string }>(
    `SELECT lm.id, lm.title
     FROM learning_modules lm
     JOIN skills s ON s.id = lm.skill_id
     WHERE lm.is_published = TRUE
     ORDER BY lm.duration_minutes ASC NULLS LAST
     LIMIT 1`
  ).catch(() => null);

  if (anyModule) {
    return {
      id: anyModule.id,
      title: anyModule.title,
      source: "learning_module",
      href: `/app/student-portal/adaptive-learning`,
    };
  }

  return null;
}

type PracticeAssignment = {
  topic: string | null;
  difficulty: string | null;
  driveId: string | null;
  href: string;
};

async function findMatchingPracticeDrive(category: string): Promise<string | null> {
  const row = await queryOne<{ id: string }>(
    `SELECT ad.id
     FROM assessment_drives ad
     WHERE ad.drive_type = 'practice_test'
       AND UPPER(COALESCE(ad.status, '')) IN (
         'LIVE', 'PUBLISHED', 'APPROVED', 'POOL_APPROVED', 'ACTIVE', 'DRAFT'
       )
       AND (
         ad.name ILIKE $1
         OR EXISTS (
           SELECT 1
           FROM drive_source_collections dsc
           JOIN question_collections qc ON qc.id = dsc.collection_id
           WHERE dsc.drive_id = ad.id
             AND (
               qc.category::text ILIKE $2
               OR qc.category::text = $3
               OR qc.name ILIKE $1
             )
         )
       )
     ORDER BY
       CASE WHEN UPPER(COALESCE(ad.status, '')) IN ('LIVE', 'PUBLISHED', 'ACTIVE') THEN 0 ELSE 1 END,
       ad.updated_at DESC NULLS LAST
     LIMIT 1`,
    [`%${category.replace(/_/g, " ")}%`, `%${category}%`, category]
  ).catch(() => null);
  return row?.id || null;
}

/** Enroll student on a matching practice drive when possible; always deep-link Practice Arena. */
async function assignPracticeSet(
  studentId: string,
  weakTopics: string[],
  preferredDifficulty?: string | null
): Promise<PracticeAssignment> {
  const category =
    mapTopicToCategory(weakTopics[0]) ||
    (weakTopics[0] ? weakTopics[0].toLowerCase().replace(/\s+/g, "_") : null) ||
    "aptitude";

  let difficulty = preferredDifficulty || "medium";
  try {
    const skills = await adaptive.getSkillAccuracy(studentId);
    const match = skills.find((s) => s.category === category);
    if (match) difficulty = adaptive.recommendDifficulty(match);
  } catch {
    /* optional */
  }

  const href = `/app/student-portal/practice?topic=${encodeURIComponent(category)}&difficulty=${encodeURIComponent(difficulty)}`;

  let driveId: string | null = await findMatchingPracticeDrive(category);

  if (driveId) {
    try {
      await query(
        `INSERT INTO drive_students (drive_id, student_id, status, eligibility_status)
         VALUES ($1, $2, 'INVITED', 'eligible')
         ON CONFLICT (drive_id, student_id) DO NOTHING`,
        [driveId, studentId]
      );
    } catch (err) {
      logger.warn("[AI Loop] Practice drive enroll skipped", { err, driveId, studentId });
      driveId = null;
    }
  }

  return { topic: category, difficulty, driveId, href };
}

export async function recordAssessmentInsightAndIntegrate(input: {
  sessionId: string;
  driveId: string;
  studentId: string;
  score: number;
}): Promise<LearningLoopResult> {
  const loopStatus: LearningLoopStatus = {
    evaluated: false,
    weak_skills_detected: false,
    lesson_recommended: false,
    practice_assigned: false,
    journey_updated: false,
    readiness_recalculated: false,
  };

  let weakTopics: string[] = [];
  let strongTopics: string[] = [];
  let recommendations: string[] = [];
  let scorePercent: number | null = null;
  let practiceDifficulty: string | null = null;

  // 1–2. AI evaluates + detect weak skills
  try {
    const evaln = await getAttemptEvaluation(input.sessionId);
    weakTopics = evaln.weak_topics || [];
    strongTopics = evaln.strong_topics || [];
    recommendations = [...(evaln.recommendations || [])];
    scorePercent = evaln.score_percent;
    practiceDifficulty = evaln.next_practice?.difficulty || null;
    loopStatus.evaluated = true;
    loopStatus.weak_skills_detected = weakTopics.length > 0;
  } catch (err) {
    logger.warn("[AI Loop] Evaluation skipped", { err, sessionId: input.sessionId });
  }

  // 3. Recommend Knowledge Library lesson
  const lesson = await findKnowledgeLibraryLesson(weakTopics).catch(() => null);
  if (lesson) {
    loopStatus.lesson_recommended = true;
    recommendations.push(`Study Knowledge Library lesson: ${lesson.title}.`);
  }

  // Companion practice object (bank question)
  const recommendedObjectId = await findRecommendedObject(weakTopics).catch(() => null);

  // 4. Assign new practice set
  const practice = await assignPracticeSet(
    input.studentId,
    weakTopics,
    practiceDifficulty
  ).catch(() => ({
    topic: weakTopics[0] || "aptitude",
    difficulty: practiceDifficulty || "medium",
    driveId: null as string | null,
    href: `/app/student-portal/practice`,
  }));

  if (practice.topic) {
    loopStatus.practice_assigned = true;
    recommendations.push(
      `Assigned practice on ${practice.topic}${
        practice.difficulty ? ` (${practice.difficulty})` : ""
      }.`
    );
  }

  // 5–6. Update journey + recalculate placement readiness
  const journey = await applyAssessmentToJourneys({
    studentId: input.studentId,
    driveId: input.driveId,
    sessionId: input.sessionId,
    score: input.score,
    weakTopics,
    strongTopics,
  });

  loopStatus.journey_updated = journey.journeysUpdated > 0;
  loopStatus.readiness_recalculated = journey.avgReadiness != null;

  const loopComplete =
    loopStatus.evaluated &&
    (loopStatus.lesson_recommended || loopStatus.practice_assigned) &&
    loopStatus.journey_updated;

  let insightId: string | null = null;
  try {
    const row = await queryOne<{ id: string }>(
      `INSERT INTO student_assessment_insights (
         student_id, session_id, drive_id, score, score_percent,
         weak_topics, strong_topics, recommendations,
         recommended_object_id,
         recommended_lesson_id, recommended_lesson_title, recommended_lesson_source, recommended_lesson_href,
         assigned_practice_topic, assigned_practice_difficulty, assigned_practice_drive_id, assigned_practice_href,
         journey_updated, placement_readiness, loop_status, loop_completed_at
       ) VALUES (
         $1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,
         $9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20::jsonb,
         CASE WHEN $21 THEN NOW() ELSE NULL END
       )
       ON CONFLICT (session_id) DO UPDATE SET
         score = EXCLUDED.score,
         score_percent = EXCLUDED.score_percent,
         weak_topics = EXCLUDED.weak_topics,
         strong_topics = EXCLUDED.strong_topics,
         recommendations = EXCLUDED.recommendations,
         recommended_object_id = EXCLUDED.recommended_object_id,
         recommended_lesson_id = EXCLUDED.recommended_lesson_id,
         recommended_lesson_title = EXCLUDED.recommended_lesson_title,
         recommended_lesson_source = EXCLUDED.recommended_lesson_source,
         recommended_lesson_href = EXCLUDED.recommended_lesson_href,
         assigned_practice_topic = EXCLUDED.assigned_practice_topic,
         assigned_practice_difficulty = EXCLUDED.assigned_practice_difficulty,
         assigned_practice_drive_id = EXCLUDED.assigned_practice_drive_id,
         assigned_practice_href = EXCLUDED.assigned_practice_href,
         journey_updated = EXCLUDED.journey_updated,
         placement_readiness = EXCLUDED.placement_readiness,
         loop_status = EXCLUDED.loop_status,
         loop_completed_at = EXCLUDED.loop_completed_at,
         created_at = NOW()
       RETURNING id`,
      [
        input.studentId,
        input.sessionId,
        input.driveId,
        input.score,
        scorePercent,
        JSON.stringify(weakTopics),
        JSON.stringify(strongTopics),
        JSON.stringify(recommendations),
        recommendedObjectId,
        lesson?.id || null,
        lesson?.title || null,
        lesson?.source || null,
        lesson?.href || null,
        practice.topic,
        practice.difficulty,
        practice.driveId,
        practice.href,
        journey.journeysUpdated > 0,
        journey.avgReadiness,
        JSON.stringify(loopStatus),
        loopComplete,
      ]
    );
    insightId = row?.id || null;
  } catch (err) {
    // Column-level upgrade may be pending — fall back to core insight insert
    logger.warn("[AI Loop] Extended insight write failed — apply migration 55", { err });
    try {
      const row = await queryOne<{ id: string }>(
        `INSERT INTO student_assessment_insights (
           student_id, session_id, drive_id, score, score_percent,
           weak_topics, strong_topics, recommendations,
           recommended_object_id, journey_updated, placement_readiness
         ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9,$10,$11)
         ON CONFLICT (session_id) DO UPDATE SET
           score = EXCLUDED.score,
           score_percent = EXCLUDED.score_percent,
           weak_topics = EXCLUDED.weak_topics,
           strong_topics = EXCLUDED.strong_topics,
           recommendations = EXCLUDED.recommendations,
           recommended_object_id = EXCLUDED.recommended_object_id,
           journey_updated = EXCLUDED.journey_updated,
           placement_readiness = EXCLUDED.placement_readiness,
           created_at = NOW()
         RETURNING id`,
        [
          input.studentId,
          input.sessionId,
          input.driveId,
          input.score,
          scorePercent,
          JSON.stringify(weakTopics),
          JSON.stringify(strongTopics),
          JSON.stringify(recommendations),
          recommendedObjectId,
          journey.journeysUpdated > 0,
          journey.avgReadiness,
        ]
      );
      insightId = row?.id || null;
    } catch (err2) {
      logger.warn("[AI Loop] Insight table unavailable — apply migration 54", { err: err2 });
    }
  }

  logger.info("[AI Loop] Continuous learning chain complete", {
    sessionId: input.sessionId,
    studentId: input.studentId,
    loopStatus,
    lessonId: lesson?.id,
    practiceDriveId: practice.driveId,
    avgReadiness: journey.avgReadiness,
  });

  return {
    insightId,
    journeysUpdated: journey.journeysUpdated,
    avgReadiness: journey.avgReadiness,
    recommendedObjectId,
    recommendedLessonId: lesson?.id || null,
    assignedPracticeDriveId: practice.driveId,
    assignedPracticeHref: practice.href,
    loopStatus,
  };
}

export async function getLatestAssessmentInsight(studentId: string) {
  const row = await queryOne<{
    id: string;
    session_id: string;
    drive_id: string;
    score: number | null;
    score_percent: number | null;
    weak_topics: string[];
    strong_topics: string[];
    recommendations: string[];
    recommended_object_id: string | null;
    recommended_lesson_id: string | null;
    recommended_lesson_title: string | null;
    recommended_lesson_source: string | null;
    recommended_lesson_href: string | null;
    assigned_practice_topic: string | null;
    assigned_practice_difficulty: string | null;
    assigned_practice_drive_id: string | null;
    assigned_practice_href: string | null;
    placement_readiness: number | null;
    loop_status: LearningLoopStatus | Record<string, unknown> | null;
    created_at: string;
    drive_name: string | null;
    object_label: string | null;
  }>(
    `SELECT sai.*,
            ad.name AS drive_name,
            LEFT(qb.question_text, 80) AS object_label
     FROM student_assessment_insights sai
     LEFT JOIN assessment_drives ad ON ad.id = sai.drive_id
     LEFT JOIN question_bank qb ON qb.id = sai.recommended_object_id
     WHERE sai.student_id = $1
     ORDER BY sai.created_at DESC
     LIMIT 1`,
    [studentId]
  ).catch(() => null);

  if (!row) return null;

  return {
    id: row.id,
    session_id: row.session_id,
    drive_id: row.drive_id,
    drive_name: row.drive_name,
    score: row.score != null ? Number(row.score) : null,
    score_percent: row.score_percent != null ? Number(row.score_percent) : null,
    weak_topics: row.weak_topics || [],
    strong_topics: row.strong_topics || [],
    recommendations: row.recommendations || [],
    recommended_object_id: row.recommended_object_id,
    recommended_object_label: row.object_label,
    recommended_lesson_id: row.recommended_lesson_id ?? null,
    recommended_lesson_title: row.recommended_lesson_title ?? null,
    recommended_lesson_source: row.recommended_lesson_source ?? null,
    recommended_lesson_href: row.recommended_lesson_href ?? null,
    assigned_practice_topic: row.assigned_practice_topic ?? null,
    assigned_practice_difficulty: row.assigned_practice_difficulty ?? null,
    assigned_practice_drive_id: row.assigned_practice_drive_id ?? null,
    assigned_practice_href: row.assigned_practice_href ?? `/app/student-portal/practice`,
    placement_readiness: row.placement_readiness != null ? Number(row.placement_readiness) : null,
    loop_status: row.loop_status || null,
    created_at: row.created_at,
  };
}

export async function listRecentInsights(limit = 20) {
  return query(
    `SELECT sai.id, sai.student_id, sai.score, sai.score_percent, sai.weak_topics,
            sai.placement_readiness, sai.created_at, sai.journey_updated,
            sai.recommended_object_id, sai.recommended_lesson_title,
            sai.assigned_practice_topic, sai.loop_status,
            COALESCE(u.full_name, u.name) AS student_name,
            ad.name AS drive_name
     FROM student_assessment_insights sai
     JOIN users u ON u.id = sai.student_id
     LEFT JOIN assessment_drives ad ON ad.id = sai.drive_id
     ORDER BY sai.created_at DESC
     LIMIT $1`,
    [limit]
  ).catch(() => []);
}
