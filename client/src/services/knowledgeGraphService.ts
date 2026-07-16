import api from "../lib/api";

// =============================================================================
// Knowledge Graph (Phase 12) — client wrapper.
// =============================================================================

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
  notes: string[];
}

class KnowledgeGraphService {
  async getGraph(): Promise<KnowledgeGraph> {
    const res = await api.get("/knowledge-graph");
    return res.data.data;
  }
}

export default new KnowledgeGraphService();
