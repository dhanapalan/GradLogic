// =============================================================================
// TalentSecure AI — Exam Session Service (Drive-based)
// =============================================================================
// Handles the student exam runtime: start session, save answers, submit, resume.
// Operates on drive_students + question_bank tables.
// =============================================================================

import { query, queryOne, pool } from "../config/database.js";
import { AppError } from "../middleware/errorHandler.js";
import { scheduleAutoSubmit, cancelAutoSubmit } from "../queues/examTimer.queue.js";
import { eventBus } from "../shared/event-bus.js";

// ── Types ────────────────────────────────────────────────────────────────────

interface DriveForStudent {
    drive_id: string;
    drive_name: string;
    rule_name: string;
    duration_minutes: number;
    total_questions: number;
    total_marks: number;
    negative_marking_enabled: boolean;
    negative_marking_value: number | null;
    overall_cutoff: number;
    drive_status: string;
    scheduled_start: Date | null;
    scheduled_end: Date | null;
    // student session fields
    session_id: string;
    session_status: string;
    started_at: Date | null;
    completed_at: Date | null;
    score: number | null;
    time_remaining_seconds: number | null;
}

interface SessionState {
    session_id: string;
    drive_id: string;
    student_id: string;
    paper_id: string;
    status: string;
    current_question_index: number;
    saved_answers: Record<string, any>;
    time_remaining_seconds: number;
    started_at: Date | null;
    completed_at: Date | null;
    score: number | null;
    drive_name: string;
    duration_minutes: number;
    total_questions: number;
    total_marks: number;
    negative_marking_enabled: boolean;
    negative_marking_value: number | null;
    overall_cutoff: number;
}

interface QuestionForPlayer {
    id: string;
    category: string;
    type: string;
    difficulty_level: string;
    question_text: string;
    options: any;
    marks: number;
    sort_order: number;
}

// ── Get Student's Drives ─────────────────────────────────────────────────────

export async function getStudentDrives(studentId: string): Promise<DriveForStudent[]> {
    return query<DriveForStudent>(
        `SELECT
            ad.id              AS drive_id,
            ad.name            AS drive_name,
            art.name           AS rule_name,
            art.duration_minutes,
            art.total_questions,
            art.total_marks,
            art.negative_marking_enabled,
            art.negative_marking_value,
            art.overall_cutoff,
            ad.status          AS drive_status,
            ad.scheduled_start,
            ad.scheduled_end,
            ds.id              AS session_id,
            ds.status          AS session_status,
            ds.started_at,
            ds.completed_at,
            ds.score,
            ds.time_remaining_seconds
         FROM drive_students ds
         JOIN assessment_drives ad ON ad.id = ds.drive_id
         JOIN assessment_rule_templates art ON art.id = ad.rule_id
         WHERE ds.student_id = $1
         ORDER BY
            CASE ds.status
                WHEN 'in_progress' THEN 0
                WHEN 'assigned'    THEN 1
                WHEN 'completed'   THEN 2
                ELSE 3
            END,
            ad.scheduled_start ASC NULLS LAST`,
        [studentId],
    );
}

// ── Start / Resume Session ───────────────────────────────────────────────────

