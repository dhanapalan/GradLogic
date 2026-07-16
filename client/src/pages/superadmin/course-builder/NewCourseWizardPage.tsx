// =============================================================================
// New Course Wizard — details → modules → (shell) practice/assessment → draft
// Assembles structure only; Knowledge attach fully wired in Increment 2.
// =============================================================================

import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, GripVertical, Plus, Trash2, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import WizardStepper from "../../../components/superadmin/course-builder/WizardStepper";
import courseBuilderService, {
  COURSE_BUILDER_BASE as BASE,
  PHASE1_DOMAINS,
} from "../../../services/courseBuilderService";

const STEPS = [
  "Course Details",
  "Modules",
  "Attach Knowledge",
  "Practice",
  "Assessment",
  "Review",
] as const;

const DEFAULT_MODULES: Record<string, string[]> = {
  aptitude: ["Numbers", "Percentages", "Profit & Loss", "Time & Work", "Data Interpretation"],
  reasoning: ["Series", "Coding-Decoding", "Syllogism", "Blood Relations", "Puzzles"],
  python_coding: ["Introduction", "Variables", "Loops", "Functions", "OOP", "Projects"],
  java_coding: ["Introduction", "OOP Basics", "Collections", "Exceptions", "Projects"],
  data_science: ["AI Fundamentals", "Python for ML", "Supervised Learning", "Evaluation", "Projects"],
};

