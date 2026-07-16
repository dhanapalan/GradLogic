// =============================================================================
// Knowledge Graph (Phase 12) — visualizes the generated graph service output.
//
// No graph-layout library is installed in this project, so this is a simple
// deterministic ring layout (nodes grouped by type on concentric rings, edges
// drawn as straight lines) rather than force-directed physics — the actual
// deliverable this phase asked for is the graph *service*; this view exists
// to inspect its output, not to be a full graph-editing tool.
// =============================================================================

import { useEffect, useMemo, useState } from "react";
import { Share2, Loader2, Info } from "lucide-react";
import knowledgeGraph, { type KnowledgeGraph, type GraphNodeType } from "../../../services/knowledgeGraphService";

const TYPE_COLOR: Record<GraphNodeType, string> = {
  question: "#4f46e5",
  topic: "#059669",
  skill: "#d97706",
  role: "#6b7280",
  company: "#dc2626",
  assessment: "#7c3aed",
  course: "#0891b2",
  learning_path: "#db2777",
};

const EDGE_COLOR: Record<string, string> = {
  related: "#c7d2fe",
  prerequisite: "#fde68a",
  used_in: "#a7f3d0",
  recommended: "#fecaca",
};

function layout(graph: KnowledgeGraph, width: number, height: number) {
  const cx = width / 2, cy = height / 2;
  const byType = new Map<GraphNodeType, typeof graph.nodes>();
  for (const n of graph.nodes) {
    if (!byType.has(n.type)) byType.set(n.type, []);
    byType.get(n.type)!.push(n);
  }
  const types = [...byType.keys()];
  const positions = new Map<string, { x: number; y: number }>();
  types.forEach((type, ti) => {
    const ring = 80 + ti * 70;
    const list = byType.get(type)!;
    list.forEach((n, i) => {
      const angle = (i / Math.max(list.length, 1)) * Math.PI * 2;
      positions.set(n.id, { x: cx + ring * Math.cos(angle), y: cy + ring * Math.sin(angle) });
    });
  });
  return positions;
}

export default function KnowledgeGraphPage() {
  const [graph, setGraph] = useState<KnowledgeGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<GraphNodeType | "all">("all");

  useEffect(() => {
    knowledgeGraph
      .getGraph()
      .then(setGraph)
      .catch(() => setError("Couldn't load the knowledge graph."))
      .finally(() => setLoading(false));
  }, []);

  const width = 900, height = 700;
  const positions = useMemo(() => (graph ? layout(graph, width, height) : new Map()), [graph]);

  const visibleNodeIds = useMemo(() => {
    if (!graph) return new Set<string>();
    if (filterType === "all") return new Set(graph.nodes.map((n) => n.id));
    return new Set(graph.nodes.filter((n) => n.type === filterType).map((n) => n.id));
  }, [graph, filterType]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
      </div>
    );
  }
  if (error || !graph) return <div className="p-6 text-sm text-red-600">{error}</div>;

  const nodeCounts = graph.nodes.reduce<Record<string, number>>((acc, n) => {
    acc[n.type] = (acc[n.type] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-navy-900/[0.06] rounded-lg">
          <Share2 className="w-5 h-5 text-navy-900" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Knowledge Graph</h1>
          <p className="text-sm text-gray-500">{graph.nodes.length} nodes · {graph.edges.length} edges</p>
        </div>
      </div>

      {graph.notes.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-1.5">
          {graph.notes.map((n, i) => (
            <p key={i} className="text-xs text-amber-800 flex items-start gap-1.5">
              <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {n}
            </p>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilterType("all")}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border ${filterType === "all" ? "bg-navy-900 text-white border-navy-900" : "border-gray-200 text-gray-600"}`}
        >
          All
        </button>
        {Object.entries(nodeCounts).map(([type, count]) => (
          <button
            key={type}
            onClick={() => setFilterType(type as GraphNodeType)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border capitalize flex items-center gap-1.5 ${
              filterType === type ? "text-white border-transparent" : "border-gray-200 text-gray-600"
            }`}
            style={filterType === type ? { backgroundColor: TYPE_COLOR[type as GraphNodeType] } : {}}
          >
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: TYPE_COLOR[type as GraphNodeType] }} />
            {type.replace(/_/g, " ")} ({count})
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card overflow-auto">
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          {graph.edges
            .filter((e) => visibleNodeIds.has(e.from) && visibleNodeIds.has(e.to))
            .map((e, i) => {
              const p1 = positions.get(e.from), p2 = positions.get(e.to);
              if (!p1 || !p2) return null;
              return <line key={i} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={EDGE_COLOR[e.type] || "#e5e7eb"} strokeWidth={1} />;
            })}
          {graph.nodes
            .filter((n) => visibleNodeIds.has(n.id))
            .map((n) => {
              const p = positions.get(n.id);
              if (!p) return null;
              return (
                <g key={n.id}>
                  <circle cx={p.x} cy={p.y} r={5} fill={TYPE_COLOR[n.type]} />
                  <title>{`${n.type}: ${n.label}`}</title>
                </g>
              );
            })}
        </svg>
      </div>
    </div>
  );
}
