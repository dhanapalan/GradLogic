import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { MagnifyingGlassIcon, SparklesIcon, ArrowDownTrayIcon, ArrowUpTrayIcon } from "@heroicons/react/24/outline";
import toast from "react-hot-toast";
import StatusBadge from "../../../components/superadmin/StatusBadge";
import questionBankService, { Question } from "../../../services/questionBankService";

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

const TYPES = ["multiple_choice", "coding_challenge"];
const DIFFICULTIES = ["easy", "medium", "hard"];
const BLOOM_LEVELS = ["remember", "understand", "apply", "analyze", "evaluate", "create"];

const PAGE_SIZE = 25;

const IMPORT_COLUMNS = [
  "category",
  "type",
  "difficulty_level",
  "question_text",
  "options",
  "correct_answer",
  "explanation",
  "tags",
  "marks",
  "bloom_level",
];

interface ImportRow {
  category: string;
  type: string;
  difficulty_level: string;
  question_text: string;
  options?: string[];
  correct_answer?: string;
  explanation?: string;
  tags?: string[];
  marks?: number;
  bloom_level?: string;
}

interface ParsedImport {
  valid: ImportRow[];
  errors: Array<{ row: number; error: string }>;
}

function label(value: string) {
  return value.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function toCsv(rows: Question[]): string {
  const header = ["ID", "Question", "Category", "Type", "Difficulty", "Bloom Level", "Status", "Tags"];
  const lines = rows.map((q) =>
    [
      q.id,
      q.question_text,
      q.category,
      q.type,
      q.difficulty_level,
      q.bloom_level || "",
      q.status,
      (q.tags || []).join(";"),
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(",")
  );
  return [header.join(","), ...lines].join("\n");
}

function downloadTemplate() {
  const header = IMPORT_COLUMNS.join(",");
  const example =
    '"aptitude","multiple_choice","easy","A train travels 60km in 1 hour. What is its speed?","60 km/h;120 km/h;30 km/h;90 km/h","60 km/h","Speed = distance / time = 60 / 1.","speed;time-distance","5","apply"';
  const blob = new Blob([`${header}\n${example}\n`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "question-import-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// Minimal RFC4180-style CSV line splitter — handles quoted fields containing
// commas, escaped quotes (""), and newlines inside quotes.
function parseCsvText(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

function parseImportCsv(text: string): ParsedImport {
  const rows = parseCsvText(text);
  if (rows.length === 0) return { valid: [], errors: [{ row: 0, error: "File is empty" }] };

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const colIndex: Record<string, number> = {};
  header.forEach((h, i) => (colIndex[h] = i));

  const missingRequired = ["category", "type", "difficulty_level", "question_text"].filter(
    (c) => !(c in colIndex)
  );
  if (missingRequired.length > 0) {
    return {
      valid: [],
      errors: [{ row: 0, error: `Missing required column(s): ${missingRequired.join(", ")}` }],
    };
  }

  const valid: ImportRow[] = [];
  const errors: Array<{ row: number; error: string }> = [];

  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    const get = (col: string) => (colIndex[col] !== undefined ? (cells[colIndex[col]] || "").trim() : "");

    const category = get("category").toLowerCase();
    const type = get("type").toLowerCase();
    const difficulty_level = get("difficulty_level").toLowerCase();
    const question_text = get("question_text");
    const rowNum = r + 1; // 1-indexed, +1 for header line

    if (!CATEGORIES.includes(category)) {
      errors.push({ row: rowNum, error: `Invalid category "${category}"` });
      continue;
    }
    if (!TYPES.includes(type)) {
      errors.push({ row: rowNum, error: `Invalid type "${type}"` });
      continue;
    }
    if (!DIFFICULTIES.includes(difficulty_level)) {
      errors.push({ row: rowNum, error: `Invalid difficulty_level "${difficulty_level}"` });
      continue;
    }
    if (!question_text) {
      errors.push({ row: rowNum, error: "question_text is required" });
      continue;
    }

    const options = get("options") ? get("options").split(";").map((o) => o.trim()).filter(Boolean) : undefined;
    const correct_answer = get("correct_answer") || undefined;

    if (type === "multiple_choice" && (!options || options.length < 2 || !correct_answer)) {
      errors.push({
        row: rowNum,
        error: "multiple_choice rows need at least 2 options and a correct_answer",
      });
      continue;
    }
    if (type === "coding_challenge") {
      errors.push({
        row: rowNum,
        error: "coding_challenge import isn't supported via CSV yet (test_cases can't be expressed in a flat column) — use the AI generator or manual form instead",
      });
      continue;
    }

    const bloom_level = get("bloom_level").toLowerCase() || undefined;
    if (bloom_level && !BLOOM_LEVELS.includes(bloom_level)) {
      errors.push({ row: rowNum, error: `Invalid bloom_level "${bloom_level}"` });
      continue;
    }

    const marksRaw = get("marks");
    const marks = marksRaw ? Number(marksRaw) : undefined;
    if (marksRaw && Number.isNaN(marks)) {
      errors.push({ row: rowNum, error: `marks "${marksRaw}" is not a number` });
      continue;
    }

    valid.push({
      category,
      type,
      difficulty_level,
      question_text,
      options,
      correct_answer,
      explanation: get("explanation") || undefined,
      tags: get("tags") ? get("tags").split(";").map((t) => t.trim()).filter(Boolean) : undefined,
      marks,
      bloom_level,
    });
  }

  return { valid, errors };
}

export default function AllQuestionsPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [type, setType] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [bloomLevel, setBloomLevel] = useState("");
  const [source, setSource] = useState("");

  const [questions, setQuestions] = useState<Question[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [acting, setActing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingImport, setPendingImport] = useState<ParsedImport | null>(null);
  const [importing, setImporting] = useState(false);

  const load = () => {
    setLoading(true);
    questionBankService
      .searchQuestions({
        search: search || undefined,
        category: category || undefined,
        type: type || undefined,
        difficulty: difficulty || undefined,
        bloomLevel: bloomLevel || undefined,
        source: (source as "ai-generated" | "manual") || undefined,
        page,
        limit: PAGE_SIZE,
      })
      .then((res) => {
        setQuestions(res.questions);
        setTotal(res.total);
        setSelected(new Set());
      })
      .catch(() => {
        toast.error("Failed to load questions");
        setQuestions([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const debounce = setTimeout(load, 300);
    return () => clearTimeout(debounce);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, category, type, difficulty, bloomLevel, source, page]);

  // Reset to page 1 whenever a filter (not the page itself) changes.
  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, category, type, difficulty, bloomLevel, source]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) => (prev.size === questions.length ? new Set() : new Set(questions.map((q) => q.id))));
  };

  const handleBulk = async (action: "publish" | "archive") => {
    setActing(true);
    try {
      const res = await questionBankService.bulkAction(action, Array.from(selected));
      toast.success(res.message);
      load();
    } catch {
      toast.error(`Failed to ${action} questions`);
    } finally {
      setActing(false);
    }
  };

  const handleExport = () => {
    const rows = selected.size > 0 ? questions.filter((q) => selected.has(q.id)) : questions;
    const csv = toCsv(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `questions-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDeactivateQuestion = async (id: string) => {
    if (!confirm("Deactivate this question?")) return;
    try {
      await questionBankService.deactivateQuestion(id);
      toast.success("Question deactivated");
      load();
    } catch {
      toast.error("Failed to deactivate question");
    }
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;
    const text = await file.text();
    const parsed = parseImportCsv(text);
    if (parsed.valid.length === 0 && parsed.errors.length === 0) {
      toast.error("No rows found in file");
      return;
    }
    setPendingImport(parsed);
  };

  const confirmImport = async () => {
    if (!pendingImport || pendingImport.valid.length === 0) return;
    setImporting(true);
    try {
      const res = await questionBankService.bulkCreateQuestions(pendingImport.valid);
      if (res.errors.length > 0) {
        toast.error(`${res.created} imported, ${res.errors.length} rejected by the server`);
      } else {
        toast.success(`${res.created} question(s) imported`);
      }
      setPendingImport(null);
      load();
    } catch {
      toast.error("Import failed");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">All Questions</h2>
          <p className="text-gray-600 mt-1">Manage the master question repository ({total} total)</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleFileSelected}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
          >
            <ArrowUpTrayIcon className="w-5 h-5" />
            Import CSV
          </button>
          <button
            onClick={downloadTemplate}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Download template
          </button>
          <Link
            to="/app/superadmin/question-bank/ai-generator"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            <SparklesIcon className="w-5 h-5" />
            Generate New Questions
          </Link>
        </div>
      </div>

      {/* Import review panel */}
      {pendingImport && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Review Import</h3>
          <p className="text-sm text-gray-600 mb-3">
            <span className="font-medium text-green-700">{pendingImport.valid.length} valid</span>
            {pendingImport.errors.length > 0 && (
              <>
                {" · "}
                <span className="font-medium text-red-700">{pendingImport.errors.length} skipped</span>
              </>
            )}
          </p>
          {pendingImport.errors.length > 0 && (
            <div className="max-h-40 overflow-y-auto mb-4 bg-red-50 border border-red-100 rounded-lg p-3">
              {pendingImport.errors.slice(0, 20).map((e, i) => (
                <p key={i} className="text-xs text-red-700">
                  Row {e.row}: {e.error}
                </p>
              ))}
              {pendingImport.errors.length > 20 && (
                <p className="text-xs text-red-700 mt-1">
                  ...and {pendingImport.errors.length - 20} more
                </p>
              )}
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={confirmImport}
              disabled={importing || pendingImport.valid.length === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              Import {pendingImport.valid.length} Question{pendingImport.valid.length === 1 ? "" : "s"}
            </button>
            <button
              onClick={() => setPendingImport(null)}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="relative mb-4">
          <MagnifyingGlassIcon className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search question text..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase block mb-1">Subject</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Subjects</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {label(c)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase block mb-1">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Types</option>
              <option value="multiple_choice">Multiple Choice</option>
              <option value="coding_challenge">Coding Challenge</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase block mb-1">Difficulty</label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Levels</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase block mb-1">Bloom's Level</label>
            <select
              value={bloomLevel}
              onChange={(e) => setBloomLevel(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Levels</option>
              {BLOOM_LEVELS.map((b) => (
                <option key={b} value={b}>
                  {label(b)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase block mb-1">Source</label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Sources</option>
              <option value="ai-generated">AI Generated</option>
              <option value="manual">Manual</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 flex items-center justify-between">
          <span className="text-sm font-medium text-blue-900">{selected.size} selected</span>
          <div className="flex gap-2">
            <button
              onClick={() => handleBulk("publish")}
              disabled={acting}
              className="px-3 py-1.5 bg-white border border-green-300 text-green-700 rounded-lg text-sm font-medium hover:bg-green-50 disabled:opacity-50"
            >
              Publish
            </button>
            <button
              onClick={() => handleBulk("archive")}
              disabled={acting}
              className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              Archive
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-1 px-3 py-1.5 bg-white border border-blue-300 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100"
            >
              <ArrowDownTrayIcon className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>
      )}

      {/* Questions Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <p className="text-gray-600">Loading questions...</p>
          </div>
        ) : (
          <>
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={questions.length > 0 && selected.size === questions.length}
                      onChange={toggleAll}
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Question</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Subject</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Type</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Difficulty</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Bloom's</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Source</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {questions.map((question) => (
                  <tr key={question.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selected.has(question.id)}
                        onChange={() => toggleOne(question.id)}
                      />
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      <div className="max-w-xs truncate">{question.question_text}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{label(question.category)}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{label(question.type)}</td>
                    <td className="px-6 py-4 text-sm">
                      <StatusBadge
                        status={
                          question.difficulty_level === "easy"
                            ? "success"
                            : question.difficulty_level === "hard"
                              ? "error"
                              : "pending"
                        }
                        label={label(question.difficulty_level)}
                        size="sm"
                      />
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {question.bloom_level ? label(question.bloom_level) : "Unclassified"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {(question.tags || []).includes("ai-generated") ? "AI Generated" : "Manual"}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <StatusBadge
                        status={question.status === "published" ? "active" : question.status === "archived" ? "inactive" : "pending"}
                        label={label(question.status)}
                        size="sm"
                      />
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {question.is_active !== false && question.status !== "archived" && (
                        <button
                          onClick={() => handleDeactivateQuestion(question.id)}
                          className="text-sm text-red-600 hover:text-red-800 font-medium"
                        >
                          Deactivate
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {questions.length === 0 && (
              <div className="p-12 text-center">
                <p className="text-gray-600">No questions found matching your filters</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Pagination */}
      {!loading && total > 0 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-600">
            Page {page} of {totalPages} ({total} questions)
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
