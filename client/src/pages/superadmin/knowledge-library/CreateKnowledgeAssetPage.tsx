// =============================================================================
// Create Knowledge Asset wizard (Sprint 1 shell — AI generation deep-links)
// =============================================================================

import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check, ChevronLeft, ChevronRight, Wand2 } from "lucide-react";
import { CATEGORY_OPTIONS } from "../../../services/knowledgeLibraryService";

const ASSET_TYPES = [
  { id: "lesson", label: "Lesson" },
  { id: "questions", label: "Questions" },
  { id: "flashcards", label: "Flashcards" },
  { id: "coding", label: "Coding Challenge" },
  { id: "interview", label: "Interview Questions" },
  { id: "case", label: "Case Study" },
  { id: "voice", label: "Voice Lesson" },
  { id: "video", label: "Video" },
  { id: "document", label: "Document" },
  { id: "cheatsheet", label: "Cheat Sheet", soon: true },
  { id: "practice", label: "Practice Set", soon: true },
] as const;

const AI_OPTIONS = [
  { id: "summary", label: "Generate Summary" },
  { id: "objectives", label: "Generate Objectives" },
  { id: "examples", label: "Generate Examples" },
  { id: "voice", label: "Generate Voice" },
  { id: "quiz", label: "Generate Quiz" },
  { id: "flashcards", label: "Generate Flashcards" },
  { id: "practice", label: "Generate Practice" },
  { id: "coding", label: "Generate Coding" },
  { id: "interview", label: "Generate Interview Questions" },
] as const;

const STEPS = ["Topic", "Assets", "AI", "Review", "Publish"] as const;

export default function CreateKnowledgeAssetPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<"manual" | "ai">("ai");
  const [category, setCategory] = useState("programming");
  const [topic, setTopic] = useState("");
  const [assets, setAssets] = useState<string[]>(["lesson", "questions", "flashcards"]);
  const [aiOpts, setAiOpts] = useState<string[]>(["summary", "objectives", "quiz", "flashcards"]);

  const canNext = useMemo(() => {
    if (step === 0) return Boolean(category && topic.trim());
    if (step === 1) return assets.length > 0;
    if (step === 2) return mode === "manual" || aiOpts.length > 0;
    return true;
  }, [step, category, topic, assets, aiOpts, mode]);

  const toggle = (list: string[], id: string, set: (v: string[]) => void) => {
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  };

  const finish = () => {
    const params = new URLSearchParams({
      category,
      topic: topic.trim(),
      assets: assets.join(","),
      ai: aiOpts.join(","),
      mode,
    });
    if (mode === "ai") {
      navigate(`/app/superadmin/learning-companion/studio?${params.toString()}`);
    } else {
      navigate(`/app/superadmin/learning-companion/review`);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <Link to="/app/superadmin/knowledge-library" className="text-xs text-admin-accent hover:underline">
          ← Knowledge Library
        </Link>
        <h2 className="mt-2 text-xl font-semibold text-gray-900">Create Knowledge Asset</h2>
        <p className="text-sm text-gray-500 mt-1">
          One workflow for multiple asset types under a topic. Sprint 1 routes AI generation into Content Studio;
          full multi-asset publish lands in later sprints.
        </p>
      </div>

      <ol className="flex flex-wrap gap-2">
        {STEPS.map((label, i) => (
          <li
            key={label}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium ${
              i === step
                ? "border-navy-900 bg-navy-900 text-white"
                : i < step
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-gray-200 text-gray-500"
            }`}
          >
            {i < step ? <Check className="w-3 h-3" /> : <span>{i + 1}</span>}
            {label}
          </li>
        ))}
      </ol>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-admin-card space-y-4">
        {step === 0 && (
          <>
            <p className="text-sm text-gray-600">Choose subject → topic (topic is free text until Sprint 3 taxonomy).</p>
            <label className="block text-sm">
              <span className="text-gray-500">Subject</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2"
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-gray-500">Topic</span>
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Python Functions"
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2"
              />
            </label>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setMode("ai")}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm ${
                  mode === "ai" ? "border-navy-900 bg-navy-900 text-white" : "border-gray-200"
                }`}
              >
                AI Generation
              </button>
              <button
                type="button"
                onClick={() => setMode("manual")}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm ${
                  mode === "manual" ? "border-navy-900 bg-navy-900 text-white" : "border-gray-200"
                }`}
              >
                Manual Creation
              </button>
            </div>
          </>
        )}

        {step === 1 && (
          <div className="grid sm:grid-cols-2 gap-2">
            {ASSET_TYPES.map((a) => (
              <label
                key={a.id}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                  "soon" in a && a.soon ? "opacity-50" : ""
                } ${assets.includes(a.id) ? "border-navy-900 bg-slate-50" : "border-gray-200"}`}
              >
                <input
                  type="checkbox"
                  disabled={"soon" in a && a.soon}
                  checked={assets.includes(a.id)}
                  onChange={() => toggle(assets, a.id, setAssets)}
                />
                {a.label}
                {"soon" in a && a.soon ? <span className="text-[10px] text-gray-400">Sprint 2+</span> : null}
              </label>
            ))}
          </div>
        )}

        {step === 2 && (
          mode === "manual" ? (
            <p className="text-sm text-gray-600">
              Manual path: after review you&apos;ll land in Review Center / Course Builder to author content.
            </p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-2">
              {AI_OPTIONS.map((a) => (
                <label
                  key={a.id}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                    aiOpts.includes(a.id) ? "border-navy-900 bg-slate-50" : "border-gray-200"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={aiOpts.includes(a.id)}
                    onChange={() => toggle(aiOpts, a.id, setAiOpts)}
                  />
                  {a.label}
                </label>
              ))}
            </div>
          )
        )}

        {step === 3 && (
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Subject</dt>
              <dd className="font-medium text-gray-900">{category.replace(/_/g, " ")}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Topic</dt>
              <dd className="font-medium text-gray-900">{topic}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Mode</dt>
              <dd className="font-medium text-gray-900">{mode === "ai" ? "AI Generation" : "Manual"}</dd>
            </div>
            <div>
              <dt className="text-gray-500 mb-1">Assets</dt>
              <dd className="flex flex-wrap gap-1">
                {assets.map((a) => (
                  <span key={a} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs">
                    {a}
                  </span>
                ))}
              </dd>
            </div>
            {mode === "ai" && (
              <div>
                <dt className="text-gray-500 mb-1">AI options</dt>
                <dd className="flex flex-wrap gap-1">
                  {aiOpts.map((a) => (
                    <span key={a} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs">
                      {a}
                    </span>
                  ))}
                </dd>
              </div>
            )}
          </dl>
        )}

        {step === 4 && (
          <div className="text-sm text-gray-600 space-y-3">
            <p>
              Publish lifecycle today: <strong>Draft → AI Generated → Pending Review → Approved → Published</strong>.
            </p>
            <p>
              Clicking continue opens {mode === "ai" ? "Content Studio with your topic context" : "Review Center"} so
              existing generation/review APIs stay intact.
            </p>
          </div>
        )}
      </div>

      <div className="flex justify-between">
        <button
          type="button"
          disabled={step === 0}
          onClick={() => setStep((s) => s - 1)}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm disabled:opacity-40"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        {step < STEPS.length - 1 ? (
          <button
            type="button"
            disabled={!canNext}
            onClick={() => setStep((s) => s + 1)}
            className="inline-flex items-center gap-1 rounded-lg bg-navy-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={finish}
            className="inline-flex items-center gap-1.5 rounded-lg bg-navy-900 px-4 py-2 text-sm font-medium text-white"
          >
            <Wand2 className="w-4 h-4" />
            {mode === "ai" ? "Open AI Studio" : "Go to Review"}
          </button>
        )}
      </div>
    </div>
  );
}
