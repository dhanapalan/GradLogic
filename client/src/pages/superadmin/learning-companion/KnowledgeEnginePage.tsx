import { useState } from "react";
import {
  Brain, MessageSquareText, FileText, Wand2, Languages, ThumbsUp,
  ShieldCheck, Gauge, Layers3, Tags, Loader2, AlertTriangle, Sparkles,
} from "lucide-react";
import toast from "react-hot-toast";
import aiKnowledgeService from "../../../services/aiKnowledgeService";

// =============================================================================
// AI Knowledge Engine — Phase 5 playground.
//
// A thin UI over the 10 /api/ai-knowledge/* capabilities. Each capability
// call is stateless: paste content in, get validated structured JSON back.
// Nothing here writes to question_bank — this page is for inspecting what
// the engine returns, not for persisting it (persisting happens through the
// existing Knowledge Library / Content Studio flows).
// =============================================================================

type CapabilityKey =
  | "explain" | "summarize" | "improve" | "generate" | "translate"
  | "recommend" | "validate" | "difficulty" | "bloom" | "skills";

interface CapabilityDef {
  key: CapabilityKey;
  label: string;
  icon: typeof Brain;
  description: string;
  contentLabel: string;
  extraField?: { key: string; label: string; placeholder: string; type: "text" | "number" };
}

const CAPABILITIES: CapabilityDef[] = [
  { key: "explain", label: "Explain", icon: MessageSquareText, description: "Plain-language explanation + key points.", contentLabel: "Content to explain", extraField: { key: "audience", label: "Audience (optional)", placeholder: "e.g. first-year CS student", type: "text" } },
  { key: "summarize", label: "Summarize", icon: FileText, description: "Condense long content into a short summary.", contentLabel: "Content to summarize", extraField: { key: "maxWords", label: "Max words (optional)", placeholder: "e.g. 100", type: "number" } },
  { key: "improve", label: "Improve", icon: Wand2, description: "Rewrite for clarity/correctness, with a changelog.", contentLabel: "Content to improve", extraField: { key: "focus", label: "Focus (optional)", placeholder: "e.g. grammar, tone", type: "text" } },
  { key: "generate", label: "Generate", icon: Sparkles, description: "Short-form items from an instruction (hints, objectives, etc).", contentLabel: "Instruction", extraField: { key: "count", label: "Count", placeholder: "3", type: "number" } },
  { key: "translate", label: "Translate", icon: Languages, description: "Translate content into another language.", contentLabel: "Content to translate", extraField: { key: "targetLanguage", label: "Target language", placeholder: "e.g. Hindi", type: "text" } },
  { key: "recommend", label: "Recommend", icon: ThumbsUp, description: "Suggest next topics/questions/skills from context.", contentLabel: "Context", extraField: { key: "count", label: "Count", placeholder: "5", type: "number" } },
  { key: "validate", label: "Validate", icon: ShieldCheck, description: "Check content against criteria, flag issues.", contentLabel: "Content to validate", extraField: { key: "criteria", label: "Criteria (optional)", placeholder: "e.g. must have exactly one correct answer", type: "text" } },
  { key: "difficulty", label: "Difficulty Prediction", icon: Gauge, description: "Predict easy/medium/hard for a question.", contentLabel: "Question text" },
  { key: "bloom", label: "Bloom Classification", icon: Layers3, description: "Classify a question by Bloom's Taxonomy level.", contentLabel: "Question text" },
  { key: "skills", label: "Skill Extraction", icon: Tags, description: "Extract skill/topic tags from content.", contentLabel: "Content" },
];

