import { query, queryOne } from "../config/database.js";
import { AppError } from "../middleware/errorHandler.js";
import { DriveStateMachine } from "../shared/drive-state-machine.js";
import { generateDynamicAssessmentViaGroq } from "./llm.service.js";
import { GroqApiError } from "./groq.service.js";
import { sendNotification } from "./notification.service.js";
import {
  sendDriveInviteEmail,
  sendShortlistEmail,
  sendInterviewScheduledEmail,
  sendOfferEmail,
} from "./email.service.js";
import { logger } from "../config/logger.js";
import { env } from "../config/env.js";

// ── Types ────────────────────────────────────────────────────────────────────

export interface DriveRow {
    id: string;
    name: string;
    rule_id: string;
    rule_version_id: string | null;
    pool_id: string | null;
    status: 'DRAFT' | 'GENERATING_POOL' | 'POOL_READY' | 'PENDING_APPROVAL' | 'APPROVED' | 'POOL_APPROVED' | 'READY' | 'LIVE' | 'SCHEDULED' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';
    scheduled_start: Date | null;
    scheduled_end: Date | null;
    actual_start: Date | null;
    actual_end: Date | null;
    total_students: number;
    auto_publish: boolean;
    allow_mock: boolean;
    attempt_limit: number;
    duration_minutes: number | null;
    shuffle_questions: boolean;
    auto_submit: boolean;
    proctoring_mode: string;
    tab_switch_limit: number;
    face_detection_required: boolean;
    max_applicants: number;
    rule_snapshot: any;
    created_by: string | null;
    created_at: Date;
    updated_at: Date;
}

export interface CreateDriveInput {
    name: string;
    rule_id: string;
    drive_type?: "hiring" | "practice_test" | "mock_test" | "coding_assessment";
    duration_minutes?: number;
    scheduled_start?: Date;
    scheduled_end?: Date;
    auto_publish?: boolean;
    allow_mock?: boolean;
    attempt_limit?: number;
    shuffle_questions?: boolean;
    auto_submit?: boolean;
    proctoring_mode?: string;
    proctoring_config?: any;
    tab_switch_limit?: number;
    face_detection_required?: boolean;
    max_applicants?: number;
    created_by?: string;
    status?: string;
    auto_generate_pool?: boolean;
    /** Question Collections to seed the pool from (Assessment Hub pipeline). */
    collection_ids?: string[];
    /** Optional section mapping — defaults to one section per collection. */
    sections?: Array<{ collection_id: string; section_name?: string }>;
}

// ── List Drives ──────────────────────────────────────────────────────────────

export async function listDrives(filters?: { status?: string; rule_id?: string; drive_type?: string }) {
    let sql = `
    SELECT d.*,
           art.name as rule_name,
           art.targeting_config,
           art.hub_template_config,
           arv.version_number as rule_version_number
    FROM assessment_drives d
    LEFT JOIN assessment_rule_templates art ON art.id = d.rule_id
    LEFT JOIN assessment_rule_versions arv ON arv.id = d.rule_version_id
  `;
    const params: any[] = [];
    const conditions: string[] = [];

    if (filters?.status && filters.status !== "all") {
        conditions.push(`UPPER(d.status) = UPPER($${params.length + 1})`);
        params.push(filters.status);
    }
    if (filters?.rule_id) {
        conditions.push(`d.rule_id = $${params.length + 1}`);
        params.push(filters.rule_id);
    }
    if (filters?.drive_type) {
        conditions.push(`d.drive_type = $${params.length + 1}`);
        params.push(filters.drive_type);
    }

    if (conditions.length > 0) {
        sql += ` WHERE ` + conditions.join(" AND ");
    }

    sql += ` ORDER BY d.updated_at DESC`;
    return query(sql, params);
}

// ── Get Drive by ID ──────────────────────────────────────────────────────────

export async function getDriveById(id: string) {
    return queryOne(
        `SELECT d.*,
            art.name as rule_name,
            arv.version_number as rule_version_number,
            arv.snapshot as version_snapshot
     FROM assessment_drives d
     LEFT JOIN assessment_rule_templates art ON art.id = d.rule_id
     LEFT JOIN assessment_rule_versions arv ON arv.id = d.rule_version_id
     WHERE d.id = $1`,
        [id],
    );
}

// ── Create Drive ─────────────────────────────────────────────────────────────

export async function createDrive(input: CreateDriveInput) {
    // 1. Fetch the selected rule to snapshot
    const rule = await queryOne(
        `SELECT * FROM assessment_rule_templates WHERE id = $1`,
        [input.rule_id],
    );
    if (!rule) throw new AppError("Assessment rule not found", 404);

    // 2. Create a rule version snapshot
    const last = await queryOne<{ max_version: number }>(
        `SELECT COALESCE(MAX(version_number), 0) as max_version FROM assessment_rule_versions WHERE rule_id = $1`,
        [input.rule_id],
    );
    const nextVersion = (last?.max_version || 0) + 1;

    const version = await queryOne<{ id: string }>(
        `INSERT INTO assessment_rule_versions (rule_id, version_number, snapshot, is_locked, created_by)
         VALUES ($1, $2, $3, TRUE, $4)
         RETURNING id`,
        [input.rule_id, nextVersion, JSON.stringify(rule), input.created_by || null],
    );

    // 3. Override rule snapshot with user-specified values (duration, proctoring, attempts)
    const snapshotData = typeof rule === 'string' ? JSON.parse(rule as string) : { ...(rule as any) };
    if (input.duration_minutes) snapshotData.duration_minutes = input.duration_minutes;
    if (input.proctoring_mode) snapshotData.proctoring_mode = input.proctoring_mode;
    if (input.proctoring_config) snapshotData.proctoring_config = input.proctoring_config;

    // 4. Create the drive with the snapshot
    const drive = await queryOne<DriveRow>(
        `INSERT INTO assessment_drives
       (name, rule_id, rule_version_id, rule_snapshot, scheduled_start, scheduled_end,
        auto_publish, allow_mock, attempt_limit, duration_minutes,
        shuffle_questions, auto_submit, proctoring_mode, tab_switch_limit, face_detection_required,
        max_applicants, created_by, status, drive_type)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
     RETURNING *`,
        [
            input.name,
            input.rule_id,
            version?.id || null,
            JSON.stringify(snapshotData),
            input.scheduled_start || null,
            input.scheduled_end || null,
            input.auto_publish || false,
            input.allow_mock || input.drive_type === "mock_test" || false,
            input.attempt_limit || 1,
            input.duration_minutes ?? (snapshotData.duration_minutes || null),
            input.shuffle_questions ?? false,
            input.auto_submit ?? true,
            input.proctoring_mode || snapshotData.proctoring_mode || 'standard',
            input.tab_switch_limit ?? (snapshotData.proctoring_config?.max_tab_switches ?? 3),
            input.face_detection_required ?? (snapshotData.proctoring_config?.face_detection_mandatory ?? false),
            input.max_applicants || 500,
            input.created_by || null,
            input.status || 'DRAFT',
            input.drive_type || 'hiring',
        ],
    );

    // 5. Attach Question Collections (Assessment Hub) when provided
    const collectionIds = (input.collection_ids || []).filter(Boolean);
    if (drive && collectionIds.length > 0) {
        const sections = ((input as any).sections || []) as Array<{
            collection_id: string;
            section_name?: string;
        }>;
        // Default: each collection is one section named after the collection
        const sectionPayload =
            sections.length > 0
                ? sections
                : collectionIds.map((id) => ({ collection_id: id }));
        await attachDriveCollections(drive.id, collectionIds, sectionPayload);
        try {
            await seedPoolFromCollections(drive.id);
        } catch (err) {
            logger.error("Collection pool seed failed", {
                driveId: drive.id,
                error: (err as Error).message,
            });
            throw err instanceof AppError
                ? err
                : new AppError((err as Error).message || "Collection pool seed failed", 500);
        }
        return (await getDriveById(drive.id)) || drive;
    }

    if (drive && input.auto_generate_pool !== false) {
        // Fire-and-forget: AI / mock pool generation when no collections attached
        generateDrive(drive.id).catch((err) =>
            logger.error("Auto pool generation failed", {
                driveId: drive.id,
                error: (err as Error).message,
            })
        );
    }

    return drive;
}

