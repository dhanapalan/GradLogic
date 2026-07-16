/**
 * Knowledge Graph (Phase 12) — generates a bounded graph from REAL existing
 * tables. Where a requested node type genuinely has no backing data in this
 * schema (Role, Company — no company catalog or interview-session table
 * exists with real usage yet), that node type is returned empty rather than
 * fabricated. Nothing here is persisted as a graph database — it's computed
 * fresh on each request from the relational schema, same "compute don't
 * fabricate a new store" approach as Phase 8/9's study plan and readiness.
 */

import { query } from "../config/database.js";

export type GraphNodeType = "question" | "topic" | "skill" | "role" | "company" | "assessment" | "course" | "learning_path";
export type GraphEdgeType = "related" | "prerequisite" | "used_in" | "recommended";

export interface GraphNode {
  id: string;
  type: GraphNodeType;
  label: string;
}

export interface GraphEdge {
  from: string;
  to: string;
  type: GraphEdgeType;
  weight?: number;
}

export interface KnowledgeGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  notes: string[]; // honest disclosures about node types with no real data yet
}

const MAX_QUESTIONS = 60;
const RELATED_THRESHOLD = 0.75;
const DUPLICATE_CEILING = 0.95; // above this, Phase 11 calls it a duplicate, not "related"

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

const SYSTEM_TAGS = new Set(["ai-generated", "manual", "book-import", "pdf-import", "content-studio", "regenerated"]);
function isSystemTag(tag: string): boolean {
  return SYSTEM_TAGS.has(tag) || tag.startsWith("pdf-") || tag.startsWith("book-");
}

