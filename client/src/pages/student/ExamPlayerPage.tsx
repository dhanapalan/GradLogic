import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect, useCallback, useRef } from "react";
import { useProctoring } from "../../hooks/useProctoring";
import api from "../../lib/api";
import {
    Clock,
    Flag,
    ChevronLeft,
    ChevronRight,
    Send,
    AlertTriangle,
    CheckCircle2,
    XCircle,
    Eraser,
    VideoOff
} from "lucide-react";

import { useWebcamProctoring } from "../../hooks/useWebcamProctoring";

// ── Types ────────────────────────────────────────────────────────────────────

interface Question {
    id: string;
    category: string;
    type: string;
    difficulty_level: string;
    question_text: string;
    options: { label: string; text: string }[];
    marks: number;
    sort_order: number;
}

interface SessionData {
    session_id: string;
    drive_id: string;
    student_id: string;
    paper_id: string;
    status: string;
    current_question_index: number;
    saved_answers: Record<string, { selected: string[]; flagged?: boolean }>;
    time_remaining_seconds: number;
    drive_name: string;
    drive_type?: string;
    duration_minutes: number;
    total_questions: number;
    total_marks: number;
    negative_marking_enabled: boolean;
    negative_marking_value: number | null;
    overall_cutoff: number;
    score: number | null;
    completed_at: string | null;
    section_timers?: Array<{ section_name: string; time_limit_minutes: number }>;
}

function matchSectionTimer(
    category: string | undefined,
    timers: Array<{ section_name: string; time_limit_minutes: number }> | undefined,
) {
    if (!category || !timers?.length) return null;
    const norm = (s: string) => s.toLowerCase().replace(/[_-]+/g, " ").trim();
    const cat = norm(category);
    return (
        timers.find((t) => {
            const name = norm(t.section_name);
            return name === cat || name.includes(cat) || cat.includes(name);
        }) || null
    );
}

// ── Component ────────────────────────────────────────────────────────────────