export async function startSession(driveId: string, studentId: string): Promise<SessionState> {
    // 1. Get the drive_student record
    const ds = await queryOne<any>(
        `SELECT ds.*, ad.name AS drive_name, ad.pool_id, ad.status AS drive_status,
                art.duration_minutes, art.total_questions, art.total_marks,
                art.negative_marking_enabled, art.negative_marking_value, art.overall_cutoff
         FROM drive_students ds
         JOIN assessment_drives ad ON ad.id = ds.drive_id
         JOIN assessment_rule_templates art ON art.id = ad.rule_id
         WHERE ds.drive_id = $1 AND ds.student_id = $2`,
        [driveId, studentId],
    );

    if (!ds) throw new AppError("You are not assigned to this drive", 403);
    if (ds.status === "completed") throw new AppError("This exam has already been completed", 409);

    // Eligibility Checks
    if (ds.eligibility_status === "ineligible") {
        throw new AppError("You do not meet the minimum eligibility criteria (CGPA/Percentage) for this drive.", 403);
    }
    if (ds.eligibility_status === "missing") {
        throw new AppError("Your profile is incomplete. Please ensure your CGPA and Percentage are updated in your profile before starting the exam.", 403);
    }

    if (ds.drive_status !== "active" && ds.drive_status !== "scheduled") {
        throw new AppError("This drive is not currently active", 400);
    }

    // 2. If already in_progress, this is a resume
    if (ds.status === "in_progress" && ds.question_mapping) {
        // Concurrent login heartbeat lock check
        if (ds.last_heartbeat) {
            const timeSinceLastHeartbeat = Date.now() - new Date(ds.last_heartbeat).getTime();
            // Since frontend autosaves every 5s, <15s means another browser is actively on the screen
            if (timeSinceLastHeartbeat < 15000) {
                throw new AppError("An active session is currently running on another device or tab. Please close it before continuing.", 403);
            }
        }

        // Derive remaining time from server_deadline (authoritative) or fall back to started_at
        const timeRemaining = ds.server_deadline
            ? Math.max(0, Math.floor((new Date(ds.server_deadline).getTime() - Date.now()) / 1000))
            : Math.max(0, ds.duration_minutes * 60 - Math.floor((Date.now() - new Date(ds.started_at).getTime()) / 1000));

        // If time expired, auto-submit
        if (timeRemaining <= 0) {
            return submitExam(driveId, studentId);
        }

        // Update time_remaining
        await queryOne(
            `UPDATE drive_students SET time_remaining_seconds = $1 WHERE id = $2`,
            [timeRemaining, ds.id],
        );

        return {
            session_id: ds.id,
            drive_id: driveId,
            student_id: studentId,
            paper_id: ds.paper_id,
            status: "in_progress",
            current_question_index: ds.current_question_index || 0,
            saved_answers: ds.saved_answers || {},
            time_remaining_seconds: timeRemaining,
            started_at: ds.started_at,
            completed_at: null,
            score: null,
            drive_name: ds.drive_name,
            duration_minutes: ds.duration_minutes,
            total_questions: ds.total_questions,
            total_marks: ds.total_marks,
            negative_marking_enabled: ds.negative_marking_enabled,
            negative_marking_value: ds.negative_marking_value,
            overall_cutoff: ds.overall_cutoff,
        };
    }

    // 3. First start — assign questions from pool
    let questionMapping: { question_id: string; sort_order: number }[] = [];

    if (ds.pool_id) {
        // Get questions from the drive-scoped pool
        const poolQuestions = await query<{ question_id: string; sort_order: number }>(
            `SELECT id as question_id, ROW_NUMBER() OVER(ORDER BY created_at) as sort_order FROM drive_pool_questions
             WHERE drive_id = $1`,
            [driveId],
        );

        // Shuffle and take total_questions count
        const shuffled = [...poolQuestions].sort(() => Math.random() - 0.5);
        questionMapping = shuffled.slice(0, ds.total_questions).map((q, i) => ({
            question_id: q.question_id,
            sort_order: i + 1,
        }));
    } else {
        // Fallback: get questions from legacy exam_questions if pool not set
        const examQuestions = await query<{ question_id: string; sort_order: number }>(
            `SELECT question_id, sort_order FROM exam_questions
             WHERE exam_id = $1 ORDER BY sort_order`,
            [driveId],
        );
        questionMapping = examQuestions.map((q, i) => ({
            question_id: q.question_id,
            sort_order: i + 1,
        }));
    }

    if (questionMapping.length === 0) {
        throw new AppError("No questions available in the question pool for this drive", 400);
    }

    const totalSeconds = ds.duration_minutes * 60;
    const serverDeadline = new Date(Date.now() + totalSeconds * 1000);

    // 4. Lock the paper — update drive_students with authoritative server_deadline
    const updated = await queryOne<any>(
        `UPDATE drive_students
         SET status = 'in_progress',
             question_mapping = $1,
             started_at = NOW(),
             saved_answers = '{}',
             current_question_index = 0,
             time_remaining_seconds = $2,
             server_deadline = $3
         WHERE id = $4
         RETURNING *`,
        [JSON.stringify(questionMapping), totalSeconds, serverDeadline.toISOString(), ds.id],
    );

    // 5. Enqueue authoritative auto-submit job at deadline (idempotent)
    await scheduleAutoSubmit(
        { sessionId: updated.id, driveId, studentId },
        serverDeadline,
    ).catch(() => { /* non-fatal: scheduler unavailable, fallback to heartbeat check */ });

    return {
        session_id: updated.id,
        drive_id: driveId,
        student_id: studentId,
        paper_id: updated.paper_id,
        status: "in_progress",
        current_question_index: 0,
        saved_answers: {},
        time_remaining_seconds: totalSeconds,
        started_at: updated.started_at,
        completed_at: null,
        score: null,
        drive_name: ds.drive_name,
        duration_minutes: ds.duration_minutes,
        total_questions: questionMapping.length,
        total_marks: ds.total_marks,
        negative_marking_enabled: ds.negative_marking_enabled,
        negative_marking_value: ds.negative_marking_value,
        overall_cutoff: ds.overall_cutoff,
    };
}

