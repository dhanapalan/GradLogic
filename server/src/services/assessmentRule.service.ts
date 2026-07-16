import { query, queryOne } from "../config/database.js";

// ── Types ────────────────────────────────────────────────────────────────────

/** Hub-only blueprint fields (Assessment Templates). */
export type HubTemplateConfig = {
    assessment_type?:
        | "practice"
        | "mock_test"
        | "coding_assessment"
        | "weekly_test"
        | "placement_test";
    placement_domain?: string;
    difficulty?: "easy" | "medium" | "hard" | "mixed";
    tags?: string[];
    instructions?: string;
    shuffle_questions?: boolean;
    shuffle_options?: boolean;
    sections?: Array<{
        section_name: string;
        collection_id: string;
        time_limit_minutes?: number | null;
    }>;
};

export interface RuleRow {
    id: string;
    name: string;
    description: string | null;
    target_role: string | null;
    duration_minutes: number;
    total_questions: number;
    total_marks: number;
    negative_marking_enabled: boolean;
    negative_marking_value: number | null;
    sectional_cutoff: any;
    overall_cutoff: number | null;
    skill_distribution: any;
    difficulty_distribution: any;
    proctoring_mode: string;
    proctoring_config: any;
    pool_generation_config: any;
    targeting_config: any;
    hub_template_config?: HubTemplateConfig | null;
    status: string;
    version: number;
    created_by: string | null;
    created_at: Date;
    updated_at: Date;
}

export interface CreateRuleInput {
    name: string;
    description?: string;
    target_role?: string;
    duration_minutes?: number;
    total_questions?: number;
    total_marks?: number;
    negative_marking_enabled?: boolean;
    negative_marking_value?: number;
    sectional_cutoff?: any;
    overall_cutoff?: number;
    skill_distribution?: any;
    difficulty_distribution?: any;
    proctoring_mode?: string;
    proctoring_config?: any;
    pool_generation_config?: any;
    targeting_config?: any;
    hub_template_config?: HubTemplateConfig;
    status?: string;
    created_by?: string;
}

// ── List Rules ───────────────────────────────────────────────────────────────

export async function listRules(filters?: { status?: string; skill?: string }) {
    let sql = `SELECT * FROM assessment_rule_templates`;
    const params: any[] = [];
    const conditions: string[] = [];

    if (filters?.status && filters.status !== "all") {
        conditions.push(`status = $${params.length + 1}`);
        params.push(filters.status);
    }

    if (conditions.length > 0) {
        sql += ` WHERE ` + conditions.join(" AND ");
    }

    sql += ` ORDER BY updated_at DESC`;
    return query<RuleRow>(sql, params);
}

// ── Get Rule by ID ───────────────────────────────────────────────────────────

export async function getRuleById(id: string) {
    return queryOne<RuleRow>(
        `SELECT * FROM assessment_rule_templates WHERE id = $1`,
        [id],
    );
}

// ── Create Rule ──────────────────────────────────────────────────────────────

