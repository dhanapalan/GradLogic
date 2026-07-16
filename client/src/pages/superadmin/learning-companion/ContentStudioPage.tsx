import { useEffect, useRef, useState } from "react";
import {
  Sparkles, FileText, FileType2, Presentation, FileCode2, Github, Globe,
  BookOpen, GraduationCap, Briefcase, ArrowRight, ArrowLeft, CheckCircle2,
  XCircle, Pencil, UploadCloud, Link2, ClipboardList, Cpu, PartyPopper,
} from "lucide-react";
import toast from "react-hot-toast";
import questionBankService, { GeneratedContentItem } from "../../../services/questionBankService";
import collegeService, { College } from "../../../services/collegeService";
import { BOOK_PACKS, BookPack } from "../question-bank/bookPacks";

// =============================================================================
// AI Content Studio — Phase 2
//
// Replaces AI Generator / Import PDF / Import Books with one wizard. Every
// source (PDF, DOCX, Markdown, GitHub, Website, Curriculum, Job Description)
// funnels into the SAME existing engine pipeline AI Generator already used
// (POST /qb-ai/documents → embed, POST /qb-ai/generate → RAG-grounded
// generation, POST /qb-ai/import → publish) — no parallel upload/parsing path.
// Books is the one exception: pre-authored content, published via the
// existing bulkCreateQuestions endpoint instead of the AI engine.
//
// Coding Challenges / Flashcards / Learning Notes / Voice Lessons /
// Assessments have no generation or storage model in this codebase yet — the
// engine only produces question_bank rows. They're shown, honestly disabled
// ("Coming soon"), rather than faked.
// =============================================================================

type SourceKind =
  | "pdf" | "docx" | "ppt" | "markdown" | "github" | "website"
  | "books" | "curriculum" | "job_description";

type ContentKind =
  | "questions" | "coding_challenges" | "flashcards"
  | "lessons" | "voice_lessons" | "assessments";

const SOURCES: Array<{
  kind: SourceKind; label: string; icon: typeof FileText; blurb: string; available: boolean;
}> = [
  { kind: "pdf", label: "PDF", icon: FileText, blurb: "Upload a PDF document", available: true },
  { kind: "docx", label: "DOCX", icon: FileType2, blurb: "Upload a Word document", available: true },
  { kind: "ppt", label: "PPT", icon: Presentation, blurb: "Upload a slide deck", available: false },
  { kind: "markdown", label: "Markdown", icon: FileCode2, blurb: "Upload a .md or .txt file", available: true },
  { kind: "github", label: "GitHub", icon: Github, blurb: "Paste a file or repo URL", available: true },
  { kind: "website", label: "Website", icon: Globe, blurb: "Paste a page URL", available: true },
  { kind: "books", label: "Books", icon: BookOpen, blurb: "Curated campus-prep packs", available: true },
  { kind: "curriculum", label: "Curriculum", icon: GraduationCap, blurb: "Paste a syllabus or curriculum", available: true },
  { kind: "job_description", label: "Job Description", icon: Briefcase, blurb: "Paste a JD", available: true },
];

const CONTENT_TYPES: Array<{ kind: ContentKind; label: string; icon: typeof Sparkles; available: boolean }> = [
  { kind: "questions", label: "Questions", icon: ClipboardList, available: true },
  { kind: "flashcards", label: "Flashcards", icon: FileType2, available: true },
  { kind: "lessons", label: "Lessons", icon: FileText, available: true },
  { kind: "voice_lessons", label: "Voice Lessons", icon: Sparkles, available: true },
  { kind: "coding_challenges", label: "Coding Challenges", icon: FileCode2, available: false },
  { kind: "assessments", label: "Assessments", icon: GraduationCap, available: false },
];

// Engine question_type per content kind (Questions uses the wizard's own MCQ/
// true-false/short-answer choice below, not this map).
const ENGINE_TYPE_FOR_KIND: Partial<Record<ContentKind, "flashcard" | "lesson" | "voice_lesson">> = {
  flashcards: "flashcard",
  lessons: "lesson",
  voice_lessons: "voice_lesson",
};

const CATEGORIES = [
  "aptitude", "reasoning", "maths", "data_structures",
  "programming", "python_coding", "java_coding", "data_science",
];

const STEP_LABELS = ["Choose Source", "Choose Content Type", "AI Preview", "Review", "Submit"];

