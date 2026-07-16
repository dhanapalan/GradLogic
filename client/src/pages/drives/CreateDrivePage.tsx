import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, useLocation, Link } from "react-router";
import {
    Calendar,
    Rocket,
    ClipboardList,
    Loader2,
    Clock,
    RefreshCw,
    Shield,
    ArrowLeft,
    Layers,
    Shuffle,
    Send,
} from "lucide-react";
import api from "../../lib/api";
import toast from "react-hot-toast";
import questionCollectionsService, {
    type QuestionCollection,
} from "../../services/questionCollectionsService";
import { isPhase1BankCategory } from "../../lib/phase1PlacementDomains";

interface Rule {
    id: string;
    name: string;
    version: number;
    duration_minutes?: number;
    total_questions?: number;
    proctoring_mode?: string;
    attempt_limit?: number;
    overall_cutoff?: number | null;
    negative_marking_enabled?: boolean;
    negative_marking_value?: number | null;
    difficulty_distribution?: unknown;
}

export default function CreateDrivePage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const location = useLocation();
    const BASE = location.pathname.startsWith("/app/superadmin") ? "/app/superadmin/drives" : "/app/drives";
    const isHub = location.pathname.startsWith("/app/superadmin");
    const initialRuleId = searchParams.get("rule_id");
    const initialCollectionId = searchParams.get("collection_id");
    const initialDriveType = searchParams.get("drive_type") as
        | "hiring"
        | "practice_test"
        | "mock_test"
        | "coding_assessment"
        | null;
    const initialAttemptLimit = searchParams.get("attempt_limit");
    const initialShuffle = searchParams.get("shuffle");
    const initialAutoSubmit = searchParams.get("auto_submit");
    const initialName = searchParams.get("name") || "";

    const [rules, setRules] = useState<Rule[]>([]);
    const [collections, setCollections] = useState<QuestionCollection[]>([]);
    const [loadingRules, setLoadingRules] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [selectedCollections, setSelectedCollections] = useState<string[]>(
        initialCollectionId ? [initialCollectionId] : []
    );

    const DRIVE_TYPES = [
        "hiring",
        "practice_test",
        "mock_test",
        "coding_assessment",
    ] as const;
    type DriveTypeOption = (typeof DRIVE_TYPES)[number];

    const resolvedDriveType = (initialDriveType &&
        (DRIVE_TYPES as readonly string[]).includes(initialDriveType)
            ? initialDriveType
            : "hiring") as DriveTypeOption;

    const [formData, setFormData] = useState({
        name: initialName,
        rule_id: initialRuleId || "",
        drive_type: resolvedDriveType,
        duration_minutes: "",
        attempt_limit:
            initialAttemptLimit ||
            (resolvedDriveType === "practice_test" ? "99" : "1"),
        proctoring_mode:
            resolvedDriveType === "practice_test" ? "none" : "standard",
        scheduled_start: "",
        scheduled_end: "",
        max_applicants: "500",
        shuffle_questions:
            initialShuffle === "1" ||
            initialShuffle === "true" ||
            resolvedDriveType === "practice_test" ||
            resolvedDriveType === "mock_test",
        auto_submit:
            initialAutoSubmit === "0" || initialAutoSubmit === "false"
                ? false
                : true,
    });

    const selectedRule = rules.find((r) => r.id === formData.rule_id);

    useEffect(() => {
        if (selectedRule) {
            setFormData((prev) => ({
                ...prev,
                duration_minutes: String(selectedRule.duration_minutes || 60),
                proctoring_mode: selectedRule.proctoring_mode || "standard",
                attempt_limit: String(selectedRule.attempt_limit || 1),
            }));
        }
    }, [selectedRule?.id]);

    useEffect(() => {
        const fetchRules = async () => {
            setLoadingRules(true);
            try {
                const res = await api.get("/assessment-rules");
                const all = (res.data.data || []) as Rule[];
                // Prefer active templates; fall back to published rules so Builder stays usable.
                const preferred = all.filter((r: Rule & { status?: string }) =>
                    ["active_template", "published", "active"].includes(
                        String((r as { status?: string }).status || "").toLowerCase()
                    )
                );
                setRules(preferred.length ? preferred : all);
            } catch {
                toast.error("Failed to load assessment rules");
            } finally {
                setLoadingRules(false);
            }
        };
        void fetchRules();
        questionCollectionsService
            .list()
            .then(setCollections)
            .catch(() => {/* non-blocking */});
    }, []);

    const toggleCollection = (id: string) => {
        setSelectedCollections((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.rule_id) {
            toast.error("Name and Rule are required");
            return;
        }
        if (isHub && selectedCollections.length === 0) {
            toast.error("Select at least one Question Collection to assemble the assessment");
            return;
        }
        setSubmitting(true);
        try {
            const phase1Collections = collections.filter((c) =>
                selectedCollections.includes(c.id)
            );
            const sections = phase1Collections.map((c) => ({
                collection_id: c.id,
                section_name: c.name,
            }));
            const res = await api.post("/drives", {
                name: formData.name,
                rule_id: formData.rule_id,
                drive_type: formData.drive_type,
                duration_minutes: formData.duration_minutes
                    ? parseInt(formData.duration_minutes, 10)
                    : undefined,
                attempt_limit: formData.attempt_limit
                    ? parseInt(formData.attempt_limit, 10)
                    : 1,
                proctoring_mode: formData.proctoring_mode,
                scheduled_start: formData.scheduled_start || undefined,
                scheduled_end: formData.scheduled_end || undefined,
                max_applicants: formData.max_applicants
                    ? parseInt(formData.max_applicants, 10)
                    : 500,
                shuffle_questions: formData.shuffle_questions,
                auto_submit: formData.auto_submit,
                collection_ids: selectedCollections,
                sections,
                // Hub Builder is assemble-only — never AI-generate questions
                auto_generate_pool: isHub ? false : selectedCollections.length === 0,
            });
            const driveId = res.data?.data?.id;
            toast.success(
                selectedCollections.length > 0
                    ? "Assessment assembled from Question Collections — review pool to approve"
                    : "Assessment created"
            );
            navigate(driveId ? `${BASE}/${driveId}?tab=pool` : BASE);
        } catch (error: unknown) {
            const msg =
                (error as { response?: { data?: { error?: string } } })?.response?.data
                    ?.error || "Failed to create assessment";
            toast.error(msg);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className={`min-h-screen ${isHub ? "bg-slate-50/80" : "bg-slate-50"}`}>
            <div className={isHub ? "border-b border-gray-200/80 bg-white" : "bg-indigo-600 px-8 py-8"}>
                <div className={isHub ? "max-w-3xl mx-auto px-4 sm:px-6 pt-5 pb-5" : "max-w-3xl mx-auto"}>
                    <button
                        type="button"
                        onClick={() => navigate(BASE)}
                        className={`flex items-center gap-2 text-sm font-medium mb-3 transition-colors ${
                            isHub ? "text-gray-500 hover:text-gray-800" : "text-indigo-200 hover:text-white font-bold"
                        }`}
                    >
                        <ArrowLeft className="h-4 w-4" /> Back to Assessment Builder
                    </button>
                    {isHub ? (
                        <>
                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                                Assessment Hub · Builder
                            </p>
                            <h1 className="mt-1 text-xl sm:text-2xl font-semibold text-gray-900 flex items-center gap-2">
                                <Rocket className="h-6 w-6 text-navy-900" /> New assessment
                            </h1>
                            <p className="mt-1 text-sm text-gray-500">
                                Assemble from Question Collections + Templates — sections, difficulty
                                mix, shuffle, preview, then publish. Does not create bank questions.
                            </p>
                        </>
                    ) : (
                        <>
                            <h1 className="text-3xl font-black text-white flex items-center gap-3">
                                <Rocket className="h-7 w-7" /> Launch New Drive
                            </h1>
                            <p className="text-indigo-200 text-sm font-medium mt-1 uppercase tracking-wider">
                                Initialize Recruitment Instance
                            </p>
                        </>
                    )}
                </div>
            </div>

            <div className="max-w-3xl mx-auto px-4 sm:px-8 py-8">
                <form onSubmit={(e) => void handleSubmit(e)}>
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 sm:p-8 space-y-8">
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                                Assessment name
                            </label>
                            <input
                                type="text"
                                required
                                placeholder="e.g. Python Basics Practice"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="w-full py-3 px-4 text-slate-900 font-semibold placeholder:text-slate-300 border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                                Test type
                            </label>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {(
                                    [
                                        { value: "hiring", label: "Hiring" },
                                        { value: "practice_test", label: "Practice" },
                                        { value: "mock_test", label: "Mock Test" },
                                        { value: "coding_assessment", label: "Coding" },
                                    ] as const
                                ).map((opt) => (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() =>
                                            setFormData({
                                                ...formData,
                                                drive_type: opt.value,
                                                ...(opt.value === "practice_test"
                                                    ? {
                                                          attempt_limit:
                                                              formData.attempt_limit === "1"
                                                                  ? "99"
                                                                  : formData.attempt_limit,
                                                          proctoring_mode: "none",
                                                          shuffle_questions: true,
                                                          auto_submit: true,
                                                      }
                                                    : opt.value === "mock_test"
                                                      ? {
                                                            attempt_limit: "1",
                                                            proctoring_mode: "standard",
                                                            shuffle_questions: true,
                                                            auto_submit: true,
                                                        }
                                                      : opt.value === "coding_assessment"
                                                        ? {
                                                              attempt_limit: "1",
                                                              proctoring_mode: "standard",
                                                              shuffle_questions: false,
                                                              auto_submit: true,
                                                          }
                                                        : {}),
                                            })
                                        }
                                        className={`py-3 px-3 rounded-xl text-sm font-semibold border transition-colors ${
                                            formData.drive_type === opt.value
                                                ? "bg-navy-900 text-white border-navy-900"
                                                : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                                        }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest">
                                    Question Collections {isHub ? "*" : ""}
                                </label>
                                <Link
                                    to="/app/superadmin/question-collections"
                                    className="text-xs text-admin-accent hover:underline"
                                >
                                    Manage collections
                                </Link>
                            </div>
                            <p className="text-xs text-slate-500 mb-3">
                                Each selected collection becomes one <strong>section</strong>. Pool is
                                assembled from bank IDs only — no new questions.
                            </p>
                            {collections.filter((c) => isPhase1BankCategory(c.category)).length === 0 ? (
                                <p className="text-sm text-slate-400 rounded-xl border border-dashed border-slate-200 p-4">
                                    No Phase-1 collections yet.{" "}
                                    <Link to="/app/superadmin/question-collections" className="text-admin-accent">
                                        Seed Placement Preparation Phase-1
                                    </Link>
                                    .
                                </p>
                            ) : (
                                <ul className="max-h-48 overflow-y-auto space-y-2 rounded-xl border border-slate-200 p-3">
                                    {collections
                                        .filter((c) => isPhase1BankCategory(c.category))
                                        .map((c) => {
                                        const on = selectedCollections.includes(c.id);
                                        return (
                                            <li key={c.id}>
                                                <label className="flex items-center gap-3 cursor-pointer text-sm">
                                                    <input
                                                        type="checkbox"
                                                        checked={on}
                                                        onChange={() => toggleCollection(c.id)}
                                                        className="rounded border-slate-300"
                                                    />
                                                    <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                    <span className="font-medium text-slate-800 flex-1 truncate">
                                                        {c.name}
                                                    </span>
                                                    <span className="text-[10px] uppercase tracking-wide text-slate-400 shrink-0">
                                                        Section
                                                    </span>
                                                    <span className="text-xs text-slate-400 tabular-nums">
                                                        {c.question_count} Q
                                                    </span>
                                                </label>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                            {selectedCollections.length > 0 ? (
                                <div className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50/50 p-3">
                                    <p className="text-xs font-semibold text-indigo-900 mb-1.5">
                                        Sections ({selectedCollections.length})
                                    </p>
                                    <ol className="space-y-1">
                                        {collections
                                            .filter((c) => selectedCollections.includes(c.id))
                                            .map((c, i) => (
                                                <li
                                                    key={c.id}
                                                    className="text-xs text-indigo-800 flex gap-2"
                                                >
                                                    <span className="tabular-nums text-indigo-400">
                                                        {i + 1}.
                                                    </span>
                                                    {c.name}
                                                    <span className="text-indigo-500/80">
                                                        · {c.question_count} from bank
                                                    </span>
                                                </li>
                                            ))}
                                    </ol>
                                </div>
                            ) : null}
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                                Assessment rule (template)
                            </label>
                            <div className="relative">
                                <ClipboardList className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <select
                                    required
                                    value={formData.rule_id}
                                    onChange={(e) =>
                                        setFormData({ ...formData, rule_id: e.target.value })
                                    }
                                    disabled={loadingRules || !!initialRuleId}
                                    className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none appearance-none disabled:bg-slate-100"
                                    aria-label="Assessment Rule"
                                >
                                    <option value="" disabled>
                                        Select an assessment rule…
                                    </option>
                                    {rules.map((r) => (
                                        <option key={r.id} value={r.id}>
                                            {r.name} (v{r.version})
                                        </option>
                                    ))}
                                </select>
                                {loadingRules && (
                                    <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-indigo-500 animate-spin" />
                                )}
                            </div>
                            {selectedRule ? (
                                <div className="mt-3 rounded-xl bg-slate-50 border border-slate-100 p-3 text-xs text-slate-600 space-y-1">
                                    <p className="font-semibold text-slate-800">Rules summary</p>
                                    <p>
                                        Timer: <strong>{selectedRule.duration_minutes || 60} min</strong> ·
                                        Questions: <strong>{selectedRule.total_questions || 30}</strong>
                                    </p>
                                    <p>
                                        Pass %:{" "}
                                        <strong>
                                            {selectedRule.overall_cutoff != null
                                                ? `${selectedRule.overall_cutoff}`
                                                : "—"}
                                        </strong>
                                        {" · "}
                                        Negative marking:{" "}
                                        <strong>
                                            {selectedRule.negative_marking_enabled
                                                ? selectedRule.negative_marking_value ?? "on"
                                                : "off"}
                                        </strong>
                                    </p>
                                    <p>
                                        Difficulty mix:{" "}
                                        <strong>
                                            {(() => {
                                                const d = selectedRule.difficulty_distribution as
                                                    | Record<string, number>
                                                    | null
                                                    | undefined;
                                                if (!d || typeof d !== "object") return "30% / 50% / 20% (default)";
                                                const e = d.easy ?? d.Easy ?? 30;
                                                const m = d.medium ?? d.Medium ?? 50;
                                                const h = d.hard ?? d.Hard ?? 20;
                                                return `Easy ${e}% · Medium ${m}% · Hard ${h}%`;
                                            })()}
                                        </strong>
                                    </p>
                                    <p className="text-slate-500">
                                        Mix is applied when sampling from the selected collections.
                                    </p>
                                    <div className="flex flex-wrap gap-3 mt-1">
                                        <Link
                                            to={
                                                isHub
                                                    ? "/app/superadmin/assessment-templates"
                                                    : "/app/assessment-rules"
                                            }
                                            className="text-admin-accent hover:underline"
                                        >
                                            Assessment Templates →
                                        </Link>
                                        <Link
                                            to="/app/assessment-rules"
                                            className="text-admin-accent hover:underline"
                                        >
                                            Edit rule →
                                        </Link>
                                    </div>
                                </div>
                            ) : null}
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                                    Duration (min)
                                </label>
                                <div className="relative">
                                    <Clock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                    <input
                                        type="number"
                                        min={1}
                                        max={600}
                                        placeholder="60"
                                        value={formData.duration_minutes}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                duration_minutes: e.target.value,
                                            })
                                        }
                                        className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold outline-none"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                                    Attempts
                                </label>
                                <div className="relative">
                                    <RefreshCw className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                    <input
                                        type="number"
                                        min={1}
                                        max={10}
                                        value={formData.attempt_limit}
                                        onChange={(e) =>
                                            setFormData({ ...formData, attempt_limit: e.target.value })
                                        }
                                        className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold outline-none"
                                        placeholder="1"
                                    />
                                </div>
                            </div>
                        </div>

                        <label className="flex items-center gap-3 cursor-pointer rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                            <input
                                type="checkbox"
                                checked={formData.shuffle_questions}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        shuffle_questions: e.target.checked,
                                    })
                                }
                                className="rounded border-slate-300"
                            />
                            <Shuffle className="w-4 h-4 text-slate-500" />
                            <div>
                                <p className="text-sm font-semibold text-slate-800">Shuffle questions</p>
                                <p className="text-xs text-slate-500">
                                    Randomize order for each student (randomization step).
                                </p>
                            </div>
                        </label>

                        <label className="flex items-center gap-3 cursor-pointer rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                            <input
                                type="checkbox"
                                checked={formData.auto_submit}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        auto_submit: e.target.checked,
                                    })
                                }
                                className="rounded border-slate-300"
                            />
                            <Send className="w-4 h-4 text-slate-500" />
                            <div>
                                <p className="text-sm font-semibold text-slate-800">Auto submit</p>
                                <p className="text-xs text-slate-500">
                                    Recommended for mocks — submit when the full timer expires.
                                </p>
                            </div>
                        </label>

                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                                Proctoring
                            </label>
                            <div className="relative">
                                <Shield className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <select
                                    value={formData.proctoring_mode}
                                    onChange={(e) =>
                                        setFormData({ ...formData, proctoring_mode: e.target.value })
                                    }
                                    className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold outline-none appearance-none"
                                    aria-label="Proctoring Mode"
                                >
                                    <option value="none">None</option>
                                    <option value="standard">
                                        Standard (webcam + tab switch detection)
                                    </option>
                                    <option value="strict">Strict (full AI proctoring)</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                                    Starts
                                </label>
                                <div className="relative">
                                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                                    <input
                                        type="datetime-local"
                                        value={formData.scheduled_start}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                scheduled_start: e.target.value,
                                            })
                                        }
                                        className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold outline-none"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                                    Ends
                                </label>
                                <div className="relative">
                                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                                    <input
                                        type="datetime-local"
                                        value={formData.scheduled_end}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                scheduled_end: e.target.value,
                                            })
                                        }
                                        className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold outline-none"
                                    />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                                Max applicants
                            </label>
                            <input
                                type="number"
                                min={1}
                                value={formData.max_applicants}
                                onChange={(e) =>
                                    setFormData({ ...formData, max_applicants: e.target.value })
                                }
                                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold outline-none"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={submitting || (isHub && selectedCollections.length === 0)}
                            className="w-full py-3.5 rounded-xl bg-navy-900 text-white font-semibold hover:bg-navy-800 disabled:opacity-50"
                        >
                            {submitting
                                ? isHub
                                    ? "Assembling…"
                                    : "Creating…"
                                : isHub || selectedCollections.length > 0
                                  ? "Assemble assessment from collections"
                                  : "Create · AI generate pool"}
                        </button>
                        <p className="text-center text-xs text-slate-400">
                            {isHub
                                ? "Next: Preview the assembled pool → Approve → Ready → Schedule → Publish. No questions are AI-generated."
                                : "Next: review pool on the drive detail → Ready → Schedule → Publish."}
                        </p>
                    </div>
                </form>
            </div>
        </div>
    );
}