export async function createRule(input: CreateRuleInput) {
    const values = [
        input.name,
        input.description || null,
        input.target_role || null,
        input.duration_minutes || 60,
        input.total_questions || 30,
        input.total_marks || 100,
        input.negative_marking_enabled || false,
        input.negative_marking_value || null,
        input.sectional_cutoff ? JSON.stringify(input.sectional_cutoff) : null,
        input.overall_cutoff || null,
        JSON.stringify(input.skill_distribution || {}),
        JSON.stringify(input.difficulty_distribution || {}),
        input.proctoring_mode || "moderate",
        input.proctoring_config ? JSON.stringify(input.proctoring_config) : null,
        input.pool_generation_config ? JSON.stringify(input.pool_generation_config) : null,
        input.targeting_config ? JSON.stringify(input.targeting_config) : null,
        JSON.stringify(input.hub_template_config || {}),
        input.status || "draft",
        input.created_by || null,
    ];

    try {
        return await queryOne<RuleRow>(
            `INSERT INTO assessment_rule_templates
           (name, description, target_role, duration_minutes, total_questions, total_marks,
            negative_marking_enabled, negative_marking_value, sectional_cutoff, overall_cutoff,
            skill_distribution, difficulty_distribution, proctoring_mode, proctoring_config,
            pool_generation_config, targeting_config, hub_template_config, status, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
         RETURNING *`,
            values
        );
    } catch {
        // Pre-migration DBs without hub_template_config
        return queryOne<RuleRow>(
            `INSERT INTO assessment_rule_templates
           (name, description, target_role, duration_minutes, total_questions, total_marks,
            negative_marking_enabled, negative_marking_value, sectional_cutoff, overall_cutoff,
            skill_distribution, difficulty_distribution, proctoring_mode, proctoring_config,
            pool_generation_config, targeting_config, status, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
         RETURNING *`,
            [
                values[0],
                values[1],
                values[2],
                values[3],
                values[4],
                values[5],
                values[6],
                values[7],
                values[8],
                values[9],
                values[10],
                values[11],
                values[12],
                values[13],
                values[14],
                values[15],
                values[17],
                values[18],
            ]
        );
    }
}

// ── Update Rule ──────────────────────────────────────────────────────────────

