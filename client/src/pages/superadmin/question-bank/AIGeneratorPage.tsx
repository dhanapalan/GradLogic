import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  SparklesIcon,
  DocumentArrowUpIcon,
  CheckCircleIcon,
  XCircleIcon,
  PencilIcon,
  ArrowDownTrayIcon,
  CpuChipIcon,
} from "@heroicons/react/24/outline";
import api from "../../../lib/api";
import collegeService, { College } from "../../../services/collegeService";

interface GeneratedQuestion {
  question: string;
  options: string[];
  correct_answer: string;
  explanation?: string;
  difficulty?: string;
  category: string;
  selected: boolean;
  editing: boolean;
}

const CATEGORIES = [
  "aptitude",
  "reasoning",
  "maths",
  "data_structures",
  "programming",
  "python_coding",
  "java_coding",
  "data_science",
];

interface EngineHealth {
  online: boolean;
  engine: {
    knowledge_base?: { total_chunks?: number; unique_documents?: number };
  } | null;
}

function label(value: string) {
  return value.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function AIGeneratorPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [health, setHealth] = useState<EngineHealth | null>(null);
  const [topic, setTopic] = useState("");
  const [category, setCategory] = useState("aptitude");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [count, setCount] = useState(5);
  const [useRag, setUseRag] = useState(true);

  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [generated, setGenerated] = useState<GeneratedQuestion[]>([]);

  const [colleges, setColleges] = useState<College[]>([]);
  const [assignedColleges, setAssignedColleges] = useState<Set<string>>(new Set());

  const refreshHealth = () => {
    api
      .get("/qb-ai/health")
      .then((res) => setHealth(res.data?.data || { online: false, engine: null }))
      .catch(() => setHealth({ online: false, engine: null }));
  };

  useEffect(() => {
    refreshHealth();
    const interval = setInterval(refreshHealth, 30_000);
    collegeService
      .getAllColleges()
      .then((res) => setColleges(res.colleges))
      .catch(() => setColleges([]));
    return () => clearInterval(interval);
  }, []);

  const engineOnline = !!health?.online;

  const handleUpload = async (files: FileList) => {
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append("file", file);
        try {
          const res = await api.post("/qb-ai/documents", form, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          const d = res.data?.data;
          toast.success(
            `${file.name}: ${d?.chunks_created ?? d?.total_chunks ?? "?"} chunks embedded`
          );
        } catch (error: any) {
          toast.error(`${file.name}: ${error.response?.data?.error || "upload failed"}`);
        }
      }
      refreshHealth();
    } finally {
      setUploading(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await api.post("/qb-ai/generate", {
        topic,
        difficulty,
        question_type: "multiple_choice",
        count,
        use_rag: useRag,
      });
      const qs: any[] = res.data?.data?.questions || [];
      if (qs.length === 0) {
        toast.error("Engine returned no questions — check its logs");
        return;
      }
      setGenerated(
        qs.map((q) => ({
          question: q.question,
          options: q.options || [],
          correct_answer: q.correct_answer,
          explanation: q.explanation,
          difficulty: q.difficulty,
          category,
          selected: true,
          editing: false,
        }))
      );
      toast.success(`Generated ${qs.length} question(s) — review below`);
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const updateQuestion = (idx: number, patch: Partial<GeneratedQuestion>) => {
    setGenerated((prev) => prev.map((q, i) => (i === idx ? { ...q, ...patch } : q)));
  };

  const updateOption = (idx: number, optIdx: number, value: string) => {
    setGenerated((prev) =>
      prev.map((q, i) => {
        if (i !== idx) return q;
        const options = q.options.map((o, oi) => (oi === optIdx ? value : o));
        // Keep correct_answer in sync when the correct option's text is edited.
        const correct_answer =
          q.correct_answer === q.options[optIdx] ? value : q.correct_answer;
        return { ...q, options, correct_answer };
      })
    );
  };

  const toggleCollege = (id: string) => {
    setAssignedColleges((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedCount = generated.filter((q) => q.selected).length;

  const handleImport = async () => {
    setImporting(true);
    try {
      const questions = generated
        .filter((q) => q.selected)
        .map((q) => ({
          question: q.question,
          options: q.options,
          correct_answer: q.correct_answer,
          explanation: q.explanation,
          category: q.category,
          difficulty: (["easy", "medium", "hard"].includes(q.difficulty || "")
            ? q.difficulty
            : difficulty) as "easy" | "medium" | "hard",
          tags: ["ai-generated", topic.toLowerCase().trim().replace(/\s+/g, "-")].filter(Boolean),
          marks: 1,
        }));
      const res = await api.post("/qb-ai/import", {
        questions,
        college_ids: assignedColleges.size > 0 ? Array.from(assignedColleges) : undefined,
      });
      toast.success(res.data?.message || "Questions imported");
      setGenerated([]);
      setAssignedColleges(new Set());
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Import failed");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-gray-900">AI Question Generator</h2>
          <p className="text-gray-500 mt-1">
            Upload study material, generate grounded questions, review, and publish.
          </p>
        </div>
        <div
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm ${
            engineOnline ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          }`}
        >
          <CpuChipIcon className="h-4 w-4" />
          {engineOnline ? "Engine Online" : "Engine Offline"}
        </div>
      </div>

      {!engineOnline && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800 mb-6">
          <p className="font-semibold mb-1">The AI engine is not running.</p>
          <p>
            Start it with{" "}
            <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono text-xs">
              cd ai-engine/question_bank_engine && python -m api
            </code>{" "}
            — this page will detect it automatically.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Upload */}
        <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-6">
          <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
            <DocumentArrowUpIcon className="h-5 w-5 text-admin-accent" />
            1. Upload Documents
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            PDF, DOCX, TXT or Markdown — embedded into the engine's knowledge base
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.txt,.md"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) handleUpload(e.target.files);
              e.target.value = "";
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={!engineOnline || uploading}
            className="w-full px-4 py-8 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 font-medium hover:border-blue-400 hover:text-admin-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? "Uploading & embedding..." : "Click to upload document(s)"}
          </button>
          {health?.engine?.knowledge_base && (
            <p className="text-xs text-gray-500 mt-3">
              Knowledge base: {health.engine.knowledge_base.total_chunks ?? 0} chunks ·{" "}
              {health.engine.knowledge_base.unique_documents ?? 0} document(s)
            </p>
          )}
        </div>

        {/* Generate */}
        <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-6">
          <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
            <SparklesIcon className="h-5 w-5 text-admin-accent" />
            2. Generate Questions
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            Topic-based generation, grounded in your uploaded content
          </p>
          <div className="space-y-3">
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Topic — e.g. Percentages, Time & Work, Binary Trees"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-admin-accent"
            />
            <div className="grid grid-cols-3 gap-3">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                title="Target category"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {label(c)}
                  </option>
                ))}
              </select>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as any)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
              <select
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
              >
                {[3, 5, 8, 10].map((n) => (
                  <option key={n} value={n}>
                    {n} questions
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={useRag} onChange={(e) => setUseRag(e.target.checked)} />
              Ground in uploaded documents (RAG)
            </label>
            <button
              onClick={handleGenerate}
              disabled={!engineOnline || topic.trim().length < 3 || generating}
              className="w-full px-4 py-3 bg-navy-900 text-white font-medium rounded-lg hover:bg-navy-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generating ? "Generating (may take up to a minute)..." : "Generate Questions"}
            </button>
          </div>
        </div>
      </div>

      {/* Review */}
      {generated.length > 0 && (
        <>
          <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card overflow-hidden mb-6">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">
                3. Review — {selectedCount} of {generated.length} approved
              </h3>
              <p className="text-sm text-gray-500">
                Approve, edit, or reject each question before publishing
              </p>
            </div>
            <div className="divide-y divide-gray-200">
              {generated.map((q, idx) => (
                <div key={idx} className={`p-6 ${q.selected ? "" : "opacity-50"}`}>
                  <div className="flex items-start gap-4">
                    <div className="flex flex-col gap-2 flex-shrink-0 mt-0.5">
                      <button
                        onClick={() => updateQuestion(idx, { selected: !q.selected })}
                        title={q.selected ? "Approved — click to reject" : "Rejected — click to approve"}
                      >
                        {q.selected ? (
                          <CheckCircleIcon className="h-6 w-6 text-green-600" />
                        ) : (
                          <XCircleIcon className="h-6 w-6 text-gray-300" />
                        )}
                      </button>
                      <button
                        onClick={() => updateQuestion(idx, { editing: !q.editing })}
                        title="Edit question"
                      >
                        <PencilIcon
                          className={`h-5 w-5 ${q.editing ? "text-admin-accent" : "text-gray-400 hover:text-admin-accent"}`}
                        />
                      </button>
                    </div>

                    <div className="flex-1 min-w-0">
                      {q.editing ? (
                        <div className="space-y-3">
                          <textarea
                            rows={2}
                            value={q.question}
                            onChange={(e) => updateQuestion(idx, { question: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-admin-accent"
                          />
                          {q.options.map((opt, oi) => (
                            <div key={oi} className="flex items-center gap-2">
                              <input
                                type="radio"
                                name={`correct-${idx}`}
                                checked={opt === q.correct_answer}
                                onChange={() => updateQuestion(idx, { correct_answer: opt })}
                                title="Mark as correct answer"
                              />
                              <input
                                type="text"
                                value={opt}
                                onChange={(e) => updateOption(idx, oi, e.target.value)}
                                className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm"
                              />
                            </div>
                          ))}
                          <textarea
                            rows={2}
                            value={q.explanation || ""}
                            onChange={(e) => updateQuestion(idx, { explanation: e.target.value })}
                            placeholder="Explanation (optional)"
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                          />
                          <button
                            onClick={() => updateQuestion(idx, { editing: false })}
                            className="px-3 py-1.5 bg-navy-900 text-white rounded-lg text-sm font-medium hover:bg-navy-800"
                          >
                            Done Editing
                          </button>
                        </div>
                      ) : (
                        <>
                          <p className="font-medium text-gray-900 mb-3">{q.question}</p>
                          {q.options.length > 0 && (
                            <ul className="space-y-1.5 mb-3">
                              {q.options.map((opt, oi) => (
                                <li
                                  key={oi}
                                  className={`text-sm px-3 py-1.5 rounded-lg ${
                                    opt === q.correct_answer
                                      ? "bg-green-50 text-green-800 font-medium"
                                      : "bg-gray-50 text-gray-700"
                                  }`}
                                >
                                  {String.fromCharCode(65 + oi)}. {opt}
                                </li>
                              ))}
                            </ul>
                          )}
                          {q.explanation && (
                            <p className="text-sm text-gray-600 bg-navy-900/[0.03] rounded-lg px-3 py-2 mb-3">
                              <span className="font-medium">Explanation: </span>
                              {q.explanation}
                            </p>
                          )}
                        </>
                      )}

                      <div className="flex items-center gap-3 mt-2">
                        <select
                          value={q.category}
                          onChange={(e) => updateQuestion(idx, { category: e.target.value })}
                          className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-700"
                        >
                          {CATEGORIES.map((c) => (
                            <option key={c} value={c}>
                              {label(c)}
                            </option>
                          ))}
                        </select>
                        <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-600 capitalize">
                          {q.difficulty || difficulty}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Assign + import */}
          <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-6">
            <h3 className="font-semibold text-gray-900 mb-1">4. Assign & Publish</h3>
            <p className="text-sm text-gray-500 mb-4">
              Optionally earmark these questions for specific colleges. Leave empty to publish globally.
            </p>
            {colleges.length > 0 && (
              <div className="flex flex-wrap gap-3 mb-4">
                {colleges.map((c) => (
                  <label
                    key={c.id}
                    className={`flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer text-sm ${
                      assignedColleges.has(c.id)
                        ? "border-admin-accent bg-navy-900/[0.06] text-navy-900"
                        : "border-gray-200 text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={assignedColleges.has(c.id)}
                      onChange={() => toggleCollege(c.id)}
                    />
                    {c.name}
                  </label>
                ))}
              </div>
            )}
            <button
              onClick={handleImport}
              disabled={selectedCount === 0 || importing}
              className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              <ArrowDownTrayIcon className="h-4 w-4" />
              {importing
                ? "Publishing..."
                : `Publish ${selectedCount} Question(s)${assignedColleges.size > 0 ? ` to ${assignedColleges.size} College(s)` : ""}`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
