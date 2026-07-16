/**

 * Assessment Hub — AI pipeline health (integration control plane).

 * Catalog path: Knowledge Library → Bank → Builder → Attempt

 * Continuous loop: Evaluate → Weak skills → Lesson → Practice → Journey → Readiness

 */

import { query, queryOne } from "../config/database.js";



export type PipelineStepStatus = "ok" | "warn" | "empty";



export interface PipelineStep {

  id: string;

  title: string;

  href: string;

  status: PipelineStepStatus;

  metric_label: string;

  metric_value: number | string;

  next_action: string | null;

}



export async function getAssessmentPipelineHealth() {

  const bank = await queryOne<{ published: string; total: string }>(`

    SELECT

      COUNT(*) FILTER (WHERE is_active AND status = 'published')::text AS published,

      COUNT(*)::text AS total

    FROM question_bank

  `).catch(() => ({ published: "0", total: "0" }));



  const modules = await queryOne<{ published: string }>(`

    SELECT COUNT(*) FILTER (WHERE is_published)::text AS published

    FROM learning_modules

  `).catch(() => ({ published: "0" }));



  const collections = await queryOne<{ n: string; with_items: string }>(`

    SELECT

      COUNT(*)::text AS n,

      COUNT(*) FILTER (

        WHERE EXISTS (

          SELECT 1 FROM question_collection_items i WHERE i.collection_id = qc.id

        )

      )::text AS with_items

    FROM question_collections qc

  `).catch(() => ({ n: "0", with_items: "0" }));



  const drives = await queryOne<{ n: string; with_pool: string; with_collections: string }>(`

    SELECT

      COUNT(*)::text AS n,

      COUNT(*) FILTER (

        WHERE EXISTS (SELECT 1 FROM drive_pool_questions p WHERE p.drive_id = ad.id)

      )::text AS with_pool,

      COUNT(*) FILTER (

        WHERE EXISTS (SELECT 1 FROM drive_source_collections dsc WHERE dsc.drive_id = ad.id)

      )::text AS with_collections

    FROM assessment_drives ad

  `).catch(() => ({ n: "0", with_pool: "0", with_collections: "0" }));



  const attempts = await queryOne<{ started: string; completed: string }>(`

    SELECT

      COUNT(*) FILTER (WHERE started_at IS NOT NULL)::text AS started,

      COUNT(*) FILTER (WHERE status = 'completed')::text AS completed

    FROM drive_students

  `);



  const insights = await queryOne<{

    n: string;

    with_lesson: string;

    with_practice: string;

    loops_ok: string;

    last_at: string | null;

  }>(`

    SELECT

      COUNT(*)::text AS n,

      COUNT(*) FILTER (WHERE recommended_lesson_id IS NOT NULL)::text AS with_lesson,

      COUNT(*) FILTER (

        WHERE assigned_practice_href IS NOT NULL OR assigned_practice_drive_id IS NOT NULL

      )::text AS with_practice,

      COUNT(*) FILTER (WHERE loop_completed_at IS NOT NULL)::text AS loops_ok,

      MAX(created_at)::text AS last_at

    FROM student_assessment_insights

  `).catch(() => ({

    n: "0",

    with_lesson: "0",

    with_practice: "0",

    loops_ok: "0",

    last_at: null,

  }));



  const journeys = await queryOne<{ active: string; avg_ready: string | null }>(`

    SELECT

      COUNT(*) FILTER (WHERE status IN ('in_progress','completed','paused'))::text AS active,

      ROUND(AVG(placement_readiness) FILTER (

        WHERE status IN ('in_progress','completed','paused')

      ))::text AS avg_ready

    FROM student_journeys

  `).catch(() => ({ active: "0", avg_ready: null }));



  const companionObjects = await queryOne<{ n: string }>(`

    SELECT COUNT(*)::text AS n

    FROM student_assessment_insights

    WHERE recommended_object_id IS NOT NULL

      AND created_at > NOW() - INTERVAL '30 days'

  `).catch(() => ({ n: "0" }));



  const published = Number(bank?.published) || 0;

  const modulesPublished = Number(modules?.published) || 0;

  const collN = Number(collections?.n) || 0;

  const collFilled = Number(collections?.with_items) || 0;

  const driveN = Number(drives?.n) || 0;

  const driveColl = Number(drives?.with_collections) || 0;

  const completed = Number(attempts?.completed) || 0;

  const started = Number(attempts?.started) || 0;

  const insightN = Number(insights?.n) || 0;

  const lessonN = Number(insights?.with_lesson) || 0;

  const practiceN = Number(insights?.with_practice) || 0;

  const loopsOk = Number(insights?.loops_ok) || 0;

  const journeyActive = Number(journeys?.active) || 0;

  const companionN = Number(companionObjects?.n) || 0;

  const avgReady = journeys?.avg_ready != null ? Number(journeys.avg_ready) : null;



  const catalogSteps: PipelineStep[] = [

    {

      id: "knowledge_library",

      title: "Knowledge Library",

      href: "/app/superadmin/knowledge-library",

      status: modulesPublished > 0 || published > 0 ? "ok" : "empty",

      metric_label: "Published modules",

      metric_value: modulesPublished,

      next_action:

        modulesPublished === 0

          ? "Publish lessons/modules so weak skills can map to study material"

          : null,

    },

    {

      id: "question_bank",

      title: "Question Bank",

      href: "/app/superadmin/question-bank",

      status: published > 0 ? "ok" : "empty",

      metric_label: "Published questions",

      metric_value: published,

      next_action:

        published > 0 && collFilled === 0

          ? "Fill Question Collections from the bank"

          : null,

    },

    {

      id: "assessment_builder",

      title: "Assessment Builder",

      href: "/app/superadmin/drives",

      status:

        driveN === 0 ? "empty" : driveColl > 0 || Number(drives?.with_pool) > 0 ? "ok" : "warn",

      metric_label: "Drives (with collections)",

      metric_value: `${driveN} (${driveColl})`,

      next_action:

        driveN === 0

          ? "Create an assessment from Collections"

          : driveColl === 0

            ? "Attach Collections when creating drives"

            : null,

    },

  ];



  const loopSteps: PipelineStep[] = [

    {

      id: "student_attempt",

      title: "Student completes",

      href: "/app/superadmin/assessment-results",

      status: completed > 0 ? "ok" : started > 0 ? "warn" : "empty",

      metric_label: "Completed attempts",

      metric_value: completed,

      next_action:

        completed === 0 ? "Publish a drive and have students attempt it" : null,

    },

    {

      id: "ai_evaluation",

      title: "AI evaluates",

      href: "/app/superadmin/assessment-results",

      status: insightN > 0 ? "ok" : completed > 0 ? "warn" : "empty",

      metric_label: "Insights recorded",

      metric_value: insightN,

      next_action:

        completed > 0 && insightN === 0

          ? "Restart API so ExamSubmitted writes insights (migration 54/55)"

          : null,

    },

    {

      id: "weak_skills",

      title: "Weak skills",

      href: "/app/superadmin/assessment-results",

      status: insightN > 0 ? "ok" : "empty",

      metric_label: "Loops with weak topics",

      metric_value: insightN,

      next_action: null,

    },

    {

      id: "kl_lessons",

      title: "KL lessons",

      href: "/app/superadmin/knowledge-library",

      status: lessonN > 0 ? "ok" : insightN > 0 ? "warn" : "empty",

      metric_label: "Lessons recommended",

      metric_value: lessonN,

      next_action:

        insightN > 0 && lessonN === 0

          ? "Publish learning_modules / AI lessons matching Phase-1 skills"

          : null,

    },

    {

      id: "practice_assigned",

      title: "Practice assigned",

      href: "/app/superadmin/practice-sets",

      status: practiceN > 0 ? "ok" : insightN > 0 ? "warn" : "empty",

      metric_label: "Practice assignments",

      metric_value: practiceN,

      next_action:

        insightN > 0 && practiceN === 0

          ? "Apply migration 55; ensure practice arena / practice_test drives exist"

          : null,

    },

    {

      id: "learning_journey",

      title: "Journey update",

      href: "/app/superadmin/learning-journey",

      status: journeyActive > 0 ? "ok" : "empty",

      metric_label: "Active journeys",

      metric_value: journeyActive,

      next_action:

        journeyActive === 0

          ? "Seed Phase-1 journeys or complete an assessment"

          : null,

    },

    {

      id: "placement_readiness",

      title: "Readiness score",

      href: "/app/superadmin/analytics/assessments?report=placement_readiness",

      status: avgReady != null ? "ok" : "empty",

      metric_label: "Avg journey readiness",

      metric_value: avgReady != null ? `${avgReady}%` : "—",

      next_action:

        avgReady == null ? "Complete assessments to blend readiness" : null,

    },

  ];



  const companionStep: PipelineStep = {

    id: "ai_companion",

    title: "AI Companion",

    href: "/app/superadmin/learning-companion",

    status: companionN > 0 ? "ok" : insightN > 0 ? "warn" : "empty",

    metric_label: "Recent companion objects",

    metric_value: companionN,

    next_action:

      insightN > 0 && companionN === 0

        ? "Insights need recommended_object_id (weak-topic bank match)"

        : null,

  };



  const steps = [...catalogSteps, ...loopSteps, companionStep];

  const linkedOk = steps.filter((s) => s.status === "ok").length;



  return {

    pipeline: [

      "Knowledge Library",

      "Question Bank",

      "Assessment Builder",

      "Student Attempt",

      "AI Evaluation",

      "Weak Skills",

      "KL Lessons",

      "Practice Assigned",

      "Learning Journey",

      "Placement Readiness",

      "AI Learning Companion",

    ],

    continuous_learning_loop: [

      "Student Completes Assessment",

      "AI Evaluates Performance",

      "Detect Weak Skills",

      "Recommend Lessons from Knowledge Library",

      "Assign New Practice Set",

      "Update AI Learning Journey",

      "Recalculate Placement Readiness Score",

    ],

    health: {

      linked_steps_ok: linkedOk,

      total_steps: steps.length,

      collections: collN,

      collections_filled: collFilled,

      loops_completed: loopsOk,

    },

    steps,

    loop_steps: loopSteps,

  };

}