export async function updateRule(id: string, input: Partial<CreateRuleInput>) {
    const current = await getRuleById(id);
    if (!current) throw new Error("Assessment rule not found");

    // AR-03: If modifying an 'active' rule, create a snapshot of the current state first
    if (current.status === 'active') {
        const configFields: (keyof CreateRuleInput)[] = [
            "name", "description", "target_role", "duration_minutes", "total_questions",
            "total_marks", "negative_marking_enabled", "negative_marking_value",
            "sectional_cutoff", "overall_cutoff", "skill_distribution", "difficulty_distribution",
            "proctoring_mode", "proctoring_config", "pool_generation_config", "targeting_config",
            "hub_template_config",
        ];

        const hasConfigChange = configFields.some(f => input[f] !== undefined);

        // Only version if configuration changes (not just status change to archived)
        if (hasConfigChange) {
            await createVersion(id, "Automatic version created before modification of active rule", current.created_by || undefined);
        }
    }

    // Build dynamic SET clause
    const fields: string[] = [];
    const params: any[] = [];
    let idx = 1;

    const simpleFields: (keyof CreateRuleInput)[] = [
        "name", "description", "target_role", "duration_minutes", "total_questions",
        "total_marks", "negative_marking_enabled", "negative_marking_value",
        "overall_cutoff", "proctoring_mode", "status",
    ];

    for (const f of simpleFields) {
        if (input[f] !== undefined) {
            fields.push(`${f} = $${idx++}`);
            params.push(input[f]);
        }
    }

    const jsonFields: (keyof CreateRuleInput)[] = [
        "sectional_cutoff", "skill_distribution", "difficulty_distribution",
        "proctoring_config", "pool_generation_config", "targeting_config",
        "hub_template_config",
    ];

    for (const f of jsonFields) {
        if (input[f] !== undefined) {
            fields.push(`${f} = $${idx++}`);
            params.push(JSON.stringify(input[f]));
        }
    }

    if (fields.length === 0) return getRuleById(id);

    fields.push(`updated_at = NOW()`);
    params.push(id);

    return queryOne<RuleRow>(
        `UPDATE assessment_rule_templates SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
        params,
    );
}

// ── Clone Rule ───────────────────────────────────────────────────────────────

export async function cloneRule(id: string, createdBy?: string) {
    const original = await getRuleById(id);
    if (!original) return null;

    return createRule({
        name: `${original.name} (Copy)`,
        description: original.description || undefined,
        target_role: original.target_role || undefined,
        duration_minutes: original.duration_minutes,
        total_questions: original.total_questions,
        total_marks: original.total_marks,
        negative_marking_enabled: original.negative_marking_enabled,
        negative_marking_value: original.negative_marking_value || undefined,
        sectional_cutoff: original.sectional_cutoff,
        overall_cutoff: original.overall_cutoff || undefined,
        skill_distribution: original.skill_distribution,
        difficulty_distribution: original.difficulty_distribution,
        proctoring_mode: original.proctoring_mode,
        proctoring_config: original.proctoring_config,
        pool_generation_config: original.pool_generation_config,
        targeting_config: original.targeting_config,
        hub_template_config:
            (original.hub_template_config as HubTemplateConfig) || undefined,
        status: "draft",
        created_by: createdBy,
    });
}

// ── Archive Rule ─────────────────────────────────────────────────────────────

export async function archiveRule(id: string) {
    return queryOne<RuleRow>(
        `UPDATE assessment_rule_templates SET status = 'archived', updated_at = NOW() WHERE id = $1 RETURNING *`,
        [id],
    );
}

/** Placement Preparation Phase 1 rule blueprints (idempotent by name). Status set at seed time. */
const PHASE1_TEMPLATE_SEEDS: CreateRuleInput[] = [
    {
        name: "Aptitude — Placement Prep",
        description: "Phase 1 Placement Preparation · Aptitude (quantitative).",
        target_role: "campus_placement",
        duration_minutes: 45,
        total_questions: 30,
        total_marks: 30,
        negative_marking_enabled: true,
        negative_marking_value: 0.25,
        overall_cutoff: 40,
        skill_distribution: { aptitude: 100 },
        difficulty_distribution: { easy: 40, medium: 40, hard: 20 },
        proctoring_mode: "standard",
        targeting_config: {
            track: "placement_preparation",
            phase1_domain: "aptitude",
            bank_category: "aptitude",
        },
        hub_template_config: {
            assessment_type: "placement_test",
            placement_domain: "aptitude",
            difficulty: "mixed",
            tags: ["placement", "aptitude"],
            instructions: "Attempt all aptitude questions within the time limit.",
            shuffle_questions: true,
            shuffle_options: false,
            sections: [],
        },
    },
    {
        name: "Logical Reasoning — Placement Prep",
        description: "Phase 1 Placement Preparation · Logical Reasoning.",
        target_role: "campus_placement",
        duration_minutes: 40,
        total_questions: 25,
        total_marks: 25,
        negative_marking_enabled: true,
        negative_marking_value: 0.25,
        overall_cutoff: 40,
        skill_distribution: { reasoning: 100 },
        difficulty_distribution: { easy: 35, medium: 45, hard: 20 },
        proctoring_mode: "standard",
        targeting_config: {
            track: "placement_preparation",
            phase1_domain: "reasoning",
            bank_category: "reasoning",
        },
        hub_template_config: {
            assessment_type: "placement_test",
            placement_domain: "reasoning",
            difficulty: "mixed",
            tags: ["placement", "reasoning"],
            instructions: "Attempt all reasoning questions within the time limit.",
            shuffle_questions: true,
            shuffle_options: false,
            sections: [],
        },
    },
    {
        name: "Python — Placement Prep",
        description: "Phase 1 Placement Preparation · Python coding & MCQ mix.",
        target_role: "campus_placement",
        duration_minutes: 60,
        total_questions: 20,
        total_marks: 40,
        negative_marking_enabled: false,
        overall_cutoff: 40,
        skill_distribution: { python_coding: 100 },
        difficulty_distribution: { easy: 30, medium: 50, hard: 20 },
        proctoring_mode: "standard",
        targeting_config: {
            track: "placement_preparation",
            phase1_domain: "python_coding",
            bank_category: "python_coding",
        },
        hub_template_config: {
            assessment_type: "coding_assessment",
            placement_domain: "python_coding",
            difficulty: "mixed",
            tags: ["placement", "python"],
            instructions: "Complete Python coding and MCQ items within the time limit.",
            shuffle_questions: true,
            shuffle_options: false,
            sections: [],
        },
    },
    {
        name: "Java — Placement Prep",
        description: "Phase 1 Placement Preparation · Java coding & MCQ mix.",
        target_role: "campus_placement",
        duration_minutes: 60,
        total_questions: 20,
        total_marks: 40,
        negative_marking_enabled: false,
        overall_cutoff: 40,
        skill_distribution: { java_coding: 100 },
        difficulty_distribution: { easy: 30, medium: 50, hard: 20 },
        proctoring_mode: "standard",
        targeting_config: {
            track: "placement_preparation",
            phase1_domain: "java_coding",
            bank_category: "java_coding",
        },
        hub_template_config: {
            assessment_type: "coding_assessment",
            placement_domain: "java_coding",
            difficulty: "mixed",
            tags: ["placement", "java"],
            instructions: "Complete Java coding and MCQ items within the time limit.",
            shuffle_questions: true,
            shuffle_options: false,
            sections: [],
        },
    },
    {
        name: "AI Fundamentals — Placement Prep",
        description: "Phase 1 Placement Preparation · AI Fundamentals (bank: data_science).",
        target_role: "campus_placement",
        duration_minutes: 45,
        total_questions: 25,
        total_marks: 25,
        negative_marking_enabled: false,
        overall_cutoff: 40,
        skill_distribution: { data_science: 100 },
        difficulty_distribution: { easy: 40, medium: 40, hard: 20 },
        proctoring_mode: "standard",
        targeting_config: {
            track: "placement_preparation",
            phase1_domain: "ai_fundamentals",
            bank_category: "data_science",
        },
        hub_template_config: {
            assessment_type: "placement_test",
            placement_domain: "ai_fundamentals",
            difficulty: "mixed",
            tags: ["placement", "ai"],
            instructions: "Attempt all AI Fundamentals questions within the time limit.",
            shuffle_questions: true,
            shuffle_options: false,
            sections: [],
        },
    },
    {
        name: "Campus Placement Combined — Placement Prep",
        description:
            "Phase 1 multi-domain campus simulation: Aptitude + Reasoning + Python/Java/AI mix.",
        target_role: "campus_placement",
        duration_minutes: 90,
        total_questions: 50,
        total_marks: 50,
        negative_marking_enabled: true,
        negative_marking_value: 0.25,
        overall_cutoff: 40,
        skill_distribution: {
            aptitude: 30,
            reasoning: 25,
            python_coding: 15,
            java_coding: 15,
            data_science: 15,
        },
        difficulty_distribution: { easy: 30, medium: 50, hard: 20 },
        proctoring_mode: "standard",
        targeting_config: {
            track: "placement_preparation",
            phase1_domain: "campus_combined",
            bank_category: null,
        },
        hub_template_config: {
            assessment_type: "placement_test",
            placement_domain: "aptitude",
            difficulty: "mixed",
            tags: ["placement", "combined"],
            instructions: "Campus placement simulation across Phase-1 domains.",
            shuffle_questions: true,
            shuffle_options: false,
            sections: [],
        },
    },
];

const PHASE1_COLLECTION_CATEGORIES = [
    "aptitude",
    "reasoning",
    "python_coding",
    "java_coding",
    "data_science",
] as const;

type CollectionPick = { id: string; name: string; category: string };

async function loadPhase1CollectionsByCategory(): Promise<Map<string, CollectionPick>> {
    const rows = await query<CollectionPick>(
        `SELECT DISTINCT ON (category) id, name, category
         FROM question_collections
         WHERE category = ANY($1::text[])
         ORDER BY category, updated_at DESC`,
        [PHASE1_COLLECTION_CATEGORIES as unknown as string[]],
    );
    const map = new Map<string, CollectionPick>();
    for (const row of rows || []) {
        if (row.category) map.set(row.category, row);
    }
    return map;
}

function sectionsForSeed(
    seed: CreateRuleInput,
    byCategory: Map<string, CollectionPick>,
): NonNullable<HubTemplateConfig["sections"]> {
    const tc = (seed.targeting_config || {}) as {
        phase1_domain?: string;
        bank_category?: string | null;
    };
    if (tc.phase1_domain === "campus_combined") {
        return PHASE1_COLLECTION_CATEGORIES.map((cat) => {
            const col = byCategory.get(cat);
            if (!col) return null;
            return {
                section_name: col.name,
                collection_id: col.id,
                time_limit_minutes: null,
            };
        }).filter(Boolean) as NonNullable<HubTemplateConfig["sections"]>;
    }
    const category = tc.bank_category || undefined;
    if (!category) return [];
    const col = byCategory.get(category);
    if (!col) return [];
    return [
        {
            section_name: col.name,
            collection_id: col.id,
            time_limit_minutes: null,
        },
    ];
}

function hubSectionsCount(hub: HubTemplateConfig | null | undefined): number {
    return (hub?.sections || []).filter((s) => !!s.collection_id).length;
}

/**
 * Idempotent Phase-1 Assessment Templates seed.
 * Auto-binds matching Question Collections by category when present;
 * only publishes when ≥1 section is bound — otherwise draft.
 * Also repairs existing Phase-1 templates that were published with empty sections.
 */
export async function seedPhase1PlacementTemplates(createdBy?: string) {
    const byCategory = await loadPhase1CollectionsByCategory();
    const created: string[] = [];
    let repaired = 0;

    for (const seed of PHASE1_TEMPLATE_SEEDS) {
        const sections = sectionsForSeed(seed, byCategory);
        const status = sections.length > 0 ? "published" : "draft";
        const hub: HubTemplateConfig = {
            ...(seed.hub_template_config || {}),
            sections,
        };

        const existing = await queryOne<RuleRow>(
            `SELECT * FROM assessment_rule_templates WHERE name = $1 LIMIT 1`,
            [seed.name],
        );

        if (existing) {
            const existingHub = (existing.hub_template_config || {}) as HubTemplateConfig;
            if (hubSectionsCount(existingHub) === 0 && sections.length > 0) {
                await updateRule(existing.id, {
                    hub_template_config: {
                        ...existingHub,
                        ...hub,
                        sections,
                    },
                    status:
                        existing.status === "archived"
                            ? "archived"
                            : "published",
                });
                repaired += 1;
            } else if (
                existing.status === "published" &&
                hubSectionsCount(existingHub) === 0 &&
                sections.length === 0
            ) {
                // Unusable published seed — demote to draft until collections exist
                await updateRule(existing.id, { status: "draft" });
                repaired += 1;
            }
            continue;
        }

        const row = await createRule({
            ...seed,
            hub_template_config: hub,
            status,
            created_by: createdBy,
        });
        if (row?.id) created.push(row.id);
    }

    return { created_count: created.length, created_ids: created, repaired_count: repaired };
}

export function isPlacementPrepTemplate(rule: RuleRow): boolean {
    const tc = rule.targeting_config as { track?: string } | null;
    if (tc && typeof tc === "object" && tc.track === "placement_preparation") return true;
    return /placement prep/i.test(rule.name || "");
}

// ── Versioning ───────────────────────────────────────────────────────────────

export async function createVersion(ruleId: string, changeNotes?: string, createdBy?: string) {
    const rule = await getRuleById(ruleId);
    if (!rule) return null;

    // Use current rule version for the snapshot
    const snapshotVersion = rule.version || 1;
    const nextVersion = snapshotVersion + 1;

    // Create snapshot
    const snapshot = { ...rule };

    const version = await queryOne(
        `INSERT INTO assessment_rule_versions (rule_id, version_number, snapshot, change_notes, created_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
        [ruleId, snapshotVersion, JSON.stringify(snapshot), changeNotes || null, createdBy || null],
    );

    // Update the rule's version counter for the template
    await query(`UPDATE assessment_rule_templates SET version = $1, updated_at = NOW() WHERE id = $2`, [nextVersion, ruleId]);

    return version;
}

export async function listVersions(ruleId: string) {
    return query(
        `SELECT * FROM assessment_rule_versions WHERE rule_id = $1 ORDER BY version_number DESC`,
        [ruleId],
    );
}