/** Link Assessment Builder drives to reusable Question Collections. */
export async function attachDriveCollections(
    driveId: string,
    collectionIds: string[],
    sections?: Array<{ collection_id: string; section_name?: string | null }>
) {
    const sectionById = new Map(
        (sections || []).map((s) => [s.collection_id, s.section_name || null])
    );
    for (const collectionId of collectionIds) {
        const sectionName = sectionById.get(collectionId) ?? null;
        await query(
            `INSERT INTO drive_source_collections (drive_id, collection_id, section_name)
             VALUES ($1, $2, $3)
             ON CONFLICT (drive_id, collection_id) DO UPDATE
             SET section_name = COALESCE(EXCLUDED.section_name, drive_source_collections.section_name)`,
            [driveId, collectionId, sectionName]
        ).catch(async () => {
            // Older DBs without section_name column
            await query(
                `INSERT INTO drive_source_collections (drive_id, collection_id)
                 VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                [driveId, collectionId]
            );
        });
    }
}

export async function listDriveCollections(driveId: string) {
    return query(
        `SELECT c.id, c.name, c.category, c.description,
            dsc.section_name,
            (SELECT COUNT(*)::int FROM question_collection_items i WHERE i.collection_id = c.id) AS question_count
         FROM drive_source_collections dsc
         JOIN question_collections c ON c.id = dsc.collection_id
         WHERE dsc.drive_id = $1
         ORDER BY COALESCE(dsc.section_name, c.name)`,
        [driveId]
    ).catch(() =>
        query(
            `SELECT c.id, c.name, c.category, c.description,
                NULL::text AS section_name,
                (SELECT COUNT(*)::int FROM question_collection_items i WHERE i.collection_id = c.id) AS question_count
             FROM drive_source_collections dsc
             JOIN question_collections c ON c.id = dsc.collection_id
             WHERE dsc.drive_id = $1
             ORDER BY c.name`,
            [driveId]
        )
    );
}

function normalizeDifficulty(raw: string | null | undefined): "easy" | "medium" | "hard" {
    const d = String(raw || "medium").toLowerCase();
    if (d === "easy" || d === "beginner") return "easy";
    if (d === "hard" || d === "advanced") return "hard";
    return "medium";
}

function parseDifficultyMix(raw: unknown): { easy: number; medium: number; hard: number } {
    const defaults = { easy: 30, medium: 50, hard: 20 };
    if (!raw || typeof raw !== "object") return defaults;
    const o = raw as Record<string, unknown>;
    const easy = Number(o.easy ?? o.Easy ?? defaults.easy);
    const medium = Number(o.medium ?? o.Medium ?? defaults.medium);
    const hard = Number(o.hard ?? o.Hard ?? defaults.hard);
    const sum = easy + medium + hard;
    if (sum <= 0) return defaults;
    return {
        easy: Math.round((easy / sum) * 100),
        medium: Math.round((medium / sum) * 100),
        hard: Math.max(0, 100 - Math.round((easy / sum) * 100) - Math.round((medium / sum) * 100)),
    };
}

function sampleByDifficultyMix<T extends { difficulty_level: string | null }>(
    items: T[],
    total: number,
    mix: { easy: number; medium: number; hard: number }
): T[] {
    const buckets: Record<"easy" | "medium" | "hard", T[]> = {
        easy: [],
        medium: [],
        hard: [],
    };
    for (const q of items) {
        buckets[normalizeDifficulty(q.difficulty_level)].push(q);
    }
    for (const key of Object.keys(buckets) as Array<"easy" | "medium" | "hard">) {
        buckets[key] = [...buckets[key]].sort(() => Math.random() - 0.5);
    }

    const target = {
        easy: Math.round((mix.easy / 100) * total),
        medium: Math.round((mix.medium / 100) * total),
        hard: 0,
    };
    target.hard = Math.max(0, total - target.easy - target.medium);

    const pick = (key: "easy" | "medium" | "hard", n: number) =>
        buckets[key].splice(0, Math.min(n, buckets[key].length));

    let selected = [
        ...pick("easy", target.easy),
        ...pick("medium", target.medium),
        ...pick("hard", target.hard),
    ];

    // Top up from leftovers if a bucket was short
    const leftover = [...buckets.easy, ...buckets.medium, ...buckets.hard].sort(
        () => Math.random() - 0.5
    );
    while (selected.length < total && leftover.length > 0) {
        selected.push(leftover.shift()!);
    }

    if (selected.length > total) selected = selected.slice(0, total);
    return selected;
}

/**
 * Seed drive pool from attached Question Collections (bank rows — no duplicate content).
 * Applies template difficulty mix + optional shuffle. Marks generation completed for approve.
 */
export async function seedPoolFromCollections(driveId: string) {
    const linked = await query<{
        collection_id: string;
        section_name: string | null;
        collection_name: string;
    }>(
        `SELECT dsc.collection_id,
                dsc.section_name,
                c.name AS collection_name
         FROM drive_source_collections dsc
         JOIN question_collections c ON c.id = dsc.collection_id
         WHERE dsc.drive_id = $1`,
        [driveId]
    ).catch(() =>
        query<{ collection_id: string; section_name: string | null; collection_name: string }>(
            `SELECT dsc.collection_id, NULL::text AS section_name, c.name AS collection_name
             FROM drive_source_collections dsc
             JOIN question_collections c ON c.id = dsc.collection_id
             WHERE dsc.drive_id = $1`,
            [driveId]
        )
    );

    if (linked.length === 0) {
        throw new AppError("No question collections attached to this drive", 400);
    }

    const pool = await queryOne<{ id: string }>(
        `INSERT INTO drive_question_pool (drive_id, total_generated, generation_status, status)
         VALUES ($1, 0, 'generating', 'pending')
         ON CONFLICT (drive_id) DO UPDATE
         SET generation_status = 'generating', status = 'pending', total_generated = 0,
             is_locked = FALSE
         RETURNING id`,
        [driveId]
    );
    if (!pool) throw new AppError("Failed to create question pool", 500);

    await query(`DELETE FROM drive_pool_questions WHERE pool_id = $1`, [pool.id]);

    const questions = await query<{
        id: string;
        question_text: string;
        difficulty_level: string | null;
        category: string | null;
        options: unknown;
        correct_answer: string | null;
        marks: number | null;
        type: string | null;
        collection_id: string;
        collection_name: string;
        section_name: string | null;
    }>(
        `SELECT DISTINCT ON (q.id)
            q.id, q.question_text, q.difficulty_level, q.category, q.options,
            q.correct_answer, q.marks, q.type,
            i.collection_id, c.name AS collection_name, dsc.section_name
         FROM question_collection_items i
         JOIN question_bank q ON q.id = i.question_id
         JOIN question_collections c ON c.id = i.collection_id
         LEFT JOIN drive_source_collections dsc
           ON dsc.collection_id = i.collection_id AND dsc.drive_id = $2
         WHERE i.collection_id = ANY($1::uuid[])
           AND q.deleted_at IS NULL
           AND COALESCE(q.is_active, true) = true
         ORDER BY q.id, i.sort_order`,
        [linked.map((l) => l.collection_id), driveId]
    ).catch(() =>
        query(
            `SELECT DISTINCT ON (q.id)
                q.id, q.question_text, q.difficulty_level, q.category, q.options,
                q.correct_answer, q.marks, q.type,
                i.collection_id, c.name AS collection_name, NULL::text AS section_name
             FROM question_collection_items i
             JOIN question_bank q ON q.id = i.question_id
             JOIN question_collections c ON c.id = i.collection_id
             WHERE i.collection_id = ANY($1::uuid[])
               AND q.deleted_at IS NULL
               AND COALESCE(q.is_active, true) = true
             ORDER BY q.id, i.sort_order`,
            [linked.map((l) => l.collection_id)]
        )
    );

    if (questions.length === 0) {
        throw new AppError(
            "Attached collections have no questions — fill collections from Question Bank first",
            400
        );
    }

    const drive = await getDriveById(driveId);
    const snapshot =
        typeof (drive as any)?.rule_snapshot === "string"
            ? JSON.parse((drive as any).rule_snapshot)
            : (drive as any)?.rule_snapshot || {};
    const mix = parseDifficultyMix(snapshot.difficulty_distribution);
    const totalTarget = Math.max(
        1,
        Number(snapshot.total_questions) || Math.min(questions.length, 30)
    );

    let ordered = sampleByDifficultyMix(questions, totalTarget, mix);
    if ((drive as any)?.shuffle_questions) {
        ordered = [...ordered].sort(() => Math.random() - 0.5);
    }

    const actualMix = { easy: 0, medium: 0, hard: 0 };
    const sectionCounts: Record<string, number> = {};

    let inserted = 0;
    for (const q of ordered) {
        const diffKey = normalizeDifficulty(q.difficulty_level);
        actualMix[diffKey]++;
        const section =
            q.section_name ||
            linked.find((l) => l.collection_id === q.collection_id)?.section_name ||
            q.collection_name ||
            q.category ||
            "General";
        sectionCounts[section] = (sectionCounts[section] || 0) + 1;

        const difficultyLabel =
            diffKey === "easy" ? "Easy" : diffKey === "hard" ? "Hard" : "Medium";

        await query(
            `INSERT INTO drive_pool_questions
                (drive_id, pool_id, question_text, difficulty, skill, options, correct_answer, marks, ai_metadata)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
                driveId,
                pool.id,
                q.question_text,
                difficultyLabel,
                section,
                q.options ? JSON.stringify(q.options) : null,
                q.correct_answer,
                q.marks ?? 1,
                JSON.stringify({
                    source: "question_collection",
                    bank_id: q.id,
                    type: q.type,
                    collection_id: q.collection_id,
                    section,
                }),
            ]
        );
        inserted++;
    }

    const targetCounts = {
        easy: Math.round((mix.easy / 100) * inserted),
        medium: Math.round((mix.medium / 100) * inserted),
        hard: 0,
    };
    targetCounts.hard = Math.max(0, inserted - targetCounts.easy - targetCounts.medium);

    const difficulty_distribution: Record<
        string,
        { target_pct: number; actual_count: number; actual_pct: number }
    > = {};
    for (const key of ["easy", "medium", "hard"] as const) {
        difficulty_distribution[key] = {
            target_pct: mix[key],
            actual_count: actualMix[key],
            actual_pct: inserted ? Math.round((actualMix[key] / inserted) * 100) : 0,
        };
    }

    const skill_distribution: Record<
        string,
        { target_pct: number; actual_count: number; actual_pct: number }
    > = {};
    for (const [section, count] of Object.entries(sectionCounts)) {
        skill_distribution[section] = {
            target_pct: inserted ? Math.round((count / inserted) * 100) : 0,
            actual_count: count,
            actual_pct: inserted ? Math.round((count / inserted) * 100) : 0,
        };
    }

    await query(
        `UPDATE drive_question_pool
         SET total_generated = $1,
             generation_status = 'completed',
             status = 'pending',
             difficulty_distribution = $2::jsonb,
             skill_distribution = $3::jsonb,
             validation_score = 100
         WHERE id = $4`,
        [
            inserted,
            JSON.stringify(difficulty_distribution),
            JSON.stringify(skill_distribution),
            pool.id,
        ]
    ).catch(async () => {
        await query(
            `UPDATE drive_question_pool
             SET total_generated = $1, generation_status = 'completed', status = 'pending'
             WHERE id = $2`,
            [inserted, pool.id]
        );
    });

    try {
        await query(
            `UPDATE assessment_drives SET status = 'POOL_READY', updated_at = NOW() WHERE id = $1`,
            [driveId]
        );
    } catch {
        await query(
            `UPDATE assessment_drives SET status = 'DRAFT', updated_at = NOW() WHERE id = $1`,
            [driveId]
        );
    }

    try {
        await query(`UPDATE assessment_drives SET pool_id = $1 WHERE id = $2`, [pool.id, driveId]);
    } catch {
        /* column optional */
    }

    // Persist assemble metadata when column exists
    try {
        await query(
            `UPDATE assessment_drives
             SET assembler_config = COALESCE(assembler_config, '{}'::jsonb) || $1::jsonb,
                 updated_at = NOW()
             WHERE id = $2`,
            [
                JSON.stringify({
                    source: "question_collections",
                    difficulty_mix: mix,
                    sections: linked.map((l) => ({
                        collection_id: l.collection_id,
                        section_name: l.section_name || l.collection_name,
                    })),
                    total_seeded: inserted,
                    seeded_at: new Date().toISOString(),
                }),
                driveId,
            ]
        );
    } catch {
        /* optional column */
    }

    return { pool_id: pool.id, inserted, difficulty_mix: mix, sections: sectionCounts };
}

// ── Update Drive ─────────────────────────────────────────────────────────────

export async function updateDrive(id: string, input: Partial<CreateDriveInput> & { status?: string }) {
    // Guard: execution config fields are only editable when DRAFT or POOL_APPROVED
    const CONFIG_FIELDS = [
        "scheduled_start", "scheduled_end", "duration_minutes", "attempt_limit",
        "shuffle_questions", "auto_submit", "proctoring_enabled", "proctoring_mode",
        "tab_switch_limit", "face_detection_required", "max_applicants",
    ];
    const hasConfigChange = CONFIG_FIELDS.some((f) => (input as any)[f] !== undefined);

    if (hasConfigChange) {
        const drive = await getDriveById(id);
        if (!drive) throw new AppError("Drive not found", 404);
        const st = (drive as any).status?.toUpperCase();
        if (!['DRAFT', 'POOL_READY', 'PENDING_APPROVAL', 'POOL_APPROVED', 'APPROVED'].includes(st)) {
            throw new AppError(`Execution config is locked — drive status is ${(drive as any).status}`, 403);
        }
    }

    const fields: string[] = [];
    const params: any[] = [];
    let idx = 1;

    const allowed: string[] = [
        "name", "scheduled_start", "scheduled_end", "auto_publish",
        "allow_mock", "attempt_limit", "status", "duration_minutes",
        "shuffle_questions", "auto_submit", "proctoring_enabled", "proctoring_mode",
        "tab_switch_limit", "face_detection_required", "max_applicants",
    ];

    for (const f of allowed) {
        if ((input as any)[f] !== undefined) {
            fields.push(`${f} = $${idx++}`);
            params.push((input as any)[f]);
        }
    }

    if (fields.length === 0) return getDriveById(id);

    fields.push(`updated_at = NOW()`);
    params.push(id);

    return queryOne<DriveRow>(
        `UPDATE assessment_drives SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
        params,
    );
}

// ── Generate Drive (one-click flow) ──────────────────────────────────────────

export async function generateDrive(driveId: string) {
    const drive = await getDriveById(driveId);
    if (!drive) return null;

    let versionId = (drive as any).rule_version_id;
    let snapshot = (drive as any).rule_snapshot;

    // 1. If snapshot doesn't exist (legacy drives), create it now
    if (!versionId || !snapshot) {
        const rule = await queryOne(
            `SELECT * FROM assessment_rule_templates WHERE id = $1`,
            [(drive as any).rule_id],
        );
        if (!rule) throw new AppError("Base assessment rule not found", 404);

        const last = await queryOne<{ max_version: number }>(
            `SELECT COALESCE(MAX(version_number), 0) as max_version FROM assessment_rule_versions WHERE rule_id = $1`,
            [(drive as any).rule_id],
        );
        const nextVersion = (last?.max_version || 0) + 1;

        const version = await queryOne<{ id: string }>(
            `INSERT INTO assessment_rule_versions (rule_id, version_number, snapshot, is_locked, created_by)
             VALUES ($1, $2, $3, TRUE, $4)
             RETURNING id`,
            [(drive as any).rule_id, nextVersion, JSON.stringify(rule), (drive as any).created_by],
        );

        versionId = version?.id;
        snapshot = rule;

        // Update drive with this new snapshot
        await query(
            `UPDATE assessment_drives SET rule_version_id = $1, rule_snapshot = $2 WHERE id = $3`,
            [versionId, JSON.stringify(snapshot), driveId]
        );
    }

    // 2. Create or reuse a drive-scoped pool
    const pool = await queryOne<{ id: string }>(
        `INSERT INTO drive_question_pool (drive_id, total_generated, generation_status, status)
         VALUES ($1, $2, 'ready', 'pending')
         ON CONFLICT (drive_id) DO UPDATE 
         SET generation_status = 'ready', status = 'pending', total_generated = 0
         RETURNING id`,
        [driveId, 0],
    );

    // 2.5 Clear any existing questions in this pool
    await query(`DELETE FROM drive_pool_questions WHERE pool_id = $1`, [pool!.id]);

    // 3. Update drive with pool and status
    await query(
        `UPDATE assessment_drives
     SET pool_id = $1, status = 'GENERATING_POOL', updated_at = NOW()
     WHERE id = $2`,
        [pool!.id, driveId],
    );

    // POOL GENERATION: Uses real AI (Groq) when GROQ_API_KEY is configured, otherwise uses mock generator
    // Fire-and-forget — runs in the background while we return immediately
    (async () => {
        try {
            // Parse rule snapshot to extract generation parameters
            const ruleConfig = typeof snapshot === 'string' ? JSON.parse(snapshot) : snapshot;
            const totalQuestions: number = ruleConfig.total_questions || 30;
            const durationMinutes: number = ruleConfig.duration_minutes || 60;

            // Build category weights from skill_distribution
            let categoryWeights: { category: string; percentage: number }[] = [];
            const skillDist = ruleConfig.skill_distribution;
            if (skillDist && typeof skillDist === 'object') {
                if (Array.isArray(skillDist)) {
                    categoryWeights = skillDist.map((s: any) => ({
                        category: s.category || s.skill || s.name,
                        percentage: s.percentage || s.weight || 0,
                    }));
                } else {
                    categoryWeights = Object.entries(skillDist).map(([cat, pct]) => ({
                        category: cat,
                        percentage: Number(pct),
                    }));
                }
            }

            if (categoryWeights.length === 0) {
                categoryWeights = [{ category: "General", percentage: 100 }];
            }

            // Normalize percentages to sum to 100
            const pctSum = categoryWeights.reduce((s, w) => s + w.percentage, 0);
            if (Math.abs(pctSum - 100) > 0.5) {
                categoryWeights = categoryWeights.map(w => ({
                    ...w,
                    percentage: Math.round((w.percentage / pctSum) * 100),
                }));
                const diff = 100 - categoryWeights.reduce((s, w) => s + w.percentage, 0);
                if (diff !== 0 && categoryWeights.length > 0) {
                    categoryWeights[0].percentage += diff;
                }
            }

            // ── Read difficulty distribution from rule (fallback: 30/50/20) ──
            let diffWeightsMap: Record<string, number> = { easy: 0.3, medium: 0.5, hard: 0.2 };
            const diffDist = ruleConfig.difficulty_distribution;
            if (diffDist && typeof diffDist === 'object') {
                if (Array.isArray(diffDist)) {
                    diffDist.forEach((d: any) => {
                        const key = (d.difficulty || d.level || d.name || '').toLowerCase();
                        if (key) diffWeightsMap[key] = (d.percentage || d.weight || 0) / 100;
                    });
                } else {
                    for (const [key, val] of Object.entries(diffDist)) {
                        diffWeightsMap[key.toLowerCase()] = Number(val) / 100;
                    }
                }
                // Normalize to sum to 1
                const dSum = Object.values(diffWeightsMap).reduce((s, v) => s + v, 0);
                if (dSum > 0) {
                    for (const k of Object.keys(diffWeightsMap)) {
                        diffWeightsMap[k] = diffWeightsMap[k] / dSum;
                    }
                }
            }

            // Drive question generation is Groq's dedicated slot (configured
            // via superadmin → AI Services → Drive Question Generation).
            // Claude has its own separate slot (resume_extraction) for
            // resume parsing / feedback / learning plans — kept independent
            // so the two features can be configured and fail independently.
            const useGroq = !!env.GROQ_API_KEY;
            let generated = 0;
            let fellBackToMock = false;

            // Shared mock generator — used directly when no AI key is set, and
            // as a fallback if AI generation keeps failing, so a drive still
            // ends up with a usable question pool instead of stalling forever.
            let mockTemplates: Record<string, MockTemplate[]> | null = null;
            const difficulties: Array<'Easy' | 'Medium' | 'Hard'> = ['Easy', 'Medium', 'Hard'];
            const diffWeights = [diffWeightsMap['easy'] || 0.3, diffWeightsMap['medium'] || 0.5, diffWeightsMap['hard'] || 0.2];

            async function generateMockBatch(count: number, indexOffset: number) {
                if (!mockTemplates) mockTemplates = buildMockQuestionBank();
                for (let i = 0; i < count; i++) {
                    const idx = indexOffset + i;
                    // Pick category based on weights
                    const catEntry = pickWeighted(categoryWeights);
                    const category = catEntry.category;

                    // Pick difficulty based on distribution
                    const rand = Math.random();
                    const diff = rand < diffWeights[0] ? difficulties[0] : rand < diffWeights[0] + diffWeights[1] ? difficulties[1] : difficulties[2];
                    const marks = diff === 'Easy' ? 5 : diff === 'Medium' ? 10 : 15;

                    // Pick a template and generate a unique variation
                    const templates = mockTemplates[category] || mockTemplates['General'];
                    const template = templates[idx % templates.length];
                    const questionText = template.textFn(idx);
                    const options = template.optionsFn(idx);
                    const correctAnswer = template.correct;

                    await query(
                        `INSERT INTO drive_pool_questions
                            (drive_id, pool_id, question_text, difficulty, skill, options, correct_answer, marks)
                         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                        [driveId, pool!.id, questionText, diff, category, JSON.stringify(options), correctAnswer, marks]
                    );
                    generated++;

                    // Update progress every 50 questions
                    if (generated % 50 === 0 || generated === totalQuestions) {
                        await query(`UPDATE drive_question_pool SET total_generated = $1 WHERE id = $2`, [generated, pool!.id]);
                    }
                }
            }

            if (useGroq) {
                // ── AI-powered generation in batches ──────────────────────
                // Smaller than Claude's batch size — llama-3.3-70b-versatile's
                // output-token ceiling on Groq is materially smaller than
                // Claude's, and large batches (esp. with coding questions'
                // hidden_test_cases) risk truncation at higher counts.
                const GROQ_BATCH_SIZE = 25;
                // Cap consecutive failures (bad/revoked key, provider outage)
                // instead of retrying every 2s forever with total_generated
                // stuck at 0 — fall back to mock questions once exceeded.
                const MAX_CONSECUTIVE_FAILURES = 3;
                let batchNumber = 0;
                let consecutiveFailures = 0;

                while (generated < totalQuestions) {
                    batchNumber++;
                    const remaining = totalQuestions - generated;
                    const batchCount = Math.min(GROQ_BATCH_SIZE, remaining);
                    const batchDuration = Math.max(10, Math.round((batchCount / totalQuestions) * durationMinutes));

                    logger.info(`Pool generation batch ${batchNumber}: generating ${batchCount} questions (${generated}/${totalQuestions} done)`, { driveId });

                    try {
                        const assessment = await generateDynamicAssessmentViaGroq(categoryWeights, batchCount, batchDuration);

                        for (const q of assessment.questions) {
                            const isMCQ = q.type === 'mcq';
                            const questionText = q.question_text;
                            const difficulty = q.difficulty === 'easy' ? 'Easy' : q.difficulty === 'medium' ? 'Medium' : 'Hard';
                            const marks = q.difficulty === 'easy' ? 5 : q.difficulty === 'medium' ? 10 : 15;


                            let options: any = null;
                            let correctAnswer: string | null = null;

                            if (isMCQ && 'options' in q) {
                                const labels = ['a', 'b', 'c', 'd'];
                                const optObj: Record<string, string> = {};
                                q.options.forEach((opt: string, idx: number) => {
                                    optObj[labels[idx] || String(idx)] = opt;
                                });
                                options = optObj;
                                correctAnswer = labels[q.correct_answer] || 'a';
                            }

                            const aiMetadata: any = { type: q.type, batch: batchNumber };
                            if (!isMCQ && 'hidden_test_cases' in q) {
                                aiMetadata.hidden_test_cases = q.hidden_test_cases;
                            }

                            await query(
                                `INSERT INTO drive_pool_questions
                                    (drive_id, pool_id, question_text, difficulty, skill, options, correct_answer, marks, ai_metadata)
                                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                                [driveId, pool!.id, questionText, difficulty, q.category, options ? JSON.stringify(options) : null, correctAnswer, marks, JSON.stringify(aiMetadata)]
                            );
                        }

                        generated += assessment.questions.length;
                        consecutiveFailures = 0;
                        await query(`UPDATE drive_question_pool SET total_generated = $1 WHERE id = $2`, [generated, pool!.id]);
                        logger.info(`Pool generation batch ${batchNumber} complete: ${generated}/${totalQuestions}`, { driveId });
                    } catch (batchErr: any) {
                        const upstreamStatus = batchErr instanceof GroqApiError ? batchErr.upstreamStatus : null;
                        const isAuthFailure = upstreamStatus === 401 || upstreamStatus === 403;
                        const isRateLimited = upstreamStatus === 429;

                        if (isAuthFailure) {
                            // Bad/revoked key — will never succeed. Don't waste
                            // attempts or time on it; fall back immediately.
                            logger.error(`Pool generation batch ${batchNumber} failed — Groq auth error (${upstreamStatus}), key will never work`, { driveId, error: batchErr.message });
                            consecutiveFailures = MAX_CONSECUTIVE_FAILURES;
                        } else if (isRateLimited) {
                            // Rate limited, not broken — don't count against the
                            // failure cap; just back off longer than a normal
                            // retry (honor Retry-After if Groq sent one).
                            const retryAfterSeconds = batchErr instanceof GroqApiError ? batchErr.retryAfterSeconds : null;
                            const backoffMs = Math.max(5000, (retryAfterSeconds || 8) * 1000);
                            logger.warn(`Pool generation batch ${batchNumber} rate-limited by Groq — backing off ${backoffMs}ms`, { driveId });
                            await new Promise(resolve => setTimeout(resolve, backoffMs));
                        } else {
                            consecutiveFailures++;
                            logger.error(`Pool generation batch ${batchNumber} failed (${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES} consecutive)`, { driveId, error: batchErr.message });
                        }

                        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
                            const remainingAfterFailures = totalQuestions - generated;
                            logger.warn(`AI generation failed ${consecutiveFailures} times in a row — falling back to mock questions for the remaining ${remainingAfterFailures}`, { driveId });
                            fellBackToMock = true;
                            await generateMockBatch(remainingAfterFailures, generated);
                            break;
                        }

                        if (!isRateLimited) {
                            await new Promise(resolve => setTimeout(resolve, 2000));
                        }
                    }

                    if (generated < totalQuestions) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }
            } else {
                // ── Mock generation (no Groq key) ──────────────────────
                logger.info(`No GROQ_API_KEY configured — using mock question generator for ${totalQuestions} questions`, { driveId });
                await generateMockBatch(totalQuestions, 0);
            }

            // ── Post-generation: Validate, Deduplicate, Randomize ──────
            logger.info(`Running post-generation validation on ${generated} questions`, { driveId });

            // 1. Duplicate detection using trigram similarity on question_text
            const duplicates = await query<{ id1: string; id2: string; similarity: number }>(
                `SELECT a.id as id1, b.id as id2,
                        similarity(lower(a.question_text), lower(b.question_text)) as similarity
                 FROM drive_pool_questions a
                 JOIN drive_pool_questions b ON a.pool_id = b.pool_id AND a.id < b.id
                 WHERE a.pool_id = $1
                   AND similarity(lower(a.question_text), lower(b.question_text)) > 0.7
                 ORDER BY similarity DESC`,
                [pool!.id]
            ).catch(() => {
                // pg_trgm extension may not be installed — fall back to basic exact-match check
                logger.warn('pg_trgm not available, falling back to exact-match duplicate detection', { driveId });
                return query<{ id1: string; id2: string; similarity: number }>(
                    `SELECT a.id as id1, b.id as id2, 1.0 as similarity
                     FROM drive_pool_questions a
                     JOIN drive_pool_questions b ON a.pool_id = b.pool_id AND a.id < b.id
                     WHERE a.pool_id = $1
                       AND lower(trim(a.question_text)) = lower(trim(b.question_text))`,
                    [pool!.id]
                );
            });

            // Mark duplicate questions and track count
            const duplicateIds = new Set<string>();
            for (const dup of duplicates) {
                duplicateIds.add(dup.id2); // keep id1, flag id2 as duplicate
                await query(
                    `UPDATE drive_pool_questions SET status = 'duplicate', duplicate_similarity = $1 WHERE id = $2`,
                    [dup.similarity, dup.id2]
                );
            }
            const duplicateCount = duplicateIds.size;
            const duplicatePct = generated > 0 ? Math.round((duplicateCount / generated) * 100) : 0;

            logger.info(`Duplicate check: ${duplicateCount} duplicates found (${duplicatePct}%)`, { driveId });

            // 2. Randomize the display order of non-duplicate questions
            //    Persist randomized order by assigning staggered created_at timestamps
            const validQuestions = await query<{ id: string }>(
                `SELECT id FROM drive_pool_questions WHERE pool_id = $1 AND status != 'duplicate' ORDER BY random()`,
                [pool!.id]
            );
            const baseTime = new Date();
            for (let i = 0; i < validQuestions.length; i++) {
                const staggeredTime = new Date(baseTime.getTime() + i);
                await query(
                    `UPDATE drive_pool_questions SET created_at = $1 WHERE id = $2`,
                    [staggeredTime.toISOString(), validQuestions[i].id]
                );
            }

            // 3. Calculate validation score
            //    Score = weighted: 40% skill coverage + 30% difficulty adherence + 30% no-duplicate rate
            const activeQuestions = generated - duplicateCount;

            // Skill coverage: how well the actual distribution matches the target
            const actualSkillCounts = await query<{ skill: string; cnt: number }>(
                `SELECT skill, count(*)::int as cnt FROM drive_pool_questions WHERE pool_id = $1 AND status != 'duplicate' GROUP BY skill`,
                [pool!.id]
            );
            const actualSkillMap = new Map(actualSkillCounts.map(r => [r.skill, r.cnt]));
            let skillScore = 100;
            if (categoryWeights.length > 0 && activeQuestions > 0) {
                let totalDeviation = 0;
                for (const cw of categoryWeights) {
                    const expectedPct = cw.percentage;
                    const actual = actualSkillMap.get(cw.category) || 0;
                    const actualPct = (actual / activeQuestions) * 100;
                    totalDeviation += Math.abs(expectedPct - actualPct);
                }
                skillScore = Math.max(0, 100 - totalDeviation);
            }

            // Difficulty adherence: how well the actual distribution matches the target
            const actualDiffCounts = await query<{ difficulty: string; cnt: number }>(
                `SELECT difficulty, count(*)::int as cnt FROM drive_pool_questions WHERE pool_id = $1 AND status != 'duplicate' GROUP BY difficulty`,
                [pool!.id]
            );
            const actualDiffMap = new Map(actualDiffCounts.map(r => [(r.difficulty || '').toLowerCase(), r.cnt]));
            let diffScore = 100;
            if (activeQuestions > 0) {
                let totalDiffDev = 0;
                for (const [level, targetPct] of Object.entries(diffWeightsMap)) {
                    const actual = actualDiffMap.get(level) || 0;
                    const actualPct = actual / activeQuestions;
                    totalDiffDev += Math.abs(targetPct - actualPct) * 100;
                }
                diffScore = Math.max(0, 100 - totalDiffDev);
            }

            // No-duplicate rate
            const noDupScore = generated > 0 ? ((generated - duplicateCount) / generated) * 100 : 100;

            // Weighted final score
            const validationScore = Math.round(skillScore * 0.4 + diffScore * 0.3 + noDupScore * 0.3);

            // 4. Build distribution metadata for the pool record
            const skillDistribution = Object.fromEntries(
                categoryWeights.map(cw => [cw.category, {
                    target_pct: cw.percentage,
                    actual_count: actualSkillMap.get(cw.category) || 0,
                    actual_pct: activeQuestions > 0 ? Math.round(((actualSkillMap.get(cw.category) || 0) / activeQuestions) * 100) : 0,
                }])
            );
            const diffDistribution = Object.fromEntries(
                Object.entries(diffWeightsMap).map(([level, target]) => [level, {
                    target_pct: Math.round(target * 100),
                    actual_count: actualDiffMap.get(level) || 0,
                    actual_pct: activeQuestions > 0 ? Math.round(((actualDiffMap.get(level) || 0) / activeQuestions) * 100) : 0,
                }])
            );

            // Mark pool as completed with full metadata
            await query(
                `UPDATE drive_question_pool
                 SET generation_status = 'completed',
                     status = 'pending',
                     total_generated = $1,
                     validation_score = $2,
                     skill_distribution = $3,
                     difficulty_distribution = $4
                 WHERE id = $5`,
                [generated, validationScore, JSON.stringify(skillDistribution), JSON.stringify(diffDistribution), pool!.id]
            );
            await query(
                `UPDATE assessment_drives SET status = 'PENDING_APPROVAL' WHERE id = $1`,
                [driveId]
            );
            const generationMode = !useGroq ? 'mock' : fellBackToMock ? 'groq+mock-fallback' : 'groq';
            logger.info(`Pool generation complete: ${generated} questions, validation=${validationScore}%, duplicates=${duplicateCount} (mode: ${generationMode})`, { driveId });
        } catch (error: any) {
            logger.error("Pool generation failed", { driveId, error: error.message });
            await query(`UPDATE drive_question_pool SET generation_status = 'failed' WHERE drive_id = $1`, [driveId]).catch(() => { });
            await query(`UPDATE assessment_drives SET status = 'DRAFT' WHERE id = $1`, [driveId]).catch(() => { });
        }
    })();

    return getDriveById(driveId);
}

// ── Pool Review & Approval ───────────────────────────────────────────────────

export async function getDrivePool(driveId: string) {
    const pool = await queryOne(
        `SELECT p.*, u.name as approver_name
         FROM drive_question_pool p
         LEFT JOIN users u ON u.id = p.approved_by
         WHERE p.drive_id = $1`,
        [driveId]
    );
    if (!pool) return null;

    const questions = await query(
        `SELECT * FROM drive_pool_questions WHERE pool_id = $1 ORDER BY created_at ASC`,
        [pool.id]
    );

    return { ...pool, questions };
}

export async function approveDrivePool(driveId: string, userId: string) {
    const pool = await queryOne<{ id: string; status: string; is_locked: boolean; generation_status: string }>(
        `SELECT id, status, is_locked, generation_status FROM drive_question_pool WHERE drive_id = $1`,
        [driveId]
    );

    if (!pool) throw new AppError("Pool not found", 404);

    // Guard: cannot approve an already-locked/approved pool
    if (pool.is_locked) throw new AppError("Pool is already locked and approved", 409);
    if (pool.status === 'approved') throw new AppError("Pool has already been approved", 409);

    // Guard: pool must be fully generated (collections seed uses 'completed';
    // also accept legacy 'ready' when questions already exist)
    if (pool.generation_status !== "completed" && pool.generation_status !== "ready") {
        throw new AppError("Cannot approve pool — generation is not complete", 400);
    }
    if (pool.generation_status === "ready") {
        const n = await queryOne<{ cnt: number }>(
            `SELECT count(*)::int as cnt FROM drive_pool_questions WHERE pool_id = $1`,
            [pool.id]
        );
        if (!n || n.cnt === 0) {
            throw new AppError("Cannot approve pool — generation is not complete", 400);
        }
        await query(
            `UPDATE drive_question_pool SET generation_status = 'completed' WHERE id = $1`,
            [pool.id]
        );
    }

    // Guard: there must be at least one non-duplicate question
    const activeCount = await queryOne<{ cnt: number }>(
        `SELECT count(*)::int as cnt FROM drive_pool_questions WHERE pool_id = $1 AND status != 'duplicate'`,
        [pool.id]
    );
    if (!activeCount || activeCount.cnt === 0) {
        throw new AppError("Cannot approve pool — no valid questions available", 400);
    }

    // Log audit
    await query(
        `INSERT INTO drive_pool_audit_logs (pool_id, action, actor_id, before_snapshot, after_snapshot)
         VALUES ($1, 'APPROVE_POOL', $2, $3, '{"status": "approved", "is_locked": true}')`,
        [pool.id, userId, JSON.stringify({ status: pool.status, is_locked: false })]
    );

    // Lock and approve pool — records who approved and when
    await query(
        `UPDATE drive_question_pool
         SET status = 'approved', is_locked = TRUE, approved_by = $1, approved_at = NOW()
         WHERE id = $2`,
        [userId, pool.id]
    );

    // Approve all pending/null questions (leave 'rejected' and 'duplicate' as-is)
    await query(
        `UPDATE drive_pool_questions SET status = 'approved' WHERE pool_id = $1 AND (status = 'pending' OR status IS NULL)`,
        [pool.id]
    );

    // Advance drive to APPROVED
    await query(
        `UPDATE assessment_drives SET status = 'APPROVED', updated_at = NOW() WHERE id = $1`,
        [driveId]
    );

    logger.info(`Pool approved and locked`, { driveId, approvedBy: userId, activeQuestions: activeCount.cnt });
    return getDriveById(driveId);
}

export async function rejectDrivePool(driveId: string, userId: string, reason?: string) {
    const pool = await queryOne<{ id: string; status: string; is_locked: boolean }>(
        `SELECT id, status, is_locked FROM drive_question_pool WHERE drive_id = $1`,
        [driveId]
    );

    if (!pool) throw new AppError("Pool not found", 404);
    if (pool.is_locked) throw new AppError("Cannot reject — pool is locked after approval", 409);

    // Log audit
    await query(
        `INSERT INTO drive_pool_audit_logs (pool_id, action, actor_id, before_snapshot, after_snapshot)
         VALUES ($1, 'REJECT_POOL', $2, $3, $4)`,
        [pool.id, userId, JSON.stringify({ status: pool.status }), JSON.stringify({ status: 'rejected', reason: reason || null })]
    );

    // Update pool status and store rejection reason
    await query(
        `UPDATE drive_question_pool SET status = 'rejected', rejection_reason = $1 WHERE id = $2`,
        [reason || null, pool.id]
    );

    // Roll drive back to DRAFT so admin can regenerate
    await query(
        `UPDATE assessment_drives SET status = 'DRAFT', updated_at = NOW() WHERE id = $1`,
        [driveId]
    );

    logger.info(`Pool rejected`, { driveId, rejectedBy: userId, reason });
    return getDriveById(driveId);
}

export async function updateQuestionStatus(questionId: string, status: string, userId: string) {
    const question = await queryOne<any>(
        `SELECT q.*, p.is_locked FROM drive_pool_questions q
         JOIN drive_question_pool p ON p.id = q.pool_id
         WHERE q.id = $1`,
        [questionId]
    );

    if (!question) throw new AppError("Question not found", 404);
    if (question.is_locked) throw new AppError("Cannot update question — pool is locked after approval", 409);

    await query(
        `UPDATE drive_pool_questions SET status = $1 WHERE id = $2`,
        [status, questionId]
    );

    await query(
        `INSERT INTO drive_pool_audit_logs (pool_id, target_question_id, action, actor_id, before_snapshot, after_snapshot)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [question.pool_id, questionId, `STATUS_${status.toUpperCase()}`, userId, JSON.stringify({ status: question.status }), JSON.stringify({ status })]
    );

    return true;
}

export async function editQuestion(questionId: string, updates: any, userId: string) {
    const question = await queryOne<any>(
        `SELECT q.*, p.is_locked FROM drive_pool_questions q
         JOIN drive_question_pool p ON p.id = q.pool_id
         WHERE q.id = $1`,
        [questionId]
    );

    if (!question) throw new AppError("Question not found", 404);
    if (question.is_locked) throw new AppError("Cannot edit question — pool is locked after approval", 409);

    const fields = [];
    const params = [];
    let idx = 1;

    for (const [key, value] of Object.entries(updates)) {
        if (key === 'options' || key === 'ai_metadata') {
            fields.push(`${key} = $${idx++}::jsonb`);
            params.push(JSON.stringify(value));
        } else {
            fields.push(`${key} = $${idx++}`);
            params.push(value);
        }
    }

    if (fields.length === 0) return true;

    params.push(questionId);

    await query(
        `UPDATE drive_pool_questions SET ${fields.join(', ')} WHERE id = $${idx}`,
        params
    );

    await query(
        `INSERT INTO drive_pool_audit_logs(pool_id, target_question_id, action, actor_id, before_snapshot, after_snapshot)
         VALUES($1, $2, $3, $4, $5, $6)`,
        [question.pool_id, questionId, 'EDIT_QUESTION', userId, JSON.stringify(question), JSON.stringify(updates)]
    );

    return true;
}

export async function regenerateQuestions(driveId: string, type: 'full' | 'rejected') {
    if (type === 'full') {
        const pool = await queryOne<{ id: string; is_locked: boolean }>(`SELECT id, is_locked FROM drive_question_pool WHERE drive_id = $1`, [driveId]);
        if (pool?.is_locked) throw new AppError("Cannot regenerate — pool is locked after approval", 409);
        if (pool) {
            // Delete existing questions and reset pool
            await query(`DELETE FROM drive_pool_questions WHERE pool_id = $1`, [pool.id]);
            await query(`DELETE FROM drive_question_pool WHERE id = $1`, [pool.id]);
        }
        // Re-trigger full generation (reuses the existing snapshot/version)
        return generateDrive(driveId);
    }
    return true;
}

// ── Cancel Drive ─────────────────────────────────────────────────────────────

export async function markDriveReady(driveId: string) {
    const drive = await getDriveById(driveId);
    if (!drive) throw new AppError("Drive not found", 404);

    const d = drive as any;
    const status = d.status?.toUpperCase();

    // Must be in APPROVED state (pool approved)
    if (!['APPROVED', 'POOL_APPROVED'].includes(status)) {
        throw new AppError(`Cannot mark drive as READY — current status is "${d.status}". Pool must be approved first. Please approve the AI pool by clicking on Pool Details tab.`, 400);
    }

    // Pool must be approved
    const pool = await queryOne<{ status: string; is_locked: boolean }>(
        `SELECT status, is_locked FROM drive_question_pool WHERE drive_id = $1`,
        [driveId],
    );
    if (!pool || pool.status !== 'approved') {
        throw new AppError("Cannot mark drive as READY — question pool is not approved", 400);
    }

    // Schedule must be set
    if (!d.scheduled_start) {
        throw new AppError("Cannot mark drive as READY — start date is not set. Please set a schedule in the Overview tab.", 400);
    }
    if (!d.scheduled_end) {
        throw new AppError("Cannot mark drive as READY — end date is not set. Please set a schedule in the Overview tab.", 400);
    }

    // Must have students
    if (!d.total_students || d.total_students < 1) {
        throw new AppError("Cannot mark drive as READY — no students have been added. Please assign campuses/segments in the Assignment tab.", 400);
    }

    // All preconditions met → transition to READY
    await query(
        `UPDATE assessment_drives SET status = 'READY', updated_at = NOW() WHERE id = $1`,
        [driveId],
    );

    logger.info('Drive marked as READY', { driveId, students: d.total_students });
    return getDriveById(driveId);
}

export async function cancelDrive(id: string) {
    return queryOne<DriveRow>(
        `UPDATE assessment_drives SET status = 'cancelled', updated_at = NOW() WHERE id = $1 RETURNING * `,
        [id],
    );
}

// ── Publish Drive ────────────────────────────────────────────────────────────

export async function publishDrive(id: string) {
    const published = await queryOne<DriveRow>(
        `UPDATE assessment_drives SET status = 'published', updated_at = NOW() WHERE id = $1 RETURNING * `,
        [id],
    );

    if (published) {
        // Notify created_by
        if (published.created_by) {
            await sendNotification(published.created_by, "Drive Published", `The drive "${published.name}" has been published successfully.`, "success");
        }

        // Notify all invited students
        const students = await query<{ student_id: string }>(`SELECT student_id FROM drive_students WHERE drive_id = $1`, [id]);
        for (const s of students) {
            await sendNotification(s.student_id, "New Assessment", `You have been assigned to a new assessment: ${published.name}`, "info");
        }

        // Notify campus admins of assigned colleges
        const admins = await query<{ id: string }>(`
            SELECT u.id 
            FROM users u
            JOIN drive_assignments da ON u.college_id = da.college_id
            WHERE da.drive_id = $1 AND u.role IN ('college_admin', 'college_staff', 'college')
        `, [id]);
        for (const admin of admins) {
            await sendNotification(admin.id, "Drive Published", `The drive "${published.name}" has been published and assigned to your campus.`, "info");
        }
    }

    return published;
}

// ── Auto-Transition: READY → LIVE (when NOW >= scheduled_start) ──────────────

export async function transitionDrivesToLive() {
    const candidates = await query<{ id: string; name: string; status: string; created_by: string | null }>(
        `SELECT id, name, status, created_by FROM assessment_drives
         WHERE UPPER(status) = 'SCHEDULED'
           AND scheduled_start IS NOT NULL
           AND scheduled_start <= NOW()`,
    );

    const result: typeof candidates = [];
    for (const drive of candidates) {
        try {
            // State machine guard — throws on illegal transition
            DriveStateMachine.guard({ id: drive.id, status: drive.status.toLowerCase() as any }, "active");
        } catch (err) {
            logger.warn(`Skipping drive ${drive.id} LIVE transition: ${(err as Error).message}`);
            continue;
        }
        await query(
            `UPDATE assessment_drives SET status = 'LIVE', actual_start = NOW(), updated_at = NOW() WHERE id = $1`,
            [drive.id],
        );
        DriveStateMachine.emitEvent(drive.id, "active", { driveName: drive.name });
        result.push(drive);
    }

    if (result.length > 0) {
        logger.info(`Auto-transitioned ${result.length} drive(s) to LIVE`, {
            drives: result.map((d) => d.id),
        });
        for (const drive of result) {
            if (drive.created_by) {
                await sendNotification(drive.created_by, "Drive Live", `The drive "${drive.name}" is now live and accepting participants.`, "success");
            }
            const students = await query<{ student_id: string }>(`SELECT student_id FROM drive_students WHERE drive_id = $1`, [drive.id]);
            for (const s of students) {
                await sendNotification(s.student_id, "Assessment Started", `The assessment "${drive.name}" is now live. Good luck!`, "info");
            }
        }
    }
    return result;
}

// ── Auto-Transition: LIVE → COMPLETED (when NOW >= scheduled_end) ────────────

export async function transitionDrivesToCompleted() {
    // 1. Find drives to complete
    const drivesToComplete = await query(
        `SELECT id FROM assessment_drives
         WHERE UPPER(status) = 'LIVE'
           AND scheduled_end IS NOT NULL
           AND scheduled_end <= NOW()`
    );

    // 2. For each drive, auto-submit all unfinished attempts
    const { submitExam } = await import("./examSession.service.js");
    for (const drive of drivesToComplete) {
        const unfinished = await query(
            `SELECT student_id FROM drive_students WHERE drive_id = $1 AND status = 'in_progress'`,
            [drive.id]
        );
        for (const s of unfinished) {
            try {
                await submitExam(drive.id, s.student_id);
            } catch (err) {
                logger.error(`Auto-submit failed for drive ${drive.id}, student ${s.student_id}: ${err}`);
            }
        }
    }

    // 3. Mark drives as completed
    const result = await query(
        `UPDATE assessment_drives
         SET status = 'COMPLETED', actual_end = NOW(), updated_at = NOW()
         WHERE UPPER(status) = 'LIVE'
           AND scheduled_end IS NOT NULL
           AND scheduled_end <= NOW()
         RETURNING id, name`,
    );
    if (result.length > 0) {
        logger.info(`Auto-transitioned ${result.length} drive(s) to COMPLETED`, {
            drives: result.map((d: any) => d.id),
        });
    }
    return result;
}

// ── Drive Assignments ────────────────────────────────────────────────────────

export async function getDriveAssignments(driveId: string) {
    return query(
        `SELECT da.*, c.name as college_name
     FROM drive_assignments da
     LEFT JOIN colleges c ON c.id = da.college_id
     WHERE da.drive_id = $1
     ORDER BY c.name`,
        [driveId],
    );
}


export async function addDriveAssignment(driveId: string, collegeId?: string, segment?: string) {
    // Enforce state check: only allow in DRAFT or POOL_APPROVED
    const drive = await queryOne('SELECT status FROM assessment_drives WHERE id = $1', [driveId]);
    if (!drive) throw new AppError('Drive not found', 404);
    if (!['DRAFT', 'GENERATING_POOL', 'POOL_APPROVED', 'APPROVED'].includes(drive.status?.toUpperCase())) {
        throw new AppError('Assignment configuration is only allowed in DRAFT, GENERATING_POOL, POOL_APPROVED, or APPROVED state', 403);
    }

    // Calculate potential students to be added
    let countToAdd = 0;
    if (collegeId) {
        const countQuery = `
            SELECT COUNT(u.id) as count
            FROM users u
            JOIN student_details sd ON u.id = sd.user_id
            WHERE COALESCE(u.college_id, sd.college_id) = $1 
              AND u.role = 'student'
              AND NOT EXISTS (
                  SELECT 1 FROM drive_students ds WHERE ds.drive_id = $2 AND ds.student_id = u.id
              )
              ${segment ? 'AND sd.specialization ILIKE $3' : ''}
        `;
        const countParams = segment ? [collegeId, driveId, `%${segment}%`] : [collegeId, driveId];
        const { count } = await queryOne<{ count: string | number }>(countQuery, countParams) || { count: 0 };
        countToAdd = Number(count);
    }

    // Validate (DR-03, DR-04)
    await validateRegistrationEligibility(driveId, countToAdd);

    const assignment = await queryOne(
        `INSERT INTO drive_assignments(drive_id, college_id, segment)
     VALUES($1, $2, $3)
     RETURNING * `,
        [driveId, collegeId || null, segment || null],
    );

    if (collegeId) {
        let sql = `
            INSERT INTO drive_students (drive_id, student_id, status, eligibility_status)
            SELECT $1, u.id, 'registered',
                   CASE 
                     WHEN (t.cfg->>'min_cgpa' IS NOT NULL AND (t.cfg->>'min_cgpa')::float > 0 AND (sd.cgpa IS NULL OR sd.cgpa = 0))
                       OR (t.cfg->>'min_percentage' IS NOT NULL AND (t.cfg->>'min_percentage')::float > 0 AND (sd.percentage IS NULL OR sd.percentage = 0))
                       THEN 'missing'
                     WHEN (
                         (t.cfg->>'min_cgpa' IS NULL OR (t.cfg->>'min_cgpa')::float = 0 OR sd.cgpa >= (t.cfg->>'min_cgpa')::float)
                         AND 
                         (t.cfg->>'min_percentage' IS NULL OR (t.cfg->>'min_percentage')::float = 0 OR sd.percentage >= (t.cfg->>'min_percentage')::float)
                       ) THEN 'eligible'
                     WHEN (
                         (t.cfg->>'min_cgpa' IS NOT NULL AND (t.cfg->>'min_cgpa')::float > 0 AND sd.cgpa >= (t.cfg->>'min_cgpa')::float)
                         OR 
                         (t.cfg->>'min_percentage' IS NOT NULL AND (t.cfg->>'min_percentage')::float > 0 AND sd.percentage >= (t.cfg->>'min_percentage')::float)
                       ) THEN 'partial'
                     ELSE 'ineligible'
                   END
            FROM users u
            JOIN student_details sd ON u.id = sd.user_id
            CROSS JOIN (
                SELECT snapshot->'targeting_config' as cfg
                FROM assessment_rule_versions arv
                JOIN assessment_drives d ON d.rule_version_id = arv.id
                WHERE d.id = $1
            ) t
            WHERE COALESCE(u.college_id, sd.college_id) = $2 
              AND u.role = 'student'
              AND NOT EXISTS (
                  SELECT 1 FROM drive_students ds WHERE ds.drive_id = $1 AND ds.student_id = u.id
              )
        `;
        const params: any[] = [driveId, collegeId];

        if (segment) {
            sql += ` AND sd.specialization ILIKE $3`;
            params.push(`%${segment}%`);
        }

        await query(sql, params);
        await syncDriveStudentCount(driveId);
    }

    return assignment;
}

// ── Drive Students ───────────────────────────────────────────────────────────

export async function getDriveStudents(driveId: string, filters?: { search?: string; status?: string }) {
    let sql = `
        SELECT ds.*,
               u.name as first_name, '' as last_name, u.email,
               sd.student_identifier as roll_number,
               sd.specialization as department,
               sd.placement_status,
               sd.interview_status,
               sd.is_shortlisted,
               sd.offer_released,
               c.name as college_name
        FROM drive_students ds
        LEFT JOIN users u ON u.id = ds.student_id
        LEFT JOIN student_details sd ON sd.user_id = ds.student_id
        LEFT JOIN colleges c ON c.id = COALESCE(u.college_id, sd.college_id)
        WHERE ds.drive_id = $1
    `;
    const params: any[] = [driveId];
    let idx = 2;

    if (filters?.search) {
        sql += ` AND (u.name ILIKE $${idx} OR u.email ILIKE $${idx} OR sd.student_identifier ILIKE $${idx})`;
        params.push(`%${filters.search}%`);
        idx++;
    }
    if (filters?.status && filters.status !== 'all') {
        sql += ` AND ds.status = $${idx}`;
        params.push(filters.status);
        idx++;
    }

    sql += ` ORDER BY u.name`;
    return query(sql, params);
}

export async function addDriveStudent(driveId: string, studentId: string) {
    // Enforce state check: only allow in DRAFT or POOL_APPROVED
    const drive = await queryOne('SELECT status FROM assessment_drives WHERE id = $1', [driveId]);
    if (!drive) throw new AppError('Drive not found', 404);
    if (!['DRAFT', 'GENERATING_POOL', 'POOL_APPROVED', 'APPROVED'].includes(drive.status?.toUpperCase())) {
        throw new AppError('Student mapping is only allowed in DRAFT, GENERATING_POOL, POOL_APPROVED, or APPROVED state', 403);
    }

    // Validate (DR-03, DR-04, EL-01/02)
    await validateRegistrationEligibility(driveId, 1);
    const eligibilityStatus = await validateStudentEligibility(driveId, studentId);

    const result = await queryOne(
        `INSERT INTO drive_students(drive_id, student_id, status, eligibility_status)
         VALUES($1, $2, 'INVITED', $3)
         ON CONFLICT(drive_id, student_id) DO UPDATE SET eligibility_status = EXCLUDED.eligibility_status
         RETURNING *`,
        [driveId, studentId, eligibilityStatus],
    );
    if (result) {
      await syncDriveStudentCount(driveId);

      // Send invite email + in-app notification (fire-and-forget)
      try {
        const [studentRow, driveRow] = await Promise.all([
          queryOne("SELECT name, email FROM users WHERE id = $1", [studentId]),
          queryOne("SELECT name, scheduled_at FROM assessment_drives WHERE id = $1", [driveId]),
        ]);
        if (studentRow && driveRow) {
          const s = studentRow as any;
          const d = driveRow as any;
          sendDriveInviteEmail({
            studentName: s.name, studentEmail: s.email, studentId,
            driveName: d.name, driveDate: d.scheduled_at, driveId,
          }).catch(() => {});
          sendNotification(studentId, "Drive Invite",
            `You have been invited to participate in "${d.name}". Check your portal for details.`, "info"
          ).catch(() => {});
        }
      } catch { /* don't block on notification failure */ }
    }
    return result;
}

// ── Bulk add students by campus (college_id + optional segment filter) ───────

export async function addStudentsByCampus(driveId: string, collegeId: string, segment?: string) {
    let sql = `
        INSERT INTO drive_students (drive_id, student_id, status, eligibility_status)
        SELECT $1, u.id, 'INVITED',
               CASE 
                 WHEN (t.cfg->>'min_cgpa' IS NOT NULL AND (t.cfg->>'min_cgpa')::float > 0 AND (sd.cgpa IS NULL OR sd.cgpa = 0))
                   OR (t.cfg->>'min_percentage' IS NOT NULL AND (t.cfg->>'min_percentage')::float > 0 AND (sd.percentage IS NULL OR sd.percentage = 0))
                   THEN 'missing'
                 WHEN (
                     (t.cfg->>'min_cgpa' IS NULL OR (t.cfg->>'min_cgpa')::float = 0 OR sd.cgpa >= (t.cfg->>'min_cgpa')::float)
                     AND 
                     (t.cfg->>'min_percentage' IS NULL OR (t.cfg->>'min_percentage')::float = 0 OR sd.percentage >= (t.cfg->>'min_percentage')::float)
                   ) THEN 'eligible'
                 WHEN (
                     (t.cfg->>'min_cgpa' IS NOT NULL AND (t.cfg->>'min_cgpa')::float > 0 AND sd.cgpa >= (t.cfg->>'min_cgpa')::float)
                     OR 
                     (t.cfg->>'min_percentage' IS NOT NULL AND (t.cfg->>'min_percentage')::float > 0 AND sd.percentage >= (t.cfg->>'min_percentage')::float)
                   ) THEN 'partial'
                 ELSE 'ineligible'
               END
        FROM users u
        JOIN student_details sd ON u.id = sd.user_id
        CROSS JOIN (
            SELECT snapshot->'targeting_config' as cfg
            FROM assessment_rule_versions arv
            JOIN assessment_drives d ON d.rule_version_id = arv.id
            WHERE d.id = $1
        ) t
        WHERE COALESCE(u.college_id, sd.college_id) = $2
          AND u.role = 'student'
          AND u.is_active = TRUE
          AND NOT EXISTS (
              SELECT 1 FROM drive_students ds WHERE ds.drive_id = $1 AND ds.student_id = u.id
          )
    `;
    let countSql = `
        SELECT COUNT(u.id) as count
        FROM users u
        JOIN student_details sd ON u.id = sd.user_id
        WHERE COALESCE(u.college_id, sd.college_id) = $2
          AND u.role = 'student'
          AND u.is_active = TRUE
          AND NOT EXISTS (
              SELECT 1 FROM drive_students ds WHERE ds.drive_id = $1 AND ds.student_id = u.id
          )
    `;
    const params: any[] = [driveId, collegeId];

    if (segment) {
        sql += ` AND sd.specialization ILIKE $3`;
        countSql += ` AND sd.specialization ILIKE $3`;
        params.push(`%${segment}%`);
    }

    // Validate (DR-03, DR-04)
    const { count } = await queryOne<{ count: string | number }>(countSql, params) || { count: 0 };
    await validateRegistrationEligibility(driveId, Number(count));

    const result = await query(sql, params);
    await syncDriveStudentCount(driveId);
    return { added: (result as any)?.length ?? 0 };
}

// ── Bulk add students by CSV (parsed rows with email or student_identifier) ──

export async function addStudentsByCSV(driveId: string, rows: Array<{ email?: string; student_id?: string; roll_number?: string }>) {
    let added = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Enforce state check: only allow in DRAFT or POOL_APPROVED (once per batch)
    const drive = await queryOne('SELECT status FROM assessment_drives WHERE id = $1', [driveId]);
    if (!drive) throw new AppError('Drive not found', 404);
    if (!['DRAFT', 'GENERATING_POOL', 'POOL_APPROVED', 'APPROVED'].includes(drive.status?.toUpperCase())) {
        throw new AppError('Student mapping is only allowed in DRAFT, GENERATING_POOL, POOL_APPROVED, or APPROVED state', 403);
    }

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const identifier = row.email || row.student_id || row.roll_number;
        if (!identifier) {
            errors.push(`Row ${i + 1}: missing email or student_id`);
            skipped++;
            continue;
        }

        // Look up user by email or student_identifier
        const user = await queryOne<{ id: string }>(
            `SELECT u.id FROM users u
             LEFT JOIN student_details sd ON sd.user_id = u.id
             WHERE (u.email = $1 OR sd.student_identifier = $1)
               AND u.role = 'student'
               AND u.is_active = TRUE`,
            [identifier],
        );
        if (!user) {
            errors.push(`Row ${i + 1}: student not found (${identifier})`);
            skipped++;
            continue;
        }

        try {
            await addDriveStudent(driveId, user.id);
            added++;
        } catch (err: any) {
            errors.push(`Row ${i + 1}: ${err.message}`);
            skipped++;
        }
    }

    await syncDriveStudentCount(driveId);
    return { added, skipped, errors };
}

// ── Remove a student from a drive ────────────────────────────────────────────

export async function removeDriveStudent(driveId: string, studentId: string) {
    const student = await queryOne<{ id: string; status: string }>(
        `SELECT id, status FROM drive_students WHERE drive_id = $1 AND student_id = $2`,
        [driveId, studentId]
    );
    if (!student) throw new AppError("Student not found in this drive", 404);
    if (student.status === 'started' || student.status === 'completed') {
        throw new AppError("Cannot remove a student who has started or completed the assessment", 409);
    }

    await query(`DELETE FROM drive_students WHERE drive_id = $1 AND student_id = $2`, [driveId, studentId]);
    await syncDriveStudentCount(driveId);
    return true;
}

// ── Validation Helpers ───────────────────────────────────────────────────────

/**
 * Validates if the registration/assignment is within the scheduled window 
 * and doesn't exceed the max applicants limit.
 */
async function validateRegistrationEligibility(driveId: string, studentsToAddCount: number = 1) {
    const drive = await queryOne<DriveRow>(
        `SELECT scheduled_start, scheduled_end, max_applicants, total_students, status 
         FROM assessment_drives WHERE id = $1`,
        [driveId]
    );

    if (!drive) throw new AppError('Drive not found', 404);

    // 1. Check Registration Window (DR-03)
    const now = new Date();
    if (drive.scheduled_start && now < drive.scheduled_start) {
        throw new AppError(`Registration hasn't started yet. Scheduled to start at ${drive.scheduled_start.toLocaleString()}`, 403);
    }
    if (drive.scheduled_end && now > drive.scheduled_end) {
        throw new AppError(`Registration window closed at ${drive.scheduled_end.toLocaleString()}`, 403);
    }

    // 2. Check Max Applicant Capacity (DR-04)
    const currentCount = drive.total_students || 0;
    const limit = drive.max_applicants || 500; // default to 500 if null

    if (currentCount + studentsToAddCount > limit) {
        throw new AppError(
            `Drive capacity reached. Limit: ${limit}, Current: ${currentCount}, Trying to add: ${studentsToAddCount}`,
            409
        );
    }

    return drive;
}

/**
 * Validates if a specific student meets the drive's targeting criteria (CGPA, etc.)
 * Returns: 'eligible', 'partial', 'missing', or 'ineligible'
 */
async function validateStudentEligibility(driveId: string, studentId: string): Promise<string> {
    const drive = await queryOne<{ targeting_config: any }>(
        `SELECT arv.snapshot->'targeting_config' as targeting_config
         FROM assessment_drives d
         JOIN assessment_rule_versions arv ON arv.id = d.rule_version_id
         WHERE d.id = $1`,
        [driveId]
    );

    // If config is missing or no criteria defined, skip
    const cfg = drive?.targeting_config;
    if (!cfg) return 'eligible';

    const student = await queryOne<{ cgpa: number; percentage: number }>(
        `SELECT cgpa, percentage 
         FROM student_details WHERE user_id = $1`,
        [studentId]
    );
    if (!student) return 'eligible';

    const minCgpa = Number(cfg.min_cgpa) || 0;
    const minPct = Number(cfg.min_percentage) || 0;

    let isMissing = false;
    let isFailing = false;
    let isPassing = false;
    let totalCriteria = 0;

    if (minCgpa > 0) {
        totalCriteria++;
        if (student.cgpa === null || student.cgpa === 0) isMissing = true;
        else if (student.cgpa < minCgpa) isFailing = true;
        else isPassing = true;
    }

    if (minPct > 0) {
        totalCriteria++;
        if (student.percentage === null || student.percentage === 0) isMissing = true;
        else if (student.percentage < minPct) isFailing = true;
        else isPassing = true;
    }

    if (totalCriteria === 0) return 'eligible';
    if (isMissing) return 'missing';
    if (isPassing && !isFailing) return 'eligible';
    if (isPassing && isFailing) return 'partial';
    return 'ineligible';
}

// ── Sync total_students count on assessment_drives ───────────────────────────

async function syncDriveStudentCount(driveId: string) {
    await query(
        `UPDATE assessment_drives SET total_students = (
            SELECT count(*)::int FROM drive_students WHERE drive_id = $1
         ), updated_at = NOW()
         WHERE id = $1`,
        [driveId]
    );
}

// ── Recruitment Workflow (Shortlist, Interview, Offer) ───────────────────────

export async function shortlistDriveStudent(driveId: string, studentId: string) {
    const student = await queryOne(
        `SELECT * FROM drive_students WHERE drive_id = $1 AND student_id = $2`,
        [driveId, studentId]
    );
    if (!student) throw new AppError("Student not found in this drive", 404);

    await query(
        `UPDATE student_details SET is_shortlisted = true, placement_status = 'Shortlisted' WHERE user_id = $1`,
        [studentId]
    );

    // Email + in-app notification
    try {
      const [studentRow, driveRow] = await Promise.all([
        queryOne("SELECT name, email FROM users WHERE id = $1", [studentId]),
        queryOne("SELECT name FROM assessment_drives WHERE id = $1", [driveId]),
      ]);
      if (studentRow && driveRow) {
        const s = studentRow as any;
        const d = driveRow as any;
        sendShortlistEmail({ studentName: s.name, studentEmail: s.email, studentId, driveName: d.name, driveId }).catch(() => {});
        sendNotification(studentId, "You've been Shortlisted! 🎉", `Congratulations! You have been shortlisted for "${d.name}".`, "success").catch(() => {});
      }
    } catch { /* ignore */ }

    return { student_id: studentId, status: 'Shortlisted' };
}

export async function scheduleDriveInterview(driveId: string, studentId: string, interviewDate: string) {
    const student = await queryOne(
        `SELECT * FROM drive_students WHERE drive_id = $1 AND student_id = $2`,
        [driveId, studentId]
    );
    if (!student) throw new AppError("Student not found in this drive", 404);

    await query(
        `UPDATE student_details SET interview_status = $1, placement_status = 'Interviewed' WHERE user_id = $2`,
        [`Scheduled: ${interviewDate}`, studentId]
    );

    // Email + in-app notification
    try {
      const [studentRow, driveRow] = await Promise.all([
        queryOne("SELECT name, email FROM users WHERE id = $1", [studentId]),
        queryOne("SELECT name FROM assessment_drives WHERE id = $1", [driveId]),
      ]);
      if (studentRow && driveRow) {
        const s = studentRow as any;
        const d = driveRow as any;
        sendInterviewScheduledEmail({ studentName: s.name, studentEmail: s.email, studentId, driveName: d.name, interviewDate, driveId }).catch(() => {});
        sendNotification(studentId, "Interview Scheduled 📅", `Your interview for "${d.name}" has been scheduled for ${interviewDate}.`, "info").catch(() => {});
      }
    } catch { /* ignore */ }

    return { student_id: studentId, status: 'Interview Scheduled' };
}

export async function completeDriveInterview(driveId: string, studentId: string, feedback: string, score: number) {
    const student = await queryOne(
        `SELECT * FROM drive_students WHERE drive_id = $1 AND student_id = $2`,
        [driveId, studentId]
    );
    if (!student) throw new AppError("Student not found in this drive", 404);

    await query(
        `UPDATE student_details 
         SET interview_status = $1 
         WHERE user_id = $2`,
        [`Completed - Score: ${score}, Feedback: ${feedback}`, studentId]
    );

    return { student_id: studentId, status: 'Interview Completed' };
}

export async function releaseDriveOffer(driveId: string, studentId: string) {
    const student = await queryOne(
        `SELECT * FROM drive_students WHERE drive_id = $1 AND student_id = $2`,
        [driveId, studentId]
    );
    if (!student) throw new AppError("Student not found in this drive", 404);

    await query(
        `UPDATE student_details SET offer_released = true, placement_status = 'Offered' WHERE user_id = $1`,
        [studentId]
    );

    // Email + in-app notification
    try {
      const [studentRow, driveRow] = await Promise.all([
        queryOne("SELECT name, email FROM users WHERE id = $1", [studentId]),
        queryOne("SELECT name FROM assessment_drives WHERE id = $1", [driveId]),
      ]);
      if (studentRow && driveRow) {
        const s = studentRow as any;
        const d = driveRow as any;
        sendOfferEmail({ studentName: s.name, studentEmail: s.email, studentId, driveName: d.name, driveId }).catch(() => {});
        sendNotification(studentId, "Offer Released! 🎊", `Congratulations! An offer has been released for you from "${d.name}".`, "success").catch(() => {});
      }
    } catch { /* ignore */ }

    return { student_id: studentId, status: 'Offer Released' };
}

// ── Mock Question Bank (used when GROQ_API_KEY is not set, or as a fallback after repeated AI failures) ─────────────────

interface MockTemplate {
    textFn: (idx: number) => string;
    optionsFn: (idx: number) => Record<string, string>;
    correct: string;
}

function pickWeighted(weights: { category: string; percentage: number }[]): { category: string; percentage: number } {
    const total = weights.reduce((s, w) => s + w.percentage, 0);
    let r = Math.random() * total;
    for (const w of weights) {
        r -= w.percentage;
        if (r <= 0) return w;
    }
    return weights[weights.length - 1];
}

function buildMockQuestionBank(): Record<string, MockTemplate[]> {
    // Large template bank — each template uses the index to generate unique variations
    // so we can produce hundreds of distinct questions from a small set of templates

    const mathTemplates: MockTemplate[] = [
        {
            textFn: (i) => `What is ${2 + i} + ${3 + (i % 50)}?`,
            optionsFn: (i) => ({ a: `${4 + i}`, b: `${5 + i + (i % 50)}`, c: `${6 + i}`, d: `${3 + i}` }),
            correct: 'b',
        },
        {
            textFn: (i) => `Solve for x: ${2 + (i % 20)}x = ${(2 + (i % 20)) * (3 + (i % 15))}`,
            optionsFn: (i) => {
                const ans = 3 + (i % 15);
                return { a: `${ans - 1}`, b: `${ans}`, c: `${ans + 1}`, d: `${ans + 2}` };
            },
            correct: 'b',
        },
        {
            textFn: (i) => `What is ${(i % 30) + 5} × ${(i % 20) + 2}?`,
            optionsFn: (i) => {
                const ans = ((i % 30) + 5) * ((i % 20) + 2);
                return { a: `${ans - 10}`, b: `${ans + 5}`, c: `${ans}`, d: `${ans - 3}` };
            },
            correct: 'c',
        },
        {
            textFn: (i) => `If y = ${i % 10 + 2}x + ${i % 7}, find y when x = ${i % 5 + 1}`,
            optionsFn: (i) => {
                const m = i % 10 + 2; const b = i % 7; const x = i % 5 + 1;
                const ans = m * x + b;
                return { a: `${ans}`, b: `${ans + 2}`, c: `${ans - 1}`, d: `${ans + 5}` };
            },
            correct: 'a',
        },
        {
            textFn: (i) => `What is the square root of ${((i % 25) + 1) * ((i % 25) + 1)}?`,
            optionsFn: (i) => {
                const ans = (i % 25) + 1;
                return { a: `${ans + 1}`, b: `${ans - 1}`, c: `${ans}`, d: `${ans * 2}` };
            },
            correct: 'c',
        },
        {
            textFn: (i) => `What is ${100 + i * 3} ÷ ${(i % 10) + 2}? (Round to nearest integer)`,
            optionsFn: (i) => {
                const ans = Math.round((100 + i * 3) / ((i % 10) + 2));
                return { a: `${ans + 1}`, b: `${ans - 1}`, c: `${ans + 3}`, d: `${ans}` };
            },
            correct: 'd',
        },
        {
            textFn: (i) => `Find the value of ${i % 12 + 2}² - ${i % 8 + 1}²`,
            optionsFn: (i) => {
                const a = i % 12 + 2; const b = i % 8 + 1;
                const ans = a * a - b * b;
                return { a: `${ans}`, b: `${ans + 4}`, c: `${ans - 2}`, d: `${ans + 1}` };
            },
            correct: 'a',
        },
        {
            textFn: (i) => `What is the GCD of ${(i % 20 + 2) * 6} and ${(i % 20 + 2) * 4}?`,
            optionsFn: (i) => {
                const base = (i % 20 + 2) * 2;
                return { a: `${base}`, b: `${base / 2}`, c: `${base * 2}`, d: `${base + 2}` };
            },
            correct: 'a',
        },
    ];

    const scienceTemplates: MockTemplate[] = [
        {
            textFn: (i) => {
                const elements = ['Hydrogen', 'Helium', 'Lithium', 'Beryllium', 'Boron', 'Carbon', 'Nitrogen', 'Oxygen', 'Fluorine', 'Neon',
                    'Sodium', 'Magnesium', 'Aluminum', 'Silicon', 'Phosphorus', 'Sulfur', 'Chlorine', 'Argon', 'Potassium', 'Calcium'];
                return `What is the atomic number of ${elements[i % elements.length]}?`;
            },
            optionsFn: (i) => {
                const ans = (i % 20) + 1;
                return { a: `${ans}`, b: `${ans + 1}`, c: `${ans + 2}`, d: `${ans - 1 || 21}` };
            },
            correct: 'a',
        },
        {
            textFn: (i) => {
                const topics = ['photosynthesis', 'mitosis', 'osmosis', 'gravity', 'magnetism', 'electrolysis', 'condensation', 'evaporation',
                    'oxidation', 'reduction', 'diffusion', 'refraction', 'reflection', 'absorption', 'friction'];
                return `Which of the following best describes ${topics[i % topics.length]}?`;
            },
            optionsFn: () => ({ a: 'A chemical reaction requiring heat', b: 'A physical process involving energy transfer', c: 'A biological mechanism in cells', d: 'A natural phenomenon involving forces' }),
            correct: 'b',
        },
        {
            textFn: (i) => {
                const units = ['Newton', 'Joule', 'Watt', 'Pascal', 'Hertz', 'Ohm', 'Volt', 'Ampere', 'Coulomb', 'Tesla'];
                const measures = ['force', 'energy', 'power', 'pressure', 'frequency', 'resistance', 'voltage', 'current', 'charge', 'magnetic flux density'];
                const idx = i % units.length;
                return `The SI unit of ${measures[idx]} is the ____?`;
            },
            optionsFn: (i) => {
                const units = ['Newton', 'Joule', 'Watt', 'Pascal', 'Hertz', 'Ohm', 'Volt', 'Ampere', 'Coulomb', 'Tesla'];
                const idx = i % units.length;
                return { a: units[idx], b: units[(idx + 1) % units.length], c: units[(idx + 3) % units.length], d: units[(idx + 5) % units.length] };
            },
            correct: 'a',
        },
        {
            textFn: (i) => {
                const planets = ['Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'];
                return `Which planet is ${(i % planets.length) + 1}${['st', 'nd', 'rd', 'th', 'th', 'th', 'th', 'th'][(i % planets.length)]} from the Sun?`;
            },
            optionsFn: (i) => {
                const planets = ['Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'];
                const idx = i % planets.length;
                return { a: planets[(idx + 1) % planets.length], b: planets[idx], c: planets[(idx + 2) % planets.length], d: planets[(idx + 3) % planets.length] };
            },
            correct: 'b',
        },
    ];

    const reasoningTemplates: MockTemplate[] = [
        {
            textFn: (i) => `What comes next in the sequence: ${i + 2}, ${i + 5}, ${i + 8}, ${i + 11}, ?`,
            optionsFn: (i) => ({ a: `${i + 13}`, b: `${i + 14}`, c: `${i + 15}`, d: `${i + 12}` }),
            correct: 'b',
        },
        {
            textFn: (i) => {
                const a = (i % 10) + 1; const b = (i % 7) + 2;
                return `If A = ${a} and B = ${b}, what is 2A + 3B?`;
            },
            optionsFn: (i) => {
                const a = (i % 10) + 1; const b = (i % 7) + 2;
                const ans = 2 * a + 3 * b;
                return { a: `${ans + 1}`, b: `${ans - 2}`, c: `${ans}`, d: `${ans + 3}` };
            },
            correct: 'c',
        },
        {
            textFn: (i) => {
                const words = ['LISTEN', 'SILENT', 'TRIANGLE', 'INTEGRAL', 'DORMITORY', 'DIRTYROOM', 'ASTRONOMER', 'MOONSTAR'];
                return `Which word is an anagram of "${words[(i * 2) % words.length]}"?`;
            },
            optionsFn: (i) => {
                const words = ['LISTEN', 'SILENT', 'TRIANGLE', 'INTEGRAL', 'DORMITORY', 'DIRTYROOM', 'ASTRONOMER', 'MOONSTAR'];
                const idx = (i * 2) % words.length;
                return { a: 'NONE', b: words[(idx + 1) % words.length], c: 'RANDOM', d: 'UNCLEAR' };
            },
            correct: 'b',
        },
        {
            textFn: (i) => `In a group of ${20 + i % 30} people, ${10 + i % 15} like tea and ${8 + i % 12} like coffee. If ${5 + i % 8} like both, how many like neither?`,
            optionsFn: (i) => {
                const total = 20 + i % 30; const tea = 10 + i % 15; const coffee = 8 + i % 12; const both = 5 + i % 8;
                const ans = total - (tea + coffee - both);
                return { a: `${ans}`, b: `${ans + 2}`, c: `${ans - 1}`, d: `${ans + 1}` };
            },
            correct: 'a',
        },
        {
            textFn: (i) => {
                const base = (i % 15) + 3;
                return `If the pattern is ${base}, ${base * 2}, ${base * 4}, ${base * 8}, what is the next number?`;
            },
            optionsFn: (i) => {
                const base = (i % 15) + 3;
                const ans = base * 16;
                return { a: `${ans - base}`, b: `${ans + base}`, c: `${ans}`, d: `${base * 12}` };
            },
            correct: 'c',
        },
    ];

    const geographyTemplates: MockTemplate[] = [
        {
            textFn: (i) => {
                const countries = ['France', 'Japan', 'Australia', 'Brazil', 'Canada', 'India', 'Germany', 'Italy', 'Mexico', 'Egypt',
                    'China', 'Russia', 'Spain', 'Thailand', 'Argentina', 'Kenya', 'Sweden', 'Portugal', 'Turkey', 'Poland'];
                const capitals = ['Paris', 'Tokyo', 'Canberra', 'Brasilia', 'Ottawa', 'New Delhi', 'Berlin', 'Rome', 'Mexico City', 'Cairo',
                    'Beijing', 'Moscow', 'Madrid', 'Bangkok', 'Buenos Aires', 'Nairobi', 'Stockholm', 'Lisbon', 'Ankara', 'Warsaw'];
                const idx = i % countries.length;
                return `What is the capital of ${countries[idx]}?`;
            },
            optionsFn: (i) => {
                const capitals = ['Paris', 'Tokyo', 'Canberra', 'Brasilia', 'Ottawa', 'New Delhi', 'Berlin', 'Rome', 'Mexico City', 'Cairo',
                    'Beijing', 'Moscow', 'Madrid', 'Bangkok', 'Buenos Aires', 'Nairobi', 'Stockholm', 'Lisbon', 'Ankara', 'Warsaw'];
                const idx = i % capitals.length;
                return { a: capitals[idx], b: capitals[(idx + 3) % capitals.length], c: capitals[(idx + 7) % capitals.length], d: capitals[(idx + 11) % capitals.length] };
            },
            correct: 'a',
        },
        {
            textFn: (i) => {
                const rivers = ['Nile', 'Amazon', 'Yangtze', 'Mississippi', 'Danube', 'Ganges', 'Mekong', 'Rhine', 'Congo', 'Volga'];
                const continents = ['Africa', 'South America', 'Asia', 'North America', 'Europe', 'Asia', 'Asia', 'Europe', 'Africa', 'Europe'];
                const idx = i % rivers.length;
                return `The ${rivers[idx]} river is primarily located in which continent?`;
            },
            optionsFn: (i) => {
                const continents = ['Africa', 'South America', 'Asia', 'North America', 'Europe', 'Oceania'];
                const idx = i % continents.length;
                return { a: continents[idx], b: continents[(idx + 1) % continents.length], c: continents[(idx + 2) % continents.length], d: continents[(idx + 3) % continents.length] };
            },
            correct: 'a',
        },
    ];

    const programmingTemplates: MockTemplate[] = [
        {
            textFn: (i) => {
                const concepts = ['closure', 'hoisting', 'prototype chain', 'event loop', 'callback', 'promise', 'async/await', 'scope',
                    'recursion', 'memoization', 'currying', 'destructuring', 'spread operator', 'rest parameters', 'template literals'];
                return `What is a ${concepts[i % concepts.length]} in JavaScript?`;
            },
            optionsFn: () => ({ a: 'A design pattern', b: 'A language feature for managing execution context', c: 'A data structure', d: 'A DOM manipulation method' }),
            correct: 'b',
        },
        {
            textFn: (i) => {
                const types = ['Array', 'Object', 'Map', 'Set', 'WeakMap', 'WeakSet', 'LinkedList', 'Stack', 'Queue', 'Tree', 'Graph', 'HashTable'];
                return `What is the average time complexity of lookup in a ${types[i % types.length]}?`;
            },
            optionsFn: () => ({ a: 'O(1)', b: 'O(log n)', c: 'O(n)', d: 'O(n²)' }),
            correct: 'a',
        },
        {
            textFn: (i) => {
                const algos = ['bubble sort', 'merge sort', 'quick sort', 'binary search', 'linear search', 'BFS', 'DFS', 'Dijkstra\'s algorithm',
                    'dynamic programming', 'greedy algorithm', 'divide and conquer', 'insertion sort', 'selection sort', 'heap sort', 'radix sort'];
                return `What is the time complexity of ${algos[i % algos.length]} in the average case?`;
            },
            optionsFn: () => ({ a: 'O(n log n)', b: 'O(n²)', c: 'O(n)', d: 'O(log n)' }),
            correct: 'a',
        },
        {
            textFn: (i) => {
                const keywords = ['class', 'interface', 'abstract', 'static', 'final', 'override', 'virtual', 'const', 'let', 'var',
                    'yield', 'async', 'await', 'import', 'export'];
                return `What is the purpose of the "${keywords[i % keywords.length]}" keyword in TypeScript?`;
            },
            optionsFn: () => ({ a: 'Type assertion', b: 'Variable declaration and scoping control', c: 'Error handling', d: 'Memory management' }),
            correct: 'b',
        },
    ];

    const literatureTemplates: MockTemplate[] = [
        {
            textFn: (i) => {
                const works = ['Hamlet', 'Macbeth', 'Othello', '1984', 'Brave New World', 'The Great Gatsby', 'Pride and Prejudice',
                    'To Kill a Mockingbird', 'The Catcher in the Rye', 'Lord of the Flies', 'Animal Farm', 'Jane Eyre',
                    'Wuthering Heights', 'Great Expectations', 'Oliver Twist'];
                const authors = ['Shakespeare', 'Shakespeare', 'Shakespeare', 'Orwell', 'Huxley', 'Fitzgerald', 'Austen',
                    'Harper Lee', 'Salinger', 'Golding', 'Orwell', 'Charlotte Brontë',
                    'Emily Brontë', 'Dickens', 'Dickens'];
                const idx = i % works.length;
                return `Who wrote "${works[idx]}"?`;
            },
            optionsFn: (i) => {
                const allAuthors = ['Shakespeare', 'Orwell', 'Huxley', 'Fitzgerald', 'Austen', 'Harper Lee', 'Salinger', 'Golding', 'Dickens', 'Charlotte Brontë'];
                const idx = i % allAuthors.length;
                return { a: allAuthors[idx], b: allAuthors[(idx + 2) % allAuthors.length], c: allAuthors[(idx + 5) % allAuthors.length], d: allAuthors[(idx + 7) % allAuthors.length] };
            },
            correct: 'a',
        },
    ];

    // Map all categories — unknown categories fall back to "General" which mixes everything
    const generalTemplates = [...mathTemplates, ...scienceTemplates, ...reasoningTemplates, ...geographyTemplates, ...programmingTemplates, ...literatureTemplates];

    return {
        'Math': mathTemplates,
        'Maths': mathTemplates,
        'Mathematics': mathTemplates,
        'Aptitude': [...mathTemplates, ...reasoningTemplates],
        'Reasoning': reasoningTemplates,
        'Logical Reasoning': reasoningTemplates,
        'Science': scienceTemplates,
        'Physics': scienceTemplates,
        'Chemistry': scienceTemplates,
        'Biology': scienceTemplates,
        'Geography': geographyTemplates,
        'Programming': programmingTemplates,
        'Coding': programmingTemplates,
        'DSA': programmingTemplates,
        'Data Structures': programmingTemplates,
        'JavaScript': programmingTemplates,
        'Python': programmingTemplates,
        'TypeScript': programmingTemplates,
        'Java': programmingTemplates,
        'Literature': literatureTemplates,
        'English': literatureTemplates,
        'General': generalTemplates,
    };
}