export default function NewCourseWizardPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>(PHASE1_DOMAINS[0].value);
  const [subject, setSubject] = useState("");
  const [difficulty, setDifficulty] = useState("beginner");
  const [durationHours, setDurationHours] = useState("");
  const [language, setLanguage] = useState("en");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [description, setDescription] = useState("");

  const [modules, setModules] = useState<string[]>(DEFAULT_MODULES.aptitude);

  const [passingPercent, setPassingPercent] = useState(60);
  const [attempts, setAttempts] = useState(3);

  const canNext = useMemo(() => {
    if (step === 0) return Boolean(title.trim() && category);
    if (step === 1) return modules.some((m) => m.trim());
    return true;
  }, [step, title, category, modules]);

  const applyDomainDefaults = (domain: string) => {
    setCategory(domain);
    setModules(DEFAULT_MODULES[domain] || ["Module 1"]);
    const label = PHASE1_DOMAINS.find((d) => d.value === domain)?.label || "";
    if (!subject.trim()) setSubject(label);
  };

  const addModule = () => setModules((m) => [...m, `Module ${m.length + 1}`]);
  const removeModule = (idx: number) => setModules((m) => m.filter((_, i) => i !== idx));
  const updateModule = (idx: number, value: string) =>
    setModules((m) => m.map((t, i) => (i === idx ? value : t)));

  const moveModule = (idx: number, dir: -1 | 1) => {
    setModules((m) => {
      const next = [...m];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return m;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  };

  const finish = async () => {
    const cleanModules = modules.map((m) => m.trim()).filter(Boolean);
    if (!title.trim() || !category || cleanModules.length === 0) {
      toast.error("Title, category, and at least one module are required");
      return;
    }
    setSaving(true);
    try {
      const hours = durationHours ? Number(durationHours) : undefined;
      const course = await courseBuilderService.createCourse({
        title: title.trim(),
        description: description.trim() || undefined,
        category,
        subject: subject.trim() || undefined,
        difficulty,
        duration_hours: hours && !Number.isNaN(hours) ? hours : undefined,
        estimated_minutes: hours && !Number.isNaN(hours) ? Math.round(hours * 60) : undefined,
        language,
        thumbnail_url: thumbnailUrl.trim() || undefined,
        tags: ["course-builder", "phase-1", `pass:${passingPercent}`, `attempts:${attempts}`],
      });

      for (let i = 0; i < cleanModules.length; i++) {
        await courseBuilderService.createModule(course.id, {
          title: cleanModules[i],
          sort_order: i,
        });
      }

      await courseBuilderService.updateAssessmentConfig(course.id, {
        passing_percent: passingPercent,
        attempts,
        min_practice_per_module: 3,
        require_assessment: true,
      });

      toast.success("Draft course created — ready for Knowledge Library mapping");
      navigate(`${BASE}/${course.id}`);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        "Failed to create course";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <Link to={BASE} className="text-xs text-admin-accent hover:underline">
          ← Course Builder
        </Link>
        <h2 className="mt-2 text-xl font-semibold text-gray-900">New Course</h2>
        <p className="text-sm text-gray-500 mt-1">
          Structure a placement-prep course, then attach Knowledge Library assets. Content is not
          authored in this wizard.
        </p>
      </div>

      <WizardStepper steps={STEPS} current={step} />

      <div className="rounded-xl border border-gray-200/70 bg-white p-5 shadow-admin-card space-y-4">
        {step === 0 && (
          <>
            <label className="block">
              <span className="text-xs font-medium text-gray-600">Course name</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                placeholder="e.g. Python Programming for Placement"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-600">Category (Phase-1)</span>
              <select
                value={category}
                onChange={(e) => applyDomainDefaults(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              >
                {PHASE1_DOMAINS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-600">Subject</span>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                placeholder="e.g. Python"
              />
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-medium text-gray-600">Difficulty</span>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-gray-600">Duration (hours)</span>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={durationHours}
                  onChange={(e) => setDurationHours(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  placeholder="20"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-gray-600">Language</span>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                >
                  <option value="en">English</option>
                  <option value="hi">Hindi</option>
                  <option value="ta">Tamil</option>
                  <option value="te">Telugu</option>
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-gray-600">Thumbnail URL</span>
                <input
                  value={thumbnailUrl}
                  onChange={(e) => setThumbnailUrl(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  placeholder="https://…"
                />
              </label>
            </div>
            <label className="block">
              <span className="text-xs font-medium text-gray-600">Description</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                placeholder="What students will achieve…"
              />
            </label>
          </>
        )}

        {step === 1 && (
          <>
            <p className="text-sm text-gray-500">
              Choose modules for this course. You will attach Knowledge Library assets next.
            </p>
            <ul className="space-y-2">
              {modules.map((m, idx) => (
                <li key={idx} className="flex items-center gap-2">
                  <button
                    type="button"
                    className="p-1 text-gray-400 hover:text-gray-700"
                    title="Move up"
                    onClick={() => moveModule(idx, -1)}
                  >
                    <GripVertical className="w-4 h-4" />
                  </button>
                  <input
                    value={m}
                    onChange={(e) => updateModule(idx, e.target.value)}
                    className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => removeModule(idx)}
                    className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg"
                    aria-label="Remove module"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={addModule}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-navy-900 hover:underline"
            >
              <Plus className="w-4 h-4" />
              Add module
            </button>
          </>
        )}

        {step === 2 && (
          <div className="space-y-2 text-sm text-gray-600">
            <p className="font-medium text-gray-800">Attach Knowledge</p>
            <p>
              After you save the draft, the Module Builder lets you search the Knowledge Library and
              attach lessons, flashcards, questions, coding challenges, and voice by role — without
              creating new content.
            </p>
            <p className="text-xs text-gray-400">Continue to set practice/assessment defaults, then save.</p>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-2 text-sm text-gray-600">
            <p className="font-medium text-gray-800">Practice mapping</p>
            <p>
              In Module Builder, map MCQs, coding challenges, and flashcards with Practice /
              Coding roles. Publish requires a minimum number of practice items per module.
            </p>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Assessment defaults (saved on the draft). Refine kinds and gates in Module Builder.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-medium text-gray-600">Passing %</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={passingPercent}
                  onChange={(e) => setPassingPercent(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-gray-600">Attempts</span>
                <input
                  type="number"
                  min={1}
                  value={attempts}
                  onChange={(e) => setAttempts(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </label>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-3 text-sm">
            <p className="font-medium text-gray-800">Review & save as draft</p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-gray-600">
              <dt className="text-gray-400">Name</dt>
              <dd>{title || "—"}</dd>
              <dt className="text-gray-400">Domain</dt>
              <dd>{PHASE1_DOMAINS.find((d) => d.value === category)?.label}</dd>
              <dt className="text-gray-400">Subject</dt>
              <dd>{subject || "—"}</dd>
              <dt className="text-gray-400">Difficulty</dt>
              <dd className="capitalize">{difficulty}</dd>
              <dt className="text-gray-400">Modules</dt>
              <dd>{modules.filter((m) => m.trim()).length}</dd>
              <dt className="text-gray-400">Pass / attempts</dt>
              <dd>
                {passingPercent}% · {attempts}
              </dd>
            </dl>
            <p className="text-xs text-gray-400">
              Status stays <strong>draft</strong>. Publish is a separate Review workflow.
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          disabled={step === 0 || saving}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm disabled:opacity-40"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>
        {step < STEPS.length - 1 ? (
          <button
            type="button"
            disabled={!canNext}
            onClick={() => setStep((s) => s + 1)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-navy-900 px-4 py-2 text-sm font-medium text-white hover:bg-navy-800 disabled:opacity-40"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="button"
            disabled={saving || !canNext}
            onClick={finish}
            className="inline-flex items-center gap-1.5 rounded-lg bg-navy-900 px-4 py-2 text-sm font-medium text-white hover:bg-navy-800 disabled:opacity-40"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Save draft
          </button>
        )}
      </div>
    </div>
  );
}