// ── Get Session + Questions ──────────────────────────────────────────────────

export async function getSession(driveId: string, studentId: string): Promise<{
    session: SessionState;
    questions: QuestionForPlayer[];
}> {
    const ds = await queryOne<any>(
        `SELECT ds.*, ad.name AS drive_name,
                art.duration_minutes, art.total_questions, art.total_marks,
                art.negative_marking_enabled, art.negative_marking_value, art.overall_cutoff
         FROM drive_students ds
         JOIN assessment_drives ad ON ad.id = ds.drive_id
         JOIN assessment_rule_templates art ON art.id = ad.rule_id
         WHERE ds.drive_id = $1 AND ds.student_id = $2`,
        [driveId, studentId],
    );

    if (!ds) throw new AppError("Session not found", 404);
    if (ds.status === "assigned") throw new AppError("Exam not started yet", 400);

    // Derive time remaining from server_deadline (authoritative) — never trust the client clock
    let timeRemaining = 0;
    if (ds.status === "in_progress") {
        timeRemaining = ds.server_deadline
            ? Math.max(0, Math.floor((new Date(ds.server_deadline).getTime() - Date.now()) / 1000))
            : Math.max(0, ds.duration_minutes * 60 - Math.floor((Date.now() - new Date(ds.started_at).getTime()) / 1000));
    }

    const session: SessionState = {
        session_id: ds.id,
        drive_id: driveId,
        student_id: studentId,
        paper_id: ds.paper_id,
        status: ds.status,
        current_question_index: ds.current_question_index || 0,
        saved_answers: ds.saved_answers || {},
        time_remaining_seconds: timeRemaining,
        started_at: ds.started_at,
        completed_at: ds.completed_at,
        score: ds.score,
        drive_name: ds.drive_name,
        duration_minutes: ds.duration_minutes,
        total_questions: ds.total_questions,
        total_marks: ds.total_marks,
        negative_marking_enabled: ds.negative_marking_enabled,
        negative_marking_value: ds.negative_marking_value,
        overall_cutoff: ds.overall_cutoff,
    };

    // Get questions — DO NOT include correct_answer (student shouldn't see it)
    const mapping: { question_id: string; sort_order: number }[] = ds.question_mapping || [];
    const questionIds = mapping.map((m) => m.question_id);

    if (questionIds.length === 0) {
        return { session, questions: [] };
    }

    const questions = await query<QuestionForPlayer>(
        `SELECT id, skill as category, 'multiple_choice' as type, difficulty as difficulty_level, question_text, options, marks
         FROM drive_pool_questions
         WHERE id = ANY($1::uuid[])`,
        [questionIds],
    );

    // Sort questions by the mapping sort_order
    const orderMap = new Map(mapping.map((m) => [m.question_id, m.sort_order]));
    questions.sort((a, b) => (orderMap.get(a.id) || 0) - (orderMap.get(b.id) || 0));

    // Attach sort_order to each question
    const questionsWithOrder = questions.map((q) => ({
        ...q,
        sort_order: orderMap.get(q.id) || 0,
    }));

    return { session, questions: questionsWithOrder };
}

// ── Save Answer (Auto-Save) ──────────────────────────────────────────────────

export async function saveAnswer(
    driveId: string,
    studentId: string,
    payload: {
        saved_answers: Record<string, any>;
        current_question_index: number;
        time_remaining_seconds: number;
    },
): Promise<{ success: boolean }> {
    const result = await queryOne<any>(
        `UPDATE drive_students
         SET saved_answers = $1,
             current_question_index = $2,
             time_remaining_seconds = $3,
             last_heartbeat = NOW()
         WHERE drive_id = $4
           AND student_id = $5
           AND status = 'in_progress'
         RETURNING id`,
        [
            JSON.stringify(payload.saved_answers),
            payload.current_question_index,
            payload.time_remaining_seconds,
            driveId,
            studentId,
        ],
    );

    if (!result) throw new AppError("No active session to save", 400);
    return { success: true };
}

// ── Submit Exam ──────────────────────────────────────────────────────────────