export async function generateKnowledgeGraph(): Promise<KnowledgeGraph> {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const notes: string[] = [];

  // ── Topic nodes (8 fixed categories) ──────────────────────────────────────
  const categoryRows = await query<{ category: string }>(
    `SELECT DISTINCT category::text AS category FROM question_bank WHERE is_active = TRUE AND status = 'published'`,
  );
  const topicIds = new Map<string, string>();
  for (const c of categoryRows) {
    const id = `topic:${c.category}`;
    topicIds.set(c.category, id);
    nodes.push({ id, type: "topic", label: c.category.replace(/_/g, " ") });
  }

  // ── Question nodes (bounded sample, with embeddings for "related" edges) ──
  const questions = await query<{ id: string; question_text: string; category: string; tags: string[] | null; search_embedding: number[] | null }>(
    `SELECT id, question_text, category::text AS category, tags, search_embedding
     FROM question_bank WHERE is_active = TRUE AND status = 'published'
     ORDER BY RANDOM() LIMIT $1`,
    [MAX_QUESTIONS],
  );
  const tagIds = new Map<string, string>();
  for (const q of questions) {
    const qId = `question:${q.id}`;
    nodes.push({ id: qId, type: "question", label: q.question_text.slice(0, 80) });

    const topicId = topicIds.get(q.category);
    if (topicId) edges.push({ from: qId, to: topicId, type: "related" });

    for (const tag of q.tags || []) {
      if (isSystemTag(tag)) continue;
      if (!tagIds.has(tag)) {
        const tagNodeId = `topic:tag:${tag}`;
        tagIds.set(tag, tagNodeId);
        nodes.push({ id: tagNodeId, type: "topic", label: tag });
      }
      edges.push({ from: qId, to: tagIds.get(tag)!, type: "related" });
    }
  }

  // Question-question "related" edges via Phase 10 embeddings (bounded O(n^2) over the sampled set).
  const embedded = questions.filter((q) => q.search_embedding);
  for (let i = 0; i < embedded.length; i++) {
    for (let j = i + 1; j < embedded.length; j++) {
      const sim = cosineSimilarity(embedded[i].search_embedding!, embedded[j].search_embedding!);
      if (sim >= RELATED_THRESHOLD && sim < DUPLICATE_CEILING) {
        edges.push({ from: `question:${embedded[i].id}`, to: `question:${embedded[j].id}`, type: "related", weight: sim });
      }
    }
  }
  if (embedded.length < questions.length) {
    notes.push(`${questions.length - embedded.length} of ${questions.length} sampled questions have no embedding yet (Phase 10 backfills lazily) — their "related" edges are limited to topic/tag links until then.`);
  }

  // ── Skill nodes + Prerequisite edges (real, currently sparse in this DB) ──
  const skills = await query<{ id: string; name: string }>(`SELECT id, name FROM skills WHERE is_active = TRUE`);
  const skillIds = new Map<string, string>();
  for (const s of skills) {
    const id = `skill:${s.id}`;
    skillIds.set(s.id, id);
    nodes.push({ id, type: "skill", label: s.name });
  }
  if (skills.length === 0) {
    notes.push("No rows in skills yet — Skill nodes and Prerequisite edges will populate once the skills taxonomy is seeded.");
  } else {
    const prereqs = await query<{ skill_id: string; prerequisite_skill_id: string }>(`SELECT skill_id, prerequisite_skill_id FROM skill_prerequisites`);
    for (const p of prereqs) {
      const from = skillIds.get(p.skill_id);
      const to = skillIds.get(p.prerequisite_skill_id);
      if (from && to) edges.push({ from, to, type: "prerequisite" });
    }
  }

  // ── Assessment nodes ───────────────────────────────────────────────────────
  const exams = await query<{ id: string; title: string }>(`SELECT id, title FROM exams WHERE is_active = TRUE LIMIT 50`);
  for (const e of exams) nodes.push({ id: `assessment:${e.id}`, type: "assessment", label: e.title });

  // ── Course nodes + UsedIn edges to Topic (real: courses.category is free text) ──
  const courses = await query<{ id: string; title: string; category: string }>(`SELECT id, title, category FROM courses WHERE status = 'published' LIMIT 100`);
  const courseIds = new Map<string, string>();
  for (const c of courses) {
    const id = `course:${c.id}`;
    courseIds.set(c.id, id);
    nodes.push({ id, type: "course", label: c.title });
    const matchedTopic = [...topicIds.entries()].find(([cat]) => c.category.toLowerCase().includes(cat.replace(/_/g, " ")) || cat.replace(/_/g, " ").includes(c.category.toLowerCase()));
    if (matchedTopic) edges.push({ from: id, to: matchedTopic[1], type: "used_in" });
  }
  if (courses.length === 0) notes.push("No published courses yet.");

  // ── Learning Path nodes + UsedIn edges to Course (real FK: learning_path_courses) ──
  const paths = await query<{ id: string; title: string }>(`SELECT id, title FROM learning_paths LIMIT 50`);
  for (const p of paths) {
    const id = `learning_path:${p.id}`;
    nodes.push({ id, type: "learning_path", label: p.title });
  }
  if (paths.length > 0) {
    const pathCourses = await query<{ learning_path_id: string; course_id: string }>(`SELECT learning_path_id, course_id FROM learning_path_courses`);
    for (const pc of pathCourses) {
      const courseNodeId = courseIds.get(pc.course_id);
      if (courseNodeId) edges.push({ from: `learning_path:${pc.learning_path_id}`, to: courseNodeId, type: "used_in" });
    }
  } else {
    notes.push("No rows in learning_paths yet — this table exists but nothing has been authored into it (Adaptive Learning's Study Plan is computed separately, not stored here).");
  }

  // ── Company nodes (real table, currently empty in this environment) ───────
  const companies = await query<{ id: string; name: string }>(`SELECT id, name FROM companies LIMIT 100`);
  for (const c of companies) nodes.push({ id: `company:${c.id}`, type: "company", label: c.name });
  if (companies.length === 0) notes.push("No Company nodes — no company catalog is populated in this environment yet.");

  // ── Role nodes ─────────────────────────────────────────────────────────────
  // No table in this schema stores a real "target role" catalog with usage
  // data (mock-interview target_role is free text typed per-session, not a
  // persisted entity) — honestly omitted rather than inventing a fixed list.
  notes.push("No Role nodes — target role is free text entered per mock-interview/placement-coach session, not a persisted catalog in this schema.");

  // ── Recommended edges: platform-wide weak topics → courses covering them ──
  const weakRows = await query<{ category: string; attempts: number; correct: number }>(
    `SELECT qb.category::text AS category, COUNT(*)::int AS attempts, COUNT(*) FILTER (WHERE pa.is_correct)::int AS correct
     FROM practice_attempts pa JOIN question_bank qb ON qb.id = pa.question_id
     WHERE pa.is_correct IS NOT NULL GROUP BY qb.category HAVING COUNT(*) >= 5`,
  );
  for (const w of weakRows) {
    if (w.correct / w.attempts >= 0.5) continue; // only genuinely weak topics
    const topicId = topicIds.get(w.category);
    if (!topicId) continue;
    for (const c of courses) {
      const matches = c.category.toLowerCase().includes(w.category.replace(/_/g, " "));
      if (matches) edges.push({ from: topicId, to: `course:${c.id}`, type: "recommended" });
    }
  }

  return { nodes, edges, notes };
}