export default function KnowledgeEnginePage() {
  const [active, setActive] = useState<CapabilityDef>(CAPABILITIES[0]);
  const [content, setContent] = useState("");
  const [extraValue, setExtraValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectCapability = (def: CapabilityDef) => {
    setActive(def);
    setResult(null);
    setError(null);
    setExtraValue("");
  };

  const run = async () => {
    if (!content.trim()) {
      toast.error("Enter some content first");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      let data: unknown;
      switch (active.key) {
        case "explain":
          data = await aiKnowledgeService.explain(content, extraValue || undefined);
          break;
        case "summarize":
          data = await aiKnowledgeService.summarize(content, extraValue ? Number(extraValue) : undefined);
          break;
        case "improve":
          data = await aiKnowledgeService.improve(content, extraValue || undefined);
          break;
        case "generate":
          data = await aiKnowledgeService.generateItems(content, extraValue ? Number(extraValue) : 3);
          break;
        case "translate":
          if (!extraValue.trim()) {
            toast.error("Target language is required");
            setLoading(false);
            return;
          }
          data = await aiKnowledgeService.translate(content, extraValue);
          break;
        case "recommend":
          data = await aiKnowledgeService.recommend(content, extraValue ? Number(extraValue) : 5);
          break;
        case "validate":
          data = await aiKnowledgeService.validate(content, extraValue || undefined);
          break;
        case "difficulty":
          data = await aiKnowledgeService.predictDifficulty(content);
          break;
        case "bloom":
          data = await aiKnowledgeService.classifyBloom(content);
          break;
        case "skills":
          data = await aiKnowledgeService.extractSkills(content);
          break;
      }
      setResult(data as Record<string, unknown>);
    } catch (err: any) {
      setError(err.response?.data?.error || err.response?.data?.message || "The AI Knowledge Engine call failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-1">
        <div className="p-2 bg-navy-900/[0.06] rounded-lg">
          <Brain className="w-5 h-5 text-navy-900" />
        </div>
        <h1 className="text-xl font-semibold text-gray-900">AI Knowledge Engine</h1>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        The 10 core AI capabilities powering the AI Learning Companion. Every result is structured
        JSON validated on the backend — nothing here is saved automatically.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-[16rem_1fr] gap-6">
        {/* Capability picker */}
        <div className="space-y-1">
          {CAPABILITIES.map((cap) => {
            const Icon = cap.icon;
            const isActive = cap.key === active.key;
            return (
              <button
                key={cap.key}
                onClick={() => selectCapability(cap)}
                className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                  isActive ? "bg-navy-900/[0.06] text-navy-900" : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${isActive ? "text-navy-900" : "text-gray-400"}`} />
                <div>
                  <div className="text-sm font-medium">{cap.label}</div>
                  <div className="text-xs text-gray-400">{cap.description}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Input + result */}
        <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{active.contentLabel}</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-admin-accent/30 focus:border-admin-accent"
              placeholder="Paste text here…"
            />
          </div>

          {active.extraField && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{active.extraField.label}</label>
              <input
                type={active.extraField.type}
                value={extraValue}
                onChange={(e) => setExtraValue(e.target.value)}
                placeholder={active.extraField.placeholder}
                className="w-full sm:w-64 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-admin-accent/30 focus:border-admin-accent"
              />
            </div>
          )}

          <button
            onClick={run}
            disabled={loading}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-navy-900 text-white rounded-lg text-sm font-medium hover:bg-navy-800 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <active.icon className="w-4 h-4" />}
            {loading ? "Running…" : `Run ${active.label}`}
          </button>

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          {result && <ResultPanel capability={active.key} result={result} />}
        </div>
      </div>
    </div>
  );
}

function ResultPanel({ capability, result }: { capability: CapabilityKey; result: Record<string, unknown> }) {
  const requiresReview = result.requiresReview === true;

  return (
    <div className="border-t border-gray-100 pt-4 space-y-3">
      {requiresReview && (
        <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 w-fit">
          <AlertTriangle className="w-3.5 h-3.5" /> Draft output — review before it affects any grade or decision
        </div>
      )}

      {capability === "explain" && (
        <>
          <p className="text-sm text-gray-800 whitespace-pre-wrap">{String(result.explanation)}</p>
          {Array.isArray(result.keyPoints) && result.keyPoints.length > 0 && (
            <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
              {(result.keyPoints as string[]).map((p, i) => <li key={i}>{p}</li>)}
            </ul>
          )}
        </>
      )}

      {capability === "summarize" && <p className="text-sm text-gray-800 whitespace-pre-wrap">{String(result.summary)}</p>}

      {capability === "improve" && (
        <>
          <p className="text-sm text-gray-800 whitespace-pre-wrap">{String(result.improved)}</p>
          {Array.isArray(result.changes) && result.changes.length > 0 && (
            <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
              {(result.changes as string[]).map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          )}
        </>
      )}

      {capability === "generate" && (
        <ul className="list-disc list-inside text-sm text-gray-800 space-y-1">
          {(result.items as string[]).map((it, i) => <li key={i}>{it}</li>)}
        </ul>
      )}

      {capability === "translate" && <p className="text-sm text-gray-800 whitespace-pre-wrap">{String(result.translated)}</p>}

      {capability === "recommend" && (
        <div className="space-y-2">
          {(result.recommendations as Array<{ title: string; reason: string }>).map((r, i) => (
            <div key={i} className="p-3 bg-gray-50 rounded-lg">
              <div className="text-sm font-medium text-gray-900">{r.title}</div>
              <div className="text-xs text-gray-500">{r.reason}</div>
            </div>
          ))}
        </div>
      )}

      {capability === "validate" && (
        <>
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${result.valid ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
            {result.valid ? "Valid" : "Issues found"}
          </span>
          {Array.isArray(result.issues) && result.issues.length > 0 && (
            <ul className="list-disc list-inside text-sm text-gray-600 space-y-1 mt-2">
              {(result.issues as string[]).map((issue, i) => <li key={i}>{issue}</li>)}
            </ul>
          )}
        </>
      )}

      {capability === "difficulty" && (
        <div className="space-y-1">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium capitalize bg-navy-900/[0.06] text-navy-900">
            {String(result.difficulty)} · {Math.round(Number(result.confidence) * 100)}% confidence
          </span>
          {result.rationale ? <p className="text-sm text-gray-600 mt-1">{String(result.rationale)}</p> : null}
        </div>
      )}

      {capability === "bloom" && (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium capitalize bg-navy-900/[0.06] text-navy-900">
          {String(result.bloomLevel)} · {Math.round(Number(result.confidence) * 100)}% confidence
        </span>
      )}

      {capability === "skills" && (
        <div className="flex flex-wrap gap-1.5">
          {(result.skills as string[]).map((s, i) => (
            <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-[11px] font-medium">{s}</span>
          ))}
        </div>
      )}
    </div>
  );
}