export default function ExamPlayerPage() {
    const { driveId } = useParams<{ driveId: string }>();
    const navigate = useNavigate();

    // Mobile responsive state
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 768);

    // Handle window resize
    useEffect(() => {
        const handleResize = () => {
            const mobile = window.innerWidth < 768;
            setIsMobile(mobile);
            if (mobile && sidebarOpen) {
                setSidebarOpen(false);
            }
        };
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, [sidebarOpen]);

    // State
    const [currentIndex, setCurrentIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<string, { selected: string[]; flagged?: boolean }>>({});
    const [timeLeft, setTimeLeft] = useState(0);
    const [sectionTimeLeft, setSectionTimeLeft] = useState<number | null>(null);
    const [showSubmitModal, setShowSubmitModal] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [violationAlert, setViolationAlert] = useState<string | null>(null);
    const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastSavedRef = useRef<string>("");
    const sectionRemainingRef = useRef<Record<string, number>>({});
    const activeSectionKeyRef = useRef<string | null>(null);
    const prevOverallTimeRef = useRef<number | null>(null);

    // Fetch session + questions
    const { data, isLoading, error } = useQuery({
        queryKey: ["exam-player", driveId],
        queryFn: async () => {
            const { data } = await api.get(`/exam-sessions/${driveId}/session`);
            return data.data as { session: SessionData; questions: Question[] };
        },
        enabled: !!driveId,
        refetchOnWindowFocus: false,
    });

    const session = data?.session;
    const questions = data?.questions || [];
    const isMock = session?.drive_type === "mock_test";

    // Setup regular events proctoring hook (browser events)
    useProctoring({
        sessionId: session?.session_id || "",
        enabled: !!session && !submitted && session.status !== "completed"
    });

    // Setup AI webcam proctoring hook
    const { videoRef, canvasRef, isCameraActive, permissionDenied, retryCamera } = useWebcamProctoring({
        sessionId: session?.session_id || "",
        studentId: session?.student_id || "",
        examId: session?.paper_id || "", // Or driveId if paper_id is not exactly the exam
        enabled: !!session && !submitted && session.status !== "completed",
        onViolation: (result) => {
            // Trigger UI warning when AI flags something
            setViolationAlert(`Warning: ${result.label.replace("_", " ")} detected! Please adhere to exam rules.`);
            setTimeout(() => setViolationAlert(null), 5000);
        }
    });

    // Initialize state from session
    useEffect(() => {
        if (session) {
            setAnswers(session.saved_answers || {});
            setCurrentIndex(session.current_question_index || 0);
            setTimeLeft(session.time_remaining_seconds || 0);
            prevOverallTimeRef.current = null;
            if (session.status === "completed") setSubmitted(true);
        }
    }, [session]);

    // ── Timer ────────────────────────────────────────────────────────────────

    useEffect(() => {
        if (submitted || timeLeft <= 0) return;

        const interval = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(interval);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [submitted, timeLeft > 0]); // eslint-disable-line

    // Auto-submit when overall timer hits zero (countdown finished or server already expired)
    useEffect(() => {
        if (!submitted && session?.status === "in_progress" && timeLeft === 0) {
            const prev = prevOverallTimeRef.current;
            const serverExpired = (session.time_remaining_seconds ?? 0) === 0;
            if (prev === null ? serverExpired : prev > 0) {
                submitMutation.mutate();
            }
        }
        prevOverallTimeRef.current = timeLeft;
    }, [timeLeft, session?.status, session?.time_remaining_seconds]); // eslint-disable-line

    // Section timer (mock tests) — soft enforce: auto-advance when section budget expires
    useEffect(() => {
        if (!isMock || submitted || !session?.section_timers?.length || questions.length === 0) {
            setSectionTimeLeft(null);
            return;
        }
        const q = questions[currentIndex];
        const matched = matchSectionTimer(q?.category, session.section_timers);
        if (!matched) {
            setSectionTimeLeft(null);
            activeSectionKeyRef.current = null;
            return;
        }
        const key = matched.section_name.toLowerCase();
        if (sectionRemainingRef.current[key] == null) {
            sectionRemainingRef.current[key] = matched.time_limit_minutes * 60;
        }
        activeSectionKeyRef.current = key;
        setSectionTimeLeft(sectionRemainingRef.current[key]);

        const interval = setInterval(() => {
            const k = activeSectionKeyRef.current;
            if (!k) return;
            const next = Math.max(0, (sectionRemainingRef.current[k] ?? 0) - 1);
            sectionRemainingRef.current[k] = next;
            setSectionTimeLeft(next);
            if (next === 0) {
                const nextIdx = questions.findIndex((qq, i) => {
                    if (i <= currentIndex) return false;
                    const m = matchSectionTimer(qq.category, session.section_timers);
                    if (!m) return true;
                    const nk = m.section_name.toLowerCase();
                    return nk !== k && (sectionRemainingRef.current[nk] ?? m.time_limit_minutes * 60) > 0;
                });
                if (nextIdx >= 0) {
                    setViolationAlert("Section time ended — moved to the next section.");
                    setTimeout(() => setViolationAlert(null), 4000);
                    setCurrentIndex(nextIdx);
                } else {
                    setViolationAlert("Section time ended. Overall exam timer still running.");
                    setTimeout(() => setViolationAlert(null), 4000);
                }
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [isMock, submitted, session?.section_timers, currentIndex, questions.length]); // eslint-disable-line

    // ── Auto-Save ────────────────────────────────────────────────────────────

    const doAutoSave = useCallback(async () => {
        if (!driveId || submitted) return;
        const payload = {
            saved_answers: answers,
            current_question_index: currentIndex,
            time_remaining_seconds: timeLeft,
        };
        const serialized = JSON.stringify(payload);
        if (serialized === lastSavedRef.current) return;

        try {
            await api.put(`/exam-sessions/${driveId}/save`, payload);
            lastSavedRef.current = serialized;
        } catch {
            // Silent fail — will retry
        }
    }, [driveId, answers, currentIndex, timeLeft, submitted]);

    // Auto-save every 5 seconds
    useEffect(() => {
        if (submitted) return;
        autoSaveTimerRef.current = setInterval(doAutoSave, 5000);
        return () => {
            if (autoSaveTimerRef.current) clearInterval(autoSaveTimerRef.current);
        };
    }, [doAutoSave, submitted]);

    // Save on page unload
    useEffect(() => {
        const handleBeforeUnload = () => doAutoSave();
        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, [doAutoSave]);

    // ── Submit ───────────────────────────────────────────────────────────────

    const submitMutation = useMutation({
        mutationFn: async () => {
            // Final save before submit
            await api.put(`/exam-sessions/${driveId}/save`, {
                saved_answers: answers,
                current_question_index: currentIndex,
                time_remaining_seconds: timeLeft,
            });
            const { data } = await api.post(`/exam-sessions/${driveId}/submit`);
            return data.data;
        },
        onSuccess: () => {
            setSubmitted(true);
            setShowSubmitModal(false);
        },
    });

    const handleSubmit = (isAutoSubmit = false) => {
        if (submitted) return;
        if (isAutoSubmit) {
            submitMutation.mutate();
        } else {
            setShowSubmitModal(true);
        }
    };

    // ── Answer Handlers ──────────────────────────────────────────────────────

    const currentQuestion = questions[currentIndex];

    const handleSelectOption = (questionId: string, optionLabel: string, isMulti: boolean) => {
        setAnswers((prev) => {
            const existing = prev[questionId] || { selected: [], flagged: false };
            let newSelected: string[];

            if (isMulti) {
                // Toggle for multi-select
                if (existing.selected.includes(optionLabel)) {
                    newSelected = existing.selected.filter((s) => s !== optionLabel);
                } else {
                    newSelected = [...existing.selected, optionLabel];
                }
            } else {
                // Single select — replace
                newSelected = [optionLabel];
            }

            return { ...prev, [questionId]: { ...existing, selected: newSelected } };
        });
    };

    const handleClearAnswer = (questionId: string) => {
        setAnswers((prev) => {
            const existing = prev[questionId] || { selected: [], flagged: false };
            return { ...prev, [questionId]: { ...existing, selected: [] } };
        });
    };

    const handleToggleFlag = (questionId: string) => {
        setAnswers((prev) => {
            const existing = prev[questionId] || { selected: [], flagged: false };
            return { ...prev, [questionId]: { ...existing, flagged: !existing.flagged } };
        });
    };

    // ── Helpers ──────────────────────────────────────────────────────────────

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
        return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    };

    const getQuestionStatus = (qId: string) => {
        const a = answers[qId];
        if (!a) return "unanswered";
        if (a.flagged && a.selected.length > 0) return "flagged-answered";
        if (a.flagged) return "flagged";
        if (a.selected.length > 0) return "answered";
        return "unanswered";
    };

    const answeredCount = questions.filter((q) => (answers[q.id]?.selected?.length || 0) > 0).length;
    const flaggedCount = questions.filter((q) => answers[q.id]?.flagged).length;
    const unansweredCount = questions.length - answeredCount;

    // ── Render ───────────────────────────────────────────────────────────────

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="h-12 w-12 mx-auto animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
                    <p className="text-gray-500 font-bold mt-4">Loading exam...</p>
                </div>
            </div>
        );
    }

    if (error || !session || questions.length === 0) {
        const errorMessage = (error as any)?.response?.data?.message || "Could not load exam session.";
        return (
            <div className="flex h-screen items-center justify-center bg-gray-50">
                <div className="text-center px-6">
                    <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-black text-gray-900">Access Denied</h2>
                    <p className="text-gray-500 mt-2 max-w-sm mx-auto">{errorMessage}</p>
                    <button onClick={() => navigate("/app/student-portal")} className="mt-8 px-8 py-3 bg-gray-900 text-white rounded-2xl font-black hover:bg-black shadow-lg shadow-gray-200 transition-all">
                        Back to Portal
                    </button>
                </div>
            </div>
        );
    }

    // Completed view
    if (submitted || session.status === "completed") {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-50">
                <div className="max-w-md w-full bg-white rounded-[2.5rem] p-10 shadow-2xl text-center border border-gray-100">
                    <CheckCircle2 className="h-20 w-20 text-emerald-500 mx-auto mb-6" />
                    <h1 className="text-3xl font-black text-gray-900 mb-2">Exam Submitted</h1>
                    <p className="text-gray-500 font-medium mb-8">{session.drive_name}</p>

                    {(() => {
                        // submitMutation.data is only present when the student just submitted
                        // in this session. For previously-completed sessions fall back to
                        // session.score which is always populated by the server.
                        const displayScore = submitMutation.data?.score ?? session.score;
                        return displayScore !== null && displayScore !== undefined ? (
                            <div className="bg-indigo-50 rounded-2xl p-6 mb-8">
                                <p className="text-sm font-bold text-indigo-600 uppercase tracking-widest mb-1">Your Score</p>
                                <p className="text-4xl font-black text-indigo-600">
                                    {displayScore} <span className="text-lg text-indigo-400">/ {session.total_marks}</span>
                                </p>
                            </div>
                        ) : null;
                    })()}

                    <div className="grid grid-cols-3 gap-4 mb-8">
                        <div className="bg-gray-50 rounded-xl p-3">
                            <p className="text-xs text-gray-400 font-bold">Answered</p>
                            <p className="text-lg font-black text-gray-900">{answeredCount}</p>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-3">
                            <p className="text-xs text-gray-400 font-bold">Skipped</p>
                            <p className="text-lg font-black text-gray-900">{unansweredCount}</p>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-3">
                            <p className="text-xs text-gray-400 font-bold">Flagged</p>
                            <p className="text-lg font-black text-gray-900">{flaggedCount}</p>
                        </div>
                    </div>

                    {session.drive_type === "mock_test" && (
                        <div className="rounded-2xl border border-violet-100 bg-violet-50/80 px-4 py-3 mb-6 text-left">
                            <p className="text-xs font-bold text-violet-700 uppercase tracking-wider mb-1">
                                Placement readiness
                            </p>
                            <p className="text-sm text-violet-900/80">
                                This mock feeds your Placement Score and AI recommendations. Review
                                weak topics in Placement Coach.
                            </p>
                        </div>
                    )}

                    <div className="space-y-2">
                        <button
                            type="button"
                            onClick={() =>
                                navigate(`/app/student-portal/results/${session.drive_id}`)
                            }
                            className="w-full py-3.5 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-700 transition-all"
                        >
                            Results &amp; Evaluation
                        </button>
                        {session.drive_type === "mock_test" && (
                            <button
                                type="button"
                                onClick={() => navigate("/app/student-portal/placement-coach")}
                                className="w-full py-3.5 bg-violet-600 text-white rounded-2xl font-black hover:bg-violet-700 transition-all"
                            >
                                View Placement Score &amp; AI tips
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => navigate("/app/student-portal/tests")}
                            className="w-full py-3.5 border border-gray-200 text-gray-800 rounded-2xl font-bold hover:bg-gray-50 transition-all"
                        >
                            All tests
                        </button>
                        <button
                            type="button"
                            onClick={() => navigate("/app/student-portal")}
                            className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black hover:bg-black transition-all"
                        >
                            Back to Portal
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Use the question's explicit type field to determine interaction mode.
    // Fall back to keyword scan only if type is missing (legacy data).
    const isMultiSelect = currentQuestion?.type
        ? currentQuestion.type.toUpperCase() === "MULTI_SELECT" || currentQuestion.type.toUpperCase() === "MULTIPLE_CORRECT"
        : (currentQuestion?.question_text?.toLowerCase().includes("select all") ||
           currentQuestion?.question_text?.toLowerCase().includes("multiple correct") || false);
    const questionAnswer = answers[currentQuestion?.id] || { selected: [], flagged: false };

    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden flex-col md:flex-row">
            {/* Mobile sidebar overlay */}
            {sidebarOpen && isMobile && (
                <div
                    className="fixed inset-0 bg-black/50 z-30 md:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* ── Question Navigation Sidebar ── */}
            <div className={`${
                isMobile
                    ? `fixed left-0 top-0 h-screen w-[280px] transform transition-transform duration-300 ${
                        sidebarOpen ? "translate-x-0" : "-translate-x-full"
                    } z-40`
                    : "w-[280px] relative z-10"
            } bg-white border-r border-gray-200 flex flex-col`}>
                {/* Header */}
                <div className="p-4 border-b border-gray-100 flex-shrink-0">
                    <h2 className="font-black text-gray-900 text-sm truncate">{session.drive_name}</h2>
                    <p className="text-xs text-gray-400 font-bold mt-1">{questions.length} Questions</p>
                    {isMock && (session.section_timers?.length ?? 0) > 0 && (
                        <ul className="mt-2 space-y-0.5">
                            {session.section_timers!.map((t) => (
                                <li key={t.section_name} className="text-[10px] font-bold text-violet-600">
                                    {t.section_name}: {t.time_limit_minutes}m
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {/* Question Grid */}
                <div className="flex-1 overflow-y-auto p-3 md:p-4">
                    <div className={`grid ${isMobile ? "grid-cols-4 gap-1.5" : "grid-cols-5 gap-2"}`}>
                        {questions.map((q, i) => {
                            const status = getQuestionStatus(q.id);
                            const isCurrent = i === currentIndex;
                            let bgClass = "bg-gray-100 text-gray-600 hover:bg-gray-200";
                            if (isCurrent) bgClass = "bg-indigo-600 text-white ring-2 ring-indigo-300";
                            else if (status === "answered") bgClass = "bg-emerald-500 text-white";
                            else if (status === "flagged-answered") bgClass = "bg-amber-500 text-white";
                            else if (status === "flagged") bgClass = "bg-amber-100 text-amber-700 border border-amber-300";

                            return (
                                <button
                                    key={q.id}
                                    onClick={() => setCurrentIndex(i)}
                                    className={`h-10 w-10 rounded-xl text-xs font-black transition-all ${bgClass} relative`}
                                    title={`Q${i + 1}: ${status}`}
                                >
                                    {i + 1}
                                    {(status === "flagged" || status === "flagged-answered") && (
                                        <Flag className="h-2.5 w-2.5 absolute -top-1 -right-1 text-amber-600" fill="currentColor" />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Legend */}
                <div className="p-4 border-t border-gray-100 space-y-2">
                    <div className="flex items-center gap-2">
                        <div className="h-4 w-4 rounded bg-emerald-500" />
                        <span className="text-xs font-bold text-gray-500">Answered ({answeredCount})</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="h-4 w-4 rounded bg-gray-100 border border-gray-200" />
                        <span className="text-xs font-bold text-gray-500">Unanswered ({unansweredCount})</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="h-4 w-4 rounded bg-amber-100 border border-amber-300" />
                        <span className="text-xs font-bold text-gray-500">Flagged ({flaggedCount})</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="h-4 w-4 rounded bg-indigo-600" />
                        <span className="text-xs font-bold text-gray-500">Current</span>
                    </div>
                </div>

                {/* Status / PIP Area */}
                <div className="p-4 border-t border-gray-100 bg-gray-50">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Live Proctoring</p>

                    {permissionDenied ? (
                        <div className="bg-red-50 rounded-xl p-3 border border-red-100">
                            <div className="flex items-center gap-2 text-red-600 mb-2">
                                <VideoOff className="h-4 w-4 flex-shrink-0" />
                                <span className="text-xs font-bold">Camera Blocked</span>
                            </div>
                            <p className="text-[10px] text-red-500 mb-2 font-medium">Your camera is required to continue this exam.</p>
                            <button onClick={retryCamera} className="w-full py-1.5 bg-red-600 font-bold text-white text-[10px] rounded hover:bg-red-700 transition-all">
                                Retry Camera
                            </button>
                        </div>
                    ) : (
                        <div className="relative rounded-xl overflow-hidden bg-black aspect-video border-2 border-slate-800 shadow-inner">
                            <video
                                ref={videoRef}
                                className="w-full h-full object-cover transform scale-x-[-1]"
                                playsInline
                                muted
                            />
                            <canvas ref={canvasRef} className="hidden" />

                            {/* Recording Indicator */}
                            <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm px-2 py-1 rounded">
                                <div className={`h-1.5 w-1.5 rounded-full ${isCameraActive ? "bg-red-500 animate-pulse" : "bg-gray-500"}`} />
                                <span className="text-[9px] font-bold text-white uppercase tracking-wider">
                                    {isCameraActive ? "REC" : "WAITING"}
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Main Content ── */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Top Bar: Timer + Submit */}
                <div className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-3 md:px-6 flex-shrink-0 gap-2 md:gap-3 flex-wrap md:flex-nowrap">
                    {isMobile && (
                        <button
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            className="p-2 hover:bg-gray-100 rounded-lg flex-shrink-0 md:hidden"
                            title="Toggle question navigator"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        </button>
                    )}
                    <div className="flex items-center gap-1 md:gap-3 min-w-0 flex-1">
                        <span className="text-xs md:text-sm font-bold text-gray-400 whitespace-nowrap">Q{currentIndex + 1}/{questions.length}</span>
                        <span className={`text-[10px] md:text-xs font-black uppercase tracking-widest px-1.5 md:px-2 py-0.5 rounded-full flex-shrink-0 ${currentQuestion?.difficulty_level === "easy" ? "bg-emerald-50 text-emerald-600" :
                            currentQuestion?.difficulty_level === "medium" ? "bg-amber-50 text-amber-600" :
                                "bg-red-50 text-red-600"
                            }`}>
                            {currentQuestion?.difficulty_level?.[0]?.toUpperCase()}
                        </span>
                        <span className="text-[10px] md:text-xs font-bold text-gray-400 flex-shrink-0">
                            {currentQuestion?.marks}m
                        </span>
                    </div>

                    <div className="flex items-center gap-2 md:gap-4 flex-wrap md:flex-nowrap">
                        {isMock && sectionTimeLeft != null && (
                            <div
                                className={`hidden md:flex items-center gap-2 px-3 py-2 rounded-xl font-black text-xs ${
                                    sectionTimeLeft <= 60
                                        ? "bg-red-50 text-red-600"
                                        : "bg-violet-50 text-violet-700"
                                }`}
                                title="Section timer"
                            >
                                <span className="uppercase tracking-wider text-[10px] opacity-70">Section</span>
                                {formatTime(sectionTimeLeft)}
                            </div>
                        )}
                        {/* Overall timer */}
                        <div className={`flex items-center gap-1 md:gap-2 px-2 md:px-4 py-2 rounded-xl font-black text-xs md:text-sm flex-shrink-0 ${timeLeft <= 300 ? "bg-red-50 text-red-600 animate-pulse" :
                            timeLeft <= 600 ? "bg-amber-50 text-amber-600" :
                                "bg-gray-100 text-gray-700"
                            }`}>
                            <Clock className="h-3 w-3 md:h-4 md:w-4 flex-shrink-0" />
                            <span className="hidden md:inline">{formatTime(timeLeft)}</span>
                            <span className="md:hidden">{Math.floor(timeLeft / 60)}m</span>
                        </div>

                        {/* Submit */}
                        <button
                            onClick={() => handleSubmit()}
                            className="flex items-center gap-1 md:gap-2 bg-indigo-600 text-white px-3 md:px-6 py-2 md:py-2.5 rounded-lg md:rounded-xl font-black text-xs md:text-sm hover:bg-indigo-700 transition-all flex-shrink-0"
                        >
                            <Send className="h-3 w-3 md:h-4 md:w-4" />
                            <span className="hidden md:inline">Submit</span>
                            <span className="md:hidden">✓</span>
                        </button>
                    </div>
                </div>

                {/* Question Area */}
                <div className="flex-1 overflow-y-auto p-3 md:p-6 lg:p-8 relative flex flex-col bg-white">

                    {/* Violation Alert Toast */}
                    {violationAlert && (
                        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-4 fade-in duration-300">
                            <div className="bg-red-600 text-white px-6 py-3 rounded-2xl shadow-xl shadow-red-600/20 flex items-center gap-3 font-bold border border-red-500">
                                <AlertTriangle className="h-5 w-5 animate-pulse" />
                                {violationAlert}
                            </div>
                        </div>
                    )}

                    <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col">
                        {currentQuestion && (
                            <>
                                {/* Question Text */}
                                <div className="bg-gray-50/50 rounded-2xl p-6 border border-gray-100 mb-6 flex-shrink-0">
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-2.5 py-1 rounded-md">
                                            {currentQuestion.category.replace("_", " ")}
                                        </span>
                                    </div>
                                    <p className="text-lg font-bold text-gray-900 leading-relaxed whitespace-pre-wrap">
                                        {currentQuestion.question_text}
                                    </p>
                                </div>

                                {/* Options Wrapper */}
                                <div className="flex-1 min-h-0 overflow-y-auto pr-2 mb-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {(currentQuestion.options || []).map((opt: any, i: number) => {
                                            const label = opt.label || String.fromCharCode(65 + i);
                                            const text = opt.text || opt;
                                            const isSelected = questionAnswer.selected.includes(label);

                                            return (
                                                <button
                                                    key={label}
                                                    onClick={() => handleSelectOption(currentQuestion.id, label, isMultiSelect)}
                                                    className={`w-full flex items-center gap-4 p-5 rounded-2xl border-2 text-left transition-all ${isSelected
                                                        ? "border-indigo-500 bg-indigo-50 shadow-sm"
                                                        : "border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50"
                                                        }`}
                                                >
                                                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center text-sm font-black flex-shrink-0 transition-all ${isSelected
                                                        ? "bg-indigo-600 text-white"
                                                        : "bg-gray-100 text-gray-500"
                                                        }`}>
                                                        {label}
                                                    </div>
                                                    <span className={`text-sm font-medium ${isSelected ? "text-indigo-900" : "text-gray-700"}`}>
                                                        {text}
                                                    </span>
                                                    {isSelected && (
                                                        <CheckCircle2 className="h-5 w-5 text-indigo-600 ml-auto flex-shrink-0" />
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Action Bar */}
                                <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-100 flex-shrink-0">
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => handleToggleFlag(currentQuestion.id)}
                                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${questionAnswer.flagged
                                                ? "bg-amber-100 text-amber-700 border border-amber-300"
                                                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                                }`}
                                        >
                                            <Flag className="h-4 w-4" fill={questionAnswer.flagged ? "currentColor" : "none"} />
                                            {questionAnswer.flagged ? "Flagged" : "Flag"}
                                        </button>

                                        <button
                                            onClick={() => handleClearAnswer(currentQuestion.id)}
                                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all"
                                        >
                                            <Eraser className="h-4 w-4" />
                                            Clear
                                        </button>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                                            disabled={currentIndex === 0}
                                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                        >
                                            <ChevronLeft className="h-4 w-4" />
                                            Previous
                                        </button>

                                        <button
                                            onClick={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}
                                            disabled={currentIndex === questions.length - 1}
                                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-gray-900 text-white hover:bg-black disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                        >
                                            Next
                                            <ChevronRight className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Submit Confirmation Modal ── */}
            {showSubmitModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
                    <div className="bg-white rounded-[2rem] p-8 max-w-md w-full shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-300">
                        <div className="text-center mb-6">
                            <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-3" />
                            <h3 className="text-xl font-black text-gray-900">Submit Exam?</h3>
                            <p className="text-sm text-gray-500 mt-1">This action cannot be undone.</p>
                        </div>

                        <div className="grid grid-cols-3 gap-3 mb-6">
                            <div className="bg-emerald-50 rounded-xl p-3 text-center">
                                <p className="text-2xl font-black text-emerald-600">{answeredCount}</p>
                                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Answered</p>
                            </div>
                            <div className="bg-gray-50 rounded-xl p-3 text-center">
                                <p className="text-2xl font-black text-gray-600">{unansweredCount}</p>
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Unanswered</p>
                            </div>
                            <div className="bg-amber-50 rounded-xl p-3 text-center">
                                <p className="text-2xl font-black text-amber-600">{flaggedCount}</p>
                                <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">Flagged</p>
                            </div>
                        </div>

                        {unansweredCount > 0 && (
                            <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-xl border border-amber-200 mb-6 text-sm text-amber-800 font-bold">
                                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                                You have {unansweredCount} unanswered question{unansweredCount > 1 ? "s" : ""}.
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowSubmitModal(false)}
                                className="flex-1 py-3.5 rounded-2xl font-black text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all"
                            >
                                Continue Exam
                            </button>
                            <button
                                onClick={() => submitMutation.mutate()}
                                disabled={submitMutation.isPending}
                                className="flex-1 py-3.5 rounded-2xl font-black text-sm bg-red-600 text-white hover:bg-red-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {submitMutation.isPending ? (
                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                ) : (
                                    <>
                                        <Send className="h-4 w-4" />
                                        Confirm Submit
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