export async function submitExam(
    driveId: string,
    studentId: string,
    opts?: { triggeredBy?: "student" | "timer" },
): Promise<SessionState> {
    // 1. Get session
    const ds = await queryOne<any>(
        `SELECT ds.*, ad.name AS drive_name,
                art.duration_minutes, art.total_questions, art.total_marks,
                art.negative_marking_enabled, art.negative_marking_value, art.overall_cutoff
         FROM drive_students ds
         JOIN assessment_drives ad ON ad.id = ds.drive_id
         JOIN assessment_rule_templates art ON art.id = ad.rule_id
         WHERE ds.drive_id = $1 AND ds.student_id = $2`,
        [driveId, studentId],
    );

    if (!ds) throw new AppError("Session not found", 404);
    if (ds.status === "completed") throw new AppError("Already submitted", 409);

    // Cancel the scheduled auto-submit job since we're submitting now
    await cancelAutoSubmit(ds.id).catch(() => { /* non-fatal */ });

    // 2. Auto-grade MCQ questions
    const savedAnswers: Record<string, { selected: string[] }> = ds.saved_answers || {};
    const mapping: { question_id: string }[] = ds.question_mapping || [];
    const questionIds = mapping.map((m) => m.question_id);

    let totalScore = 0;

    if (questionIds.length > 0) {
        const questions = await query<{
            id: string;
            correct_answer: string | null;
            marks: number;
            type: string;
        }>(
            `SELECT id, correct_answer, marks, 'multiple_choice' as type FROM drive_pool_questions WHERE id = ANY($1::uuid[])`,
            [questionIds],
        );

        for (const q of questions) {
            const answer = savedAnswers[q.id];
            if (!answer || !answer.selected || answer.selected.length === 0) continue;

            if (q.type === "multiple_choice" && q.correct_answer) {
                // For single MCQ: correct_answer is a string like "A"
                // For multi MCQ: correct_answer could be "A,C" (comma-separated)
                const correctSet = new Set(q.correct_answer.split(",").map((s) => s.trim()));
                const selectedSet = new Set(answer.selected);

                // Check exact match
                const isCorrect =
                    correctSet.size === selectedSet.size &&
                    [...correctSet].every((c) => selectedSet.has(c));

                if (isCorrect) {
                    totalScore += Number(q.marks);
                } else if (ds.negative_marking_enabled && ds.negative_marking_value) {
                    totalScore -= Number(ds.negative_marking_value);
                }
            }
        }
    }

    // Ensure score doesn't go below 0
    totalScore = Math.max(0, totalScore);

    // 3. Update session
    const updated = await queryOne<any>(
        `UPDATE drive_students
         SET status = 'completed',
             completed_at = NOW(),
             score = $1,
             time_remaining_seconds = 0
         WHERE id = $2
         RETURNING *`,
        [totalScore, ds.id],
    );

    // 4. Emit domain event — subscribers (Learning, Notifications, Hiring) react independently
    eventBus.emit("ExamSubmitted", {
        sessionId: ds.id,
        driveId,
        studentId,
        score: totalScore,
        triggeredBy: opts?.triggeredBy ?? "student",
    });

    // 5. Auto-update student skills from drive's target_skill_ids
    try {
        const drive = await queryOne<any>(
            `SELECT target_skill_ids, overall_cutoff FROM assessment_drives WHERE id = $1`,
            [driveId]
        );
        const skillIds: string[] = drive?.target_skill_ids || [];
        if (skillIds.length > 0) {
            const cutoff = Number(drive?.overall_cutoff || 0);
            const passed = totalScore >= cutoff;
            const proficiency = passed ? Math.min(100, Math.round(totalScore)) : Math.round(totalScore * 0.6);
            const { v4: uuidv4 } = await import("uuid");
            for (const skillId of skillIds) {
                await pool.query(`
                    INSERT INTO student_skills (id, student_id, skill_id, proficiency_score, verified_at)
                    VALUES ($1, $2, $3, $4, NOW())
                    ON CONFLICT (student_id, skill_id)
                    DO UPDATE SET
                        proficiency_score = GREATEST(student_skills.proficiency_score, EXCLUDED.proficiency_score),
                        verified_at = NOW()
                `, [uuidv4(), studentId, skillId, proficiency]);
            }
        }
    } catch (_) { /* non-fatal — don't fail exam submission */ }

    return {
        session_id: updated.id,
        drive_id: driveId,
        student_id: studentId,
        paper_id: updated.paper_id,
        status: "completed",
        current_question_index: ds.current_question_index,
        saved_answers: ds.saved_answers || {},
        time_remaining_seconds: 0,
        started_at: updated.started_at,
        completed_at: updated.completed_at,
        score: totalScore,
        drive_name: ds.drive_name,
        duration_minutes: ds.duration_minutes,
        total_questions: ds.total_questions,
        total_marks: ds.total_marks,
        negative_marking_enabled: ds.negative_marking_enabled,
        negative_marking_value: ds.negative_marking_value,
        overall_cutoff: ds.overall_cutoff,
    };
}