interface ReviewItem extends GeneratedContentItem {
  selected: boolean;
  editing: boolean;
}

function titleCase(v: string) {
  return v.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

type Step = 1 | 2 | 3 | 4 | 5;

export default function ContentStudioPage() {
  const [step, setStep] = useState<Step>(1);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 1 — source
  const [sourceKind, setSourceKind] = useState<SourceKind | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const [pastedText, setPastedText] = useState("");
  const [selectedPack, setSelectedPack] = useState<BookPack | null>(null);
  const [processingSource, setProcessingSource] = useState(false);
  const [sourceReady, setSourceReady] = useState(false);
  const [sourceSummary, setSourceSummary] = useState<string | null>(null);

  // Step 2 — content type + generation params
  const [contentKind, setContentKind] = useState<ContentKind>(() => {
    const kind = new URLSearchParams(window.location.search).get("kind");
    const allowed: ContentKind[] = ["questions", "coding_challenges", "flashcards", "lessons", "voice_lessons", "assessments"];
    return kind && allowed.includes(kind as ContentKind) ? (kind as ContentKind) : "questions";
  });
  const [topic, setTopic] = useState("");
  const [category, setCategory] = useState("aptitude");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [count, setCount] = useState(5);
  const [useRag, setUseRag] = useState(true);

  // Step 3 — preview / generation
  const [generating, setGenerating] = useState(false);
  const [health, setHealth] = useState<{ online: boolean } | null>(null);
  const [items, setItems] = useState<ReviewItem[]>([]);

  // Step 5 — submit
  const [colleges, setColleges] = useState<College[]>([]);
  const [assignedColleges, setAssignedColleges] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ imported: number } | null>(null);

  const isBooks = sourceKind === "books";

  useEffect(() => {
    questionBankService.getEngineHealth().then(setHealth).catch(() => setHealth({ online: false }));
    collegeService.getAllColleges().then((r) => setColleges(r.colleges)).catch(() => setColleges([]));
  }, []);

  // ── Step 1: process the chosen source ─────────────────────────────────────

  const acceptForKind = (kind: SourceKind) =>
    kind === "pdf" ? ".pdf" : kind === "docx" ? ".docx" : kind === "markdown" ? ".md,.txt" : undefined;

  const processFileSource = async (f: File) => {
    setProcessingSource(true);
    try {
      const res = await questionBankService.uploadSourceDocument(f);
      setSourceReady(true);
      setSourceSummary(`${f.name} — ${res.chunks_created ?? res.total_chunks ?? "?"} chunk(s) embedded`);
      toast.success("Source embedded and ready");
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to process the source");
    } finally {
      setProcessingSource(false);
    }
  };

  const processUrlSource = async () => {
    if (!urlInput.trim()) return;
    setProcessingSource(true);
    try {
      const { text, title, sourceUrl } = await questionBankService.fetchUrlAsText(urlInput.trim());
      const name = (title || sourceUrl.split("/").pop() || "source").slice(0, 60).replace(/[^\w.-]+/g, "-");
      const asFile = new File([text], `${name}.txt`, { type: "text/plain" });
      const res = await questionBankService.uploadSourceDocument(asFile);
      setSourceReady(true);
      setSourceSummary(`${title || sourceUrl} — ${res.chunks_created ?? res.total_chunks ?? "?"} chunk(s) embedded`);
      toast.success("Fetched and embedded");
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to fetch that URL");
    } finally {
      setProcessingSource(false);
    }
  };

  const processPastedText = async (label: string) => {
    if (!pastedText.trim() || pastedText.trim().length < 20) {
      toast.error("Paste at least a few sentences of text");
      return;
    }
    setProcessingSource(true);
    try {
      const asFile = new File([pastedText], `${label}.txt`, { type: "text/plain" });
      const res = await questionBankService.uploadSourceDocument(asFile);
      setSourceReady(true);
      setSourceSummary(`Pasted ${label} — ${res.chunks_created ?? res.total_chunks ?? "?"} chunk(s) embedded`);
      toast.success("Text embedded and ready");
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to process the text");
    } finally {
      setProcessingSource(false);
    }
  };

  const selectBookPack = (pack: BookPack) => {
    setSelectedPack(pack);
    setSourceReady(true);
    setSourceSummary(`${pack.title} — ${pack.questions.length} pre-authored questions`);
    setContentKind("questions");
    setCategory(pack.category);
  };

  const resetSource = () => {
    setFile(null);
    setUrlInput("");
    setPastedText("");
    setSelectedPack(null);
    setSourceReady(false);
    setSourceSummary(null);
  };

  // ── Step 3: generate / load preview ───────────────────────────────────────

  const runPreview = async () => {
    if (isBooks && selectedPack) {
      setItems(
        selectedPack.questions.map((q) => ({
          question: q.question_text,
          options: q.options,
          correct_answer: q.correct_answer,
          explanation: q.explanation,
          difficulty: q.difficulty_level,
          category: q.category,
          selected: true,
          editing: false,
        }))
      );
      setStep(3);
      return;
    }

    if (!topic.trim() || topic.trim().length < 3) {
      toast.error("Enter a topic (at least 3 characters) to guide generation");
      return;
    }
    setGenerating(true);
    try {
      const results = await questionBankService.generateContent({
        topic,
        difficulty,
        questionType: ENGINE_TYPE_FOR_KIND[contentKind] || "multiple_choice",
        count,
        useRag: useRag && sourceReady,
      });
      if (results.length === 0) {
        toast.error("The engine returned no content — check its logs and try again");
        return;
      }
      setItems(
        results.map((q) => ({
          ...q,
          options: q.options || [],
          correct_answer: q.correct_answer || "",
          category,
          selected: true,
          editing: false,
        }))
      );
      setStep(3);
      toast.success(`Generated ${results.length} item(s) — review below`);
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  // ── Step 4: review helpers ─────────────────────────────────────────────────

  const updateItem = (idx: number, patch: Partial<ReviewItem>) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const updateOption = (idx: number, optIdx: number, value: string) => {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== idx) return it;
        const options = it.options.map((o, oi) => (oi === optIdx ? value : o));
        const correct_answer = it.correct_answer === it.options[optIdx] ? value : it.correct_answer;
        return { ...it, options, correct_answer };
      })
    );
  };

  const selectedCount = items.filter((i) => i.selected).length;

  // ── Step 5: submit ─────────────────────────────────────────────────────────

  const toggleCollege = (id: string) => {
    setAssignedColleges((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const selected = items.filter((i) => i.selected);
      if (isBooks) {
        const res = await questionBankService.bulkCreateQuestions(
          selected.map((q) => ({
            category: q.category,
            type: "multiple_choice",
            difficulty_level: q.difficulty || difficulty,
            question_text: q.question,
            options: q.options,
            correct_answer: q.correct_answer,
            explanation: q.explanation,
            tags: ["book-import", selectedPack?.slug || "books"].filter(Boolean),
          }))
        );
        setDone({ imported: res.created });
      } else if (ENGINE_TYPE_FOR_KIND[contentKind]) {
        const res = await questionBankService.importContentItems(
          ENGINE_TYPE_FOR_KIND[contentKind]!,
          selected.map((q) => ({
            title: q.question,
            body: q.answer || "",
            explanation: q.explanation,
            category: q.category,
            difficulty: (["easy", "medium", "hard", "expert"].includes(q.difficulty || "") ? q.difficulty : difficulty)!,
            tags: ["content-studio", topic.toLowerCase().trim().replace(/\s+/g, "-")].filter(Boolean),
          }))
        );
        setDone({ imported: res.data?.imported ?? selected.length });
      } else {
        const res = await questionBankService.importGeneratedContent(
          selected.map((q) => ({
            question: q.question,
            options: q.options,
            correct_answer: q.correct_answer,
            explanation: q.explanation,
            category: q.category,
            difficulty: (["easy", "medium", "hard"].includes(q.difficulty || "") ? q.difficulty : difficulty) as
              | "easy" | "medium" | "hard",
            tags: ["ai-generated", "content-studio", topic.toLowerCase().trim().replace(/\s+/g, "-")].filter(Boolean),
            marks: 1,
          })),
          Array.from(assignedColleges)
        );
        setDone({ imported: res.data?.imported ?? selected.length });
      }
      setSuccess(true);
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.response?.data?.message || "Publish failed");
    } finally {
      setSubmitting(false);
    }
  };

  const startOver = () => {
    setStep(1);
    setSuccess(false);
    resetSource();
    setSourceKind(null);
    setContentKind("questions");
    setTopic("");
    setCount(5);
    setItems([]);
    setAssignedColleges(new Set());
    setDone(null);
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold tracking-tight text-gray-900 flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-admin-accent" />
          AI Content Studio
        </h2>
        <p className="text-gray-500 mt-1">
          One place to turn any source into ready-to-publish content.
        </p>
      </div>

      {!health?.online && !success && !isBooks && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 mb-6">
          The AI engine is offline — Questions from Books still work; generation from other sources needs the
          engine running (<code className="bg-amber-100 px-1 rounded font-mono text-xs">cd ai-engine/question_bank_engine && python -m api</code>).
        </div>
      )}

      {/* Step indicator */}
      {!success && (
        <div className="flex items-center gap-2 mb-8">
          {STEP_LABELS.map((label, i) => {
            const n = i + 1;
            const active = step === n;
            const complete = step > n;
            return (
              <div key={label} className="flex items-center flex-1 last:flex-none">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
                      complete ? "bg-green-600 text-white" : active ? "bg-navy-900 text-white" : "bg-gray-200 text-gray-500"
                    }`}
                  >
                    {complete ? <CheckCircle2 className="w-4 h-4" /> : n}
                  </div>
                  <span className={`text-sm font-medium whitespace-nowrap ${active ? "text-gray-900" : "text-gray-400"}`}>
                    {label}
                  </span>
                </div>
                {n < STEP_LABELS.length && <div className="flex-1 h-px bg-gray-200 mx-3" />}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Step 1: Choose Source ────────────────────────────────────────── */}
      {step === 1 && (
        <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Choose a source</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
            {SOURCES.map((s) => {
              const Icon = s.icon;
              const active = sourceKind === s.kind;
              return (
                <button
                  key={s.kind}
                  disabled={!s.available}
                  onClick={() => {
                    resetSource();
                    setSourceKind(s.kind);
                  }}
                  className={`text-left p-4 rounded-xl border transition-all ${
                    !s.available
                      ? "opacity-50 cursor-not-allowed border-gray-200 bg-gray-50"
                      : active
                        ? "border-admin-accent ring-1 ring-admin-accent/30 bg-navy-900/[0.03]"
                        : "border-gray-200 hover:border-admin-accent/40 hover:shadow-sm"
                  }`}
                >
                  <Icon className="w-5 h-5 text-navy-900 mb-2" />
                  <p className="text-sm font-semibold text-gray-900">{s.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{s.available ? s.blurb : "Coming soon"}</p>
                </button>
              );
            })}
          </div>

          {/* Source-specific input */}
          {sourceKind && !isBooks && ["pdf", "docx", "markdown"].includes(sourceKind) && (
            <div className="border-t border-gray-100 pt-5">
              <input
                ref={fileInputRef}
                type="file"
                accept={acceptForKind(sourceKind)}
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setFile(f);
                    processFileSource(f);
                  }
                  e.target.value = "";
                }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={processingSource}
                className="w-full flex flex-col items-center gap-2 px-4 py-8 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 font-medium hover:border-admin-accent hover:text-admin-accent transition-colors disabled:opacity-50"
              >
                <UploadCloud className="w-6 h-6" />
                {processingSource ? "Uploading & embedding…" : file ? file.name : `Click to choose a ${sourceKind.toUpperCase()} file`}
              </button>
              {sourceSummary && <p className="text-sm text-green-700 mt-3 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> {sourceSummary}</p>}
            </div>
          )}

          {sourceKind && ["github", "website"].includes(sourceKind) && (
            <div className="border-t border-gray-100 pt-5">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {sourceKind === "github" ? "GitHub file URL" : "Website URL"}
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder={sourceKind === "github" ? "https://github.com/org/repo/blob/main/README.md" : "https://example.com/article"}
                    className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-admin-accent"
                  />
                </div>
                <button
                  onClick={processUrlSource}
                  disabled={processingSource || !urlInput.trim()}
                  className="px-4 py-2.5 bg-navy-900 text-white rounded-lg text-sm font-medium hover:bg-navy-800 disabled:opacity-50 shrink-0"
                >
                  {processingSource ? "Fetching…" : "Fetch"}
                </button>
              </div>
              {sourceSummary && <p className="text-sm text-green-700 mt-3 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> {sourceSummary}</p>}
            </div>
          )}

          {sourceKind && ["curriculum", "job_description"].includes(sourceKind) && (
            <div className="border-t border-gray-100 pt-5">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Paste {sourceKind === "curriculum" ? "the curriculum / syllabus" : "the job description"}
              </label>
              <textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                rows={6}
                placeholder="Paste text here…"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-admin-accent"
              />
              <button
                onClick={() => processPastedText(sourceKind)}
                disabled={processingSource || pastedText.trim().length < 20}
                className="mt-3 px-4 py-2.5 bg-navy-900 text-white rounded-lg text-sm font-medium hover:bg-navy-800 disabled:opacity-50"
              >
                {processingSource ? "Embedding…" : "Use this text"}
              </button>
              {sourceSummary && <p className="text-sm text-green-700 mt-3 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> {sourceSummary}</p>}
            </div>
          )}

          {isBooks && (
            <div className="border-t border-gray-100 pt-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {BOOK_PACKS.map((pack) => (
                  <button
                    key={pack.slug}
                    onClick={() => selectBookPack(pack)}
                    className={`text-left p-4 rounded-xl border transition-all ${
                      selectedPack?.slug === pack.slug
                        ? "border-admin-accent ring-1 ring-admin-accent/30 bg-navy-900/[0.03]"
                        : "border-gray-200 hover:border-admin-accent/40"
                    }`}
                  >
                    <p className="text-sm font-semibold text-gray-900">{pack.title}</p>
                    <p className="text-xs text-gray-500 mt-1">{pack.description}</p>
                    <p className="text-xs text-gray-400 mt-2">{pack.questions.length} questions</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end mt-6">
            <button
              onClick={() => setStep(2)}
              disabled={!sourceReady}
              className="flex items-center gap-2 px-5 py-2.5 bg-navy-900 text-white rounded-lg text-sm font-medium hover:bg-navy-800 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Choose Content Type ──────────────────────────────────── */}
      {step === 2 && (
        <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Choose content type</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
            {CONTENT_TYPES.map((c) => {
              const Icon = c.icon;
              const active = contentKind === c.kind;
              return (
                <button
                  key={c.kind}
                  disabled={!c.available}
                  onClick={() => setContentKind(c.kind)}
                  className={`text-left p-4 rounded-xl border transition-all ${
                    !c.available
                      ? "opacity-50 cursor-not-allowed border-gray-200 bg-gray-50"
                      : active
                        ? "border-admin-accent ring-1 ring-admin-accent/30 bg-navy-900/[0.03]"
                        : "border-gray-200 hover:border-admin-accent/40"
                  }`}
                >
                  <Icon className="w-5 h-5 text-navy-900 mb-2" />
                  <p className="text-sm font-semibold text-gray-900">{c.label}</p>
                  {!c.available && <p className="text-xs text-gray-400 mt-0.5">Coming soon</p>}
                </button>
              );
            })}
          </div>

          {!isBooks ? (
            <div className="border-t border-gray-100 pt-5 space-y-3">
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Topic / instructions — e.g. Percentages, Time & Work, Binary Trees"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-admin-accent"
              />
              <div className="grid grid-cols-3 gap-3">
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
                  {CATEGORIES.map((c) => <option key={c} value={c}>{titleCase(c)}</option>)}
                </select>
                <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as any)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
                <select value={count} onChange={(e) => setCount(Number(e.target.value))} className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
                  {[3, 5, 8, 10].map((n) => <option key={n} value={n}>{n} items</option>)}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={useRag} onChange={(e) => setUseRag(e.target.checked)} disabled={!sourceReady} />
                Ground in the uploaded source
              </label>
            </div>
          ) : (
            <div className="border-t border-gray-100 pt-5 text-sm text-gray-600 bg-gray-50 rounded-lg p-4">
              <strong>{selectedPack?.title}</strong> is pre-authored — {selectedPack?.questions.length} questions will be shown
              directly in the next step, no AI generation needed.
            </div>
          )}

          <div className="flex justify-between mt-6">
            <button onClick={() => setStep(1)} className="flex items-center gap-2 px-5 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <button
              onClick={runPreview}
              disabled={generating || (!isBooks && (!health?.online || topic.trim().length < 3))}
              className="flex items-center gap-2 px-5 py-2.5 bg-navy-900 text-white rounded-lg text-sm font-medium hover:bg-navy-800 disabled:opacity-40"
            >
              {generating ? "Generating…" : isBooks ? "Preview" : "Generate Preview"} <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: AI Preview (read-only) ───────────────────────────────── */}
      {step === 3 && (
        <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              {isBooks ? <BookOpen className="w-4 h-4 text-admin-accent" /> : <Sparkles className="w-4 h-4 text-admin-accent" />}
              {items.length} item(s) {isBooks ? "from the pack" : "generated"}
            </h3>
            <p className="text-sm text-gray-500 mt-0.5">A quick look before you edit anything in Review.</p>
          </div>
          <div className="divide-y divide-gray-100 max-h-[28rem] overflow-y-auto">
            {items.map((it, idx) => (
              <div key={idx} className="p-5">
                <p className="text-sm font-medium text-gray-900 mb-2">{it.question}</p>
                {it.options.length > 0 && (
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {it.options.map((opt, oi) => (
                      <li key={oi} className={`text-xs px-2.5 py-1 rounded-md ${opt === it.correct_answer ? "bg-green-50 text-green-800 font-medium" : "bg-gray-50 text-gray-600"}`}>
                        {String.fromCharCode(65 + oi)}. {opt}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between px-6 py-4 border-t border-gray-100">
            <button onClick={() => setStep(2)} className="flex items-center gap-2 px-5 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <div className="flex items-center gap-2">
              {!isBooks && (
                <button onClick={runPreview} disabled={generating} className="px-5 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                  {generating ? "Regenerating…" : "Regenerate"}
                </button>
              )}
              <button onClick={() => setStep(4)} className="flex items-center gap-2 px-5 py-2.5 bg-navy-900 text-white rounded-lg text-sm font-medium hover:bg-navy-800">
                Continue to Review <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 4: Review ───────────────────────────────────────────────── */}
      {step === 4 && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">Review — {selectedCount} of {items.length} approved</h3>
                <p className="text-sm text-gray-500">Approve, edit, or reject each item before publishing</p>
              </div>
              {!health?.online && (
                <span title="AI engine offline">
                  <Cpu className="w-4 h-4 text-gray-300" />
                </span>
              )}
            </div>
            <div className="divide-y divide-gray-200 max-h-[32rem] overflow-y-auto">
              {items.map((it, idx) => (
                <div key={idx} className={`p-6 ${it.selected ? "" : "opacity-50"}`}>
                  <div className="flex items-start gap-4">
                    <div className="flex flex-col gap-2 flex-shrink-0 mt-0.5">
                      <button onClick={() => updateItem(idx, { selected: !it.selected })} title={it.selected ? "Approved — click to reject" : "Rejected — click to approve"}>
                        {it.selected ? <CheckCircle2 className="h-6 w-6 text-green-600" /> : <XCircle className="h-6 w-6 text-gray-300" />}
                      </button>
                      <button onClick={() => updateItem(idx, { editing: !it.editing })} title="Edit">
                        <Pencil className={`h-5 w-5 ${it.editing ? "text-admin-accent" : "text-gray-400 hover:text-admin-accent"}`} />
                      </button>
                    </div>
                    <div className="flex-1 min-w-0">
                      {it.editing ? (
                        <div className="space-y-3">
                          <textarea
                            rows={2}
                            value={it.question}
                            onChange={(e) => updateItem(idx, { question: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-admin-accent"
                          />
                          {contentKind === "questions" ? (
                            it.options.map((opt, oi) => (
                              <div key={oi} className="flex items-center gap-2">
                                <input type="radio" name={`correct-${idx}`} checked={opt === it.correct_answer} onChange={() => updateItem(idx, { correct_answer: opt })} />
                                <input type="text" value={opt} onChange={(e) => updateOption(idx, oi, e.target.value)} className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm" />
                              </div>
                            ))
                          ) : (
                            <textarea
                              rows={contentKind === "flashcards" ? 2 : 6}
                              value={it.answer || ""}
                              onChange={(e) => updateItem(idx, { answer: e.target.value })}
                              placeholder={contentKind === "flashcards" ? "Back of the card" : "Lesson body"}
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                            />
                          )}
                          <textarea
                            rows={2}
                            value={it.explanation || ""}
                            onChange={(e) => updateItem(idx, { explanation: e.target.value })}
                            placeholder="Explanation (optional)"
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                          />
                          <button onClick={() => updateItem(idx, { editing: false })} className="px-3 py-1.5 bg-navy-900 text-white rounded-lg text-sm font-medium hover:bg-navy-800">
                            Done Editing
                          </button>
                        </div>
                      ) : (
                        <>
                          <p className="font-medium text-gray-900 mb-3">{it.question}</p>
                          {it.options.length > 0 && (
                            <ul className="space-y-1.5 mb-3">
                              {it.options.map((opt, oi) => (
                                <li key={oi} className={`text-sm px-3 py-1.5 rounded-lg ${opt === it.correct_answer ? "bg-green-50 text-green-800 font-medium" : "bg-gray-50 text-gray-700"}`}>
                                  {String.fromCharCode(65 + oi)}. {opt}
                                </li>
                              ))}
                            </ul>
                          )}
                          {contentKind !== "questions" && it.answer && (
                            <p className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2 mb-3 whitespace-pre-wrap">{it.answer}</p>
                          )}
                          {it.explanation && (
                            <p className="text-sm text-gray-600 bg-navy-900/[0.03] rounded-lg px-3 py-2 mb-3">
                              <span className="font-medium">Explanation: </span>{it.explanation}
                            </p>
                          )}
                        </>
                      )}
                      <div className="flex items-center gap-3 mt-2">
                        <select value={it.category} onChange={(e) => updateItem(idx, { category: e.target.value })} className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-700">
                          {CATEGORIES.map((c) => <option key={c} value={c}>{titleCase(c)}</option>)}
                        </select>
                        <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-600 capitalize">{it.difficulty || difficulty}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-between">
            <button onClick={() => setStep(3)} className="flex items-center gap-2 px-5 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <button
              onClick={() => setStep(5)}
              disabled={selectedCount === 0}
              className="flex items-center gap-2 px-5 py-2.5 bg-navy-900 text-white rounded-lg text-sm font-medium hover:bg-navy-800 disabled:opacity-40"
            >
              Next <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Step 5: Submit ───────────────────────────────────────────────── */}
      {step === 5 && !success && (
        <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-6">
          <h3 className="font-semibold text-gray-900 mb-1">
            {isBooks ? "Publish" : "Submit for Review"}
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            {isBooks
              ? `Publishing ${selectedCount} item(s) directly — Books are pre-authored reference material, not AI output.`
              : `Staging ${selectedCount} item(s) in AI Review Center. Nothing goes live until it's approved and published there.` +
                (contentKind === "questions" ? " Optionally earmark for specific colleges below — leave empty for global." : "")}
          </p>
          {colleges.length > 0 && !isBooks && contentKind === "questions" && (
            <div className="flex flex-wrap gap-3 mb-6">
              {colleges.map((c) => (
                <label key={c.id} className={`flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer text-sm ${assignedColleges.has(c.id) ? "border-admin-accent bg-navy-900/[0.06] text-navy-900" : "border-gray-200 text-gray-700 hover:bg-gray-50"}`}>
                  <input type="checkbox" checked={assignedColleges.has(c.id)} onChange={() => toggleCollege(c.id)} />
                  {c.name}
                </label>
              ))}
            </div>
          )}
          <div className="flex justify-between">
            <button onClick={() => setStep(4)} className="flex items-center gap-2 px-5 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {submitting
                ? (isBooks ? "Publishing…" : "Submitting…")
                : isBooks
                  ? `Publish ${selectedCount} Item(s)`
                  : `Submit ${selectedCount} Item(s) for Review`}
            </button>
          </div>
        </div>
      )}

      {/* ── Success ──────────────────────────────────────────────────────── */}
      {success && (
        <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-10 text-center">
          <PartyPopper className="w-10 h-10 text-admin-accent mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900">
            {isBooks ? "Published!" : "Submitted for review!"}
          </h3>
          <p className="text-gray-500 mt-1">
            {isBooks
              ? `${done?.imported ?? 0} item(s) are now live in the Knowledge Library.`
              : `${done?.imported ?? 0} item(s) are staged in AI Review Center — nothing is live until they're approved and published there.`}
          </p>
          <div className="flex items-center justify-center gap-3 mt-6">
            <a
              href={isBooks ? "/app/superadmin/knowledge-library" : "/app/superadmin/learning-companion/review"}
              className="px-5 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {isBooks ? "Open Knowledge Library" : "Open AI Review Center"}
            </a>
            <button onClick={startOver} className="px-5 py-2.5 bg-navy-900 text-white rounded-lg text-sm font-medium hover:bg-navy-800">
              Start Another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
