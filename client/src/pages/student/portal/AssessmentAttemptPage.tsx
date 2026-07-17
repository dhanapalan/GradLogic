/**
 * Module 06 — Assessment Workspace (attempt shell).
 * UI + API consumption only; timer authority, eligibility, and scoring stay on the backend.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Flag,
  Eraser,
  Send,
  AlertTriangle,
  WifiOff,
} from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "../../../components/ui/button";
import studentAssessmentsService, {
  isSaveAck,
  type AttemptQuestion,
  type AttemptWorkspace,
} from "../../../services/studentAssessmentsService";
import assessmentWorkspaceService from "../../../services/assessmentWorkspaceService";
import { useCampaignIntegrity } from "../../../hooks/useCampaignIntegrity";
import { getAccessToken, useAuthStore } from "../../../stores/authStore";
import WorkspaceHeader, { formatTime } from "./assessment-workspace/WorkspaceHeader";
import QuestionNavigator from "./assessment-workspace/QuestionNavigator";
import QuestionRenderer from "./assessment-workspace/QuestionRenderer";
import AccessibilityToolbar from "./assessment-workspace/AccessibilityToolbar";
import MobilePolicyGate from "./assessment-workspace/MobilePolicyGate";

const BASE = "/app/student-portal";
const DEFAULT_WARNING_SECONDS = 300;
const DEFAULT_AUTOSAVE_MS = 30_000;

function isWorkspace(data: unknown): data is AttemptWorkspace {
  return (
    !!data &&
    typeof data === "object" &&
    "attempt" in data &&
    "questions" in data &&
    !(data as { saved?: boolean }).saved
  );
}

function isSubmittedResult(
  data: unknown
): data is { attempt_id?: string; status: string; message?: string; submitted_at?: string } {
  return (
    !!data &&
    typeof data === "object" &&
    "status" in data &&
    ["submitted", "expired"].includes(String((data as { status: string }).status)) &&
    !("questions" in data) &&
    !(data as { saved?: boolean }).saved
  );
}

function remainingFromDeadline(
  serverDeadlineIso: string,
  availableUntilIso: string,
  clockOffsetMs: number
) {
  const nowServer = Date.now() + clockOffsetMs;
  const deadline = Math.min(
    new Date(serverDeadlineIso).getTime(),
    new Date(availableUntilIso).getTime()
  );
  return Math.max(0, Math.floor((deadline - nowServer) / 1000));
}

export default function AssessmentAttemptPage() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const navigate = useNavigate();
  const studentName = useAuthStore((s) => s.user?.name);

  const [index, setIndex] = useState(0);
  const [questions, setQuestions] = useState<AttemptQuestion[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [warningSeconds, setWarningSeconds] = useState(DEFAULT_WARNING_SECONDS);
  const [showTimeWarning, setShowTimeWarning] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error" | "offline">(
    "idle"
  );
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [recovered, setRecovered] = useState(false);
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [fontScale, setFontScale] = useState(1);
  const [highContrast, setHighContrast] = useState(false);
  const [mobileDismissed, setMobileDismissed] = useState(false);

  const timeLeftRef = useRef(0);
  const indexRef = useRef(0);
  const questionsRef = useRef<AttemptQuestion[]>([]);
  const autoSubmittedRef = useRef(false);
  const warningToastedRef = useRef(false);
  const shortAnswerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deadlineRef = useRef<string>("");
  const availableUntilRef = useRef<string>("");
  const clockOffsetRef = useRef(0);
  const pendingQueueRef = useRef<Array<Parameters<typeof studentAssessmentsService.saveAttempt>[1]>>(
    []
  );

  const { data, isLoading, error } = useQuery({
    queryKey: ["student-assessment-attempt", campaignId],
    queryFn: () => studentAssessmentsService.getAttempt(campaignId!),
    enabled: !!campaignId,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const integritySettings = data?.integrity?.settings;
  const {
    proctoringActive,
    integrityScore,
    cameraActive,
    micActive,
    offline,
    fullscreenOk,
  } = useCampaignIntegrity({
    campaignId: campaignId || "",
    enabled: !!data && data.attempt.status === "in_progress",
    settings: integritySettings,
  });

  const applyServerClock = useCallback(
    (serverNow: string, serverDeadline: string, availableUntil: string, remaining?: number) => {
      clockOffsetRef.current = new Date(serverNow).getTime() - Date.now();
      deadlineRef.current = serverDeadline;
      availableUntilRef.current = availableUntil;
      const left =
        remaining != null
          ? remaining
          : remainingFromDeadline(serverDeadline, availableUntil, clockOffsetRef.current);
      setTimeLeft(left);
      timeLeftRef.current = left;
    },
    []
  );

  useEffect(() => {
    if (!data) return;
    setQuestions(data.questions);
    questionsRef.current = data.questions;
    setIndex(data.attempt.current_index);
    indexRef.current = data.attempt.current_index;
    setWarningSeconds(data.attempt.timer_warning_seconds ?? DEFAULT_WARNING_SECONDS);
    setLastSavedAt(data.attempt.last_saved_at ?? null);
    applyServerClock(
      data.attempt.server_now || new Date().toISOString(),
      data.attempt.server_deadline,
      data.attempt.available_until,
      data.attempt.time_remaining_seconds
    );
    const hasProgress =
      data.attempt.current_index > 0 ||
      data.questions.some(
        (q) => q.status !== "not_visited" || q.selected.length > 0 || q.marked_for_review
      );
    if (hasProgress) setRecovered(true);
  }, [data, applyServerClock]);

  useEffect(() => {
    indexRef.current = index;
  }, [index]);
  useEffect(() => {
    questionsRef.current = questions;
  }, [questions]);
  useEffect(() => {
    timeLeftRef.current = timeLeft;
  }, [timeLeft]);

  const persist = useCallback(
    async (payload: Parameters<typeof studentAssessmentsService.saveAttempt>[1]) => {
      if (!campaignId) return null;
      if (!navigator.onLine) {
        pendingQueueRef.current.push(payload);
        setSaveState("offline");
        return null;
      }
      setSaveState("saving");
      try {
        const result = await studentAssessmentsService.saveAttemptWithRetry(campaignId, {
          ...payload,
          current_index: payload.current_index ?? indexRef.current,
        });
        if (isSaveAck(result)) {
          if (result.question) {
            setQuestions((prev) => {
              const next = prev.map((q) =>
                q.id === result.question!.question_id
                  ? {
                      ...q,
                      selected: result.question!.selected,
                      marked_for_review: result.question!.marked_for_review,
                      status: result.question!.status,
                      visited: result.question!.visited || q.visited,
                    }
                  : q
              );
              questionsRef.current = next;
              return next;
            });
          }
          if (result.attempt.server_now) {
            applyServerClock(
              result.attempt.server_now,
              result.attempt.server_deadline,
              availableUntilRef.current || result.attempt.server_deadline,
              result.attempt.time_remaining_seconds
            );
          }
          setLastSavedAt(result.attempt.last_saved_at);
          setSaveState("saved");
          return result;
        }
        if (isWorkspace(result)) {
          setQuestions(result.questions);
          questionsRef.current = result.questions;
          if (result.attempt.server_now) {
            applyServerClock(
              result.attempt.server_now,
              result.attempt.server_deadline,
              result.attempt.available_until,
              result.attempt.time_remaining_seconds
            );
          }
          setLastSavedAt(result.attempt.last_saved_at ?? new Date().toISOString());
          setSaveState("saved");
          return result;
        }
        if (isSubmittedResult(result)) {
          toast.error(result.message || "Time expired");
          navigate(`${BASE}/my-assessments/${campaignId}/complete`, { replace: true });
          return null;
        }
        toast.error("Unexpected save response");
        return null;
      } catch (err) {
        setSaveState("error");
        throw err;
      }
    },
    [campaignId, navigate, applyServerClock]
  );

  const saveMutation = useMutation({
    mutationFn: persist,
    onError: (err: { response?: { data?: { error?: string }; status?: number } }) => {
      const msg = err?.response?.data?.error || "Could not save — retrying on next action";
      toast.error(msg);
      if (err?.response?.status === 403) navigate(`${BASE}/my-assessments`);
    },
  });

  // Flush offline queue when back online
  useEffect(() => {
    if (offline || !campaignId) return;
    const queue = pendingQueueRef.current.splice(0);
    if (!queue.length) return;
    void (async () => {
      for (const payload of queue) {
        try {
          await persist(payload);
        } catch {
          /* next autosave retries */
        }
      }
    })();
  }, [offline, campaignId, persist]);

  const runAutoSubmit = useCallback(async () => {
    if (!campaignId || autoSubmittedRef.current) return;
    autoSubmittedRef.current = true;
    try {
      const q = questionsRef.current[indexRef.current];
      if (q) {
        await studentAssessmentsService
          .saveAttemptWithRetry(campaignId, {
            question_id: q.id,
            selected: q.selected,
            marked_for_review: q.marked_for_review,
            visit: true,
            current_index: indexRef.current,
          })
          .catch(() => null);
      }
      await studentAssessmentsService.submitAttempt(campaignId);
      toast.error("Time expired. Assessment submitted.");
    } catch {
      /* best effort */
    }
    navigate(`${BASE}/my-assessments/${campaignId}/complete`, { replace: true });
  }, [campaignId, navigate]);

  // Server-based countdown
  useEffect(() => {
    if (!data) return;
    const id = window.setInterval(() => {
      if (!deadlineRef.current || !availableUntilRef.current) return;
      const left = remainingFromDeadline(
        deadlineRef.current,
        availableUntilRef.current,
        clockOffsetRef.current
      );
      setTimeLeft(left);
      timeLeftRef.current = left;
      if (left > 0 && left <= warningSeconds && !warningToastedRef.current) {
        warningToastedRef.current = true;
        setShowTimeWarning(true);
        toast(`Less than ${formatTime(warningSeconds)} remaining`, { icon: "⏰" });
      }
      if (left <= 0) void runAutoSubmit();
    }, 1000);
    return () => window.clearInterval(id);
  }, [data, warningSeconds, runAutoSubmit]);

  // Heartbeat (attempt-scoped facade) + autosave interval
  useEffect(() => {
    if (!data || !campaignId) return;
    const attemptId = data.attempt.id;
    const intervalMs =
      (data.attempt.auto_save_interval_seconds ?? 30) * 1000 || DEFAULT_AUTOSAVE_MS;

    const tick = async () => {
      try {
        const sync = await assessmentWorkspaceService.heartbeat(attemptId);
        applyServerClock(
          sync.server_now,
          sync.server_deadline,
          sync.available_until,
          sync.time_remaining_seconds
        );
        if (sync.expired) {
          void runAutoSubmit();
          return;
        }
      } catch {
        try {
          const sync = await studentAssessmentsService.syncTimer(campaignId);
          applyServerClock(
            sync.server_now,
            sync.server_deadline,
            sync.available_until,
            sync.time_remaining_seconds
          );
          if (sync.expired) {
            void runAutoSubmit();
            return;
          }
        } catch {
          /* keep local countdown */
        }
      }

      const q = questionsRef.current[indexRef.current];
      try {
        await persist({
          question_id: q?.id,
          selected: q?.selected,
          marked_for_review: q?.marked_for_review,
          visit: true,
          current_index: indexRef.current,
        });
      } catch {
        /* retry on next interval */
      }
    };

    const id = window.setInterval(() => void tick(), intervalMs);
    return () => window.clearInterval(id);
  }, [data, campaignId, persist, applyServerClock, runAutoSubmit]);

  // Flush on hide / unload
  useEffect(() => {
    if (!data || !campaignId) return;
    const flush = () => {
      const q = questionsRef.current[indexRef.current];
      const body = JSON.stringify({
        question_id: q?.id,
        selected: q?.selected ?? [],
        marked_for_review: q?.marked_for_review ?? false,
        visit: true,
        current_index: indexRef.current,
      });
      const token = getAccessToken();
      try {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (token) headers.Authorization = `Bearer ${token}`;
        const root =
          (import.meta.env.VITE_API_URL as string | undefined) ||
          (typeof window !== "undefined" && window.location.hostname === "localhost"
            ? "http://localhost:5050"
            : "");
        const base = root ? `${root.replace(/\/$/, "")}/api` : "/api";
        void fetch(`${base}/student-assessments/my-assessments/${campaignId}/attempt`, {
          method: "PUT",
          headers,
          body,
          keepalive: true,
          credentials: "include",
        });
      } catch {
        /* ignore */
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [data, campaignId]);

  const current = questions[index];
  const total = questions.length;
  const answeredCount = questions.filter(
    (q) => q.status === "answered" || (q.status === "marked_for_review" && q.selected.length)
  ).length;

  const goTo = async (nextIndex: number) => {
    if (!current || nextIndex < 0 || nextIndex >= total) return;
    await saveMutation.mutateAsync({
      question_id: current.id,
      selected: current.selected,
      marked_for_review: current.marked_for_review,
      visit: true,
      current_index: nextIndex,
    });
    setIndex(nextIndex);
  };

  const selectOption = async (label: string) => {
    if (!current) return;
    const type = (current.question_type || "").toLowerCase();
    const multi =
      type === "mcq_multiple" ||
      type === "multi_select" ||
      type === "msq" ||
      type === "ordering" ||
      type === "sequence" ||
      type === "matching";
    let selected: string[];
    if (multi) {
      selected = current.selected.includes(label)
        ? current.selected.filter((l) => l !== label)
        : [...current.selected, label];
    } else {
      selected = [label];
    }
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === index
          ? {
              ...q,
              selected,
              visited: true,
              status: q.marked_for_review
                ? "marked_for_review"
                : selected.length
                  ? "answered"
                  : "visited",
            }
          : q
      )
    );
    await saveMutation.mutateAsync({
      question_id: current.id,
      selected,
      marked_for_review: current.marked_for_review,
      visit: true,
      current_index: index,
    });
  };

  const setTextAnswer = (text: string) => {
    if (!current) return;
    const qid = current.id;
    const marked = current.marked_for_review;
    const selected = text.trim() ? [text] : [];
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === index
          ? {
              ...q,
              selected,
              visited: true,
              status: marked ? "marked_for_review" : selected.length ? "answered" : "visited",
            }
          : q
      )
    );
    if (shortAnswerTimer.current) clearTimeout(shortAnswerTimer.current);
    shortAnswerTimer.current = setTimeout(() => {
      void saveMutation.mutateAsync({
        question_id: qid,
        selected,
        marked_for_review: marked,
        visit: true,
        current_index: indexRef.current,
      });
    }, 400);
  };

  const clearResponse = async () => {
    if (!current) return;
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === index
          ? {
              ...q,
              selected: [],
              visited: true,
              status: q.marked_for_review ? "marked_for_review" : "visited",
            }
          : q
      )
    );
    await saveMutation.mutateAsync({
      question_id: current.id,
      clear_response: true,
      marked_for_review: current.marked_for_review,
      visit: true,
      current_index: index,
    });
  };

  const toggleMark = async () => {
    if (!current) return;
    const marked = !current.marked_for_review;
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === index
          ? {
              ...q,
              marked_for_review: marked,
              visited: true,
              status: marked
                ? "marked_for_review"
                : q.selected.length
                  ? "answered"
                  : "visited",
            }
          : q
      )
    );
    await saveMutation.mutateAsync({
      question_id: current.id,
      selected: current.selected,
      marked_for_review: marked,
      visit: true,
      current_index: index,
    });
  };

  const saveAndNext = async () => {
    if (!current) return;
    if (index < total - 1) await goTo(index + 1);
    else {
      await saveMutation.mutateAsync({
        question_id: current.id,
        selected: current.selected,
        marked_for_review: current.marked_for_review,
        visit: true,
        current_index: index,
      });
      toast.success("Progress saved");
    }
  };

  const saveAndMark = async () => {
    if (!current) return;
    const marked = true;
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === index
          ? { ...q, marked_for_review: true, visited: true, status: "marked_for_review" as const }
          : q
      )
    );
    await saveMutation.mutateAsync({
      question_id: current.id,
      selected: current.selected,
      marked_for_review: marked,
      visit: true,
      current_index: index < total - 1 ? index + 1 : index,
    });
    if (index < total - 1) setIndex(index + 1);
  };

  const goToSubmission = async () => {
    if (!campaignId) return;
    try {
      if (current) {
        await persist({
          question_id: current.id,
          selected: current.selected,
          marked_for_review: current.marked_for_review,
          visit: true,
          current_index: index,
        });
      }
      navigate(`${BASE}/my-assessments/${campaignId}/submit`);
    } catch (err: unknown) {
      toast.error(
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
          "Could not open submission summary"
      );
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div
          className="h-10 w-10 animate-spin rounded-full border-4 border-slate-300 border-t-slate-800"
          role="status"
          aria-label="Loading assessment workspace"
        />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="mx-auto max-w-lg text-center">
          <AlertTriangle className="mx-auto mb-3 h-12 w-12 text-amber-500" />
          <h2 className="text-xl font-semibold text-slate-900">Cannot open attempt</h2>
          <p className="mt-2 text-sm text-slate-500">
            {(error as { response?: { data?: { error?: string } } })?.response?.data?.error ||
              "Start the assessment from the instructions page first."}
          </p>
          <Button
            type="button"
            className="mt-6"
            variant="outline"
            onClick={() => navigate(`${BASE}/my-assessments/${campaignId}/instructions`)}
          >
            Back to instructions
          </Button>
        </div>
      </div>
    );
  }

  const inWarning = timeLeft > 0 && timeLeft <= warningSeconds;
  const shellClass = highContrast
    ? "bg-black text-white [&_*]:border-white/30"
    : "bg-slate-50";

  return (
    <div
      className={`flex min-h-screen flex-col ${shellClass}`}
      style={{ fontSize: `${fontScale * 100}%` }}
    >
      {!mobileDismissed && (
        <MobilePolicyGate
          requireFullscreen={!!integritySettings?.require_fullscreen}
          onContinue={() => setMobileDismissed(true)}
        />
      )}

      <WorkspaceHeader
        assessmentName={data.attempt.assessment_name}
        campaignName={data.attempt.campaign_name}
        studentName={studentName}
        status={data.attempt.status}
        timeLeft={timeLeft}
        warningSeconds={warningSeconds}
        saveState={offline ? "offline" : saveState}
        lastSavedAt={lastSavedAt}
        offline={offline}
        proctoringActive={proctoringActive}
        integrityScore={integrityScore}
        cameraActive={cameraActive}
        micActive={micActive}
        requireCamera={integritySettings?.require_camera}
        requireMic={integritySettings?.require_microphone}
        fullscreenOk={fullscreenOk}
        requireFullscreen={integritySettings?.require_fullscreen}
      />

      <div className="mx-auto w-full max-w-6xl px-4 pt-3">
        <AccessibilityToolbar
          fontScale={fontScale}
          highContrast={highContrast}
          onFontScale={setFontScale}
          onHighContrast={setHighContrast}
        />
      </div>

      {offline && (
        <div className="mx-auto mt-2 flex w-full max-w-6xl items-center gap-2 px-4 text-xs text-rose-800">
          <WifiOff className="h-3.5 w-3.5 shrink-0" />
          Network disconnected — responses are queued and will sync when online.
        </div>
      )}
      {(showTimeWarning || inWarning) && (
        <div className="mx-auto mt-2 flex w-full max-w-6xl items-start gap-2 px-4 text-xs text-amber-900">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Warning: less than {formatTime(warningSeconds)} remaining. The assessment will
            auto-submit when the timer reaches zero.
          </span>
        </div>
      )}
      {recovered && (
        <div className="mx-auto mt-2 w-full max-w-6xl px-4 text-xs text-slate-600">
          Session restored — your previous answers and position were recovered.
        </div>
      )}

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 p-4 lg:flex-row">
        <QuestionNavigator
          questions={questions}
          currentIndex={index}
          onJump={(i) => void goTo(i)}
          collapsed={navCollapsed}
          onToggleCollapse={() => setNavCollapsed((v) => !v)}
        />

        <main className="order-1 flex min-w-0 flex-1 flex-col lg:order-2">
          <div
            className={`flex-1 rounded-xl border p-5 shadow-sm sm:p-6 ${
              highContrast ? "border-white/40 bg-black" : "border-slate-200 bg-white"
            }`}
          >
            {current ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Question {index + 1}
                    <span className="ml-2 font-normal normal-case">
                      · {current.marks} mark{current.marks === 1 ? "" : "s"}
                      {current.difficulty ? ` · ${current.difficulty}` : ""}
                      {current.section || current.category
                        ? ` · ${current.section || current.category}`
                        : ""}
                    </span>
                  </p>
                  <p className="text-xs text-slate-400">
                    {answeredCount}/{total} answered
                  </p>
                </div>
                <h2 className="mt-2 text-lg font-semibold leading-snug">{current.title}</h2>
                {current.description && (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
                    {current.description}
                  </p>
                )}
                <div className="mt-6">
                  <QuestionRenderer
                    question={current}
                    index={index}
                    disabled={saveMutation.isPending}
                    onSelectOption={(label) => void selectOption(label)}
                    onTextAnswer={setTextAnswer}
                  />
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-500">No questions loaded.</p>
            )}
          </div>

          <footer className="sticky bottom-0 z-10 mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] shadow-sm">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11"
              disabled={index <= 0 || saveMutation.isPending}
              onClick={() => void goTo(index - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11"
              disabled={saveMutation.isPending}
              onClick={() => void saveAndNext()}
            >
              Save &amp; Next
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11"
              disabled={index >= total - 1 || saveMutation.isPending}
              onClick={() => void goTo(index + 1)}
            >
              Next
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11"
              disabled={saveMutation.isPending}
              onClick={() => void toggleMark()}
            >
              <Flag className="h-4 w-4" />
              Mark for Review
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11 hidden sm:inline-flex"
              disabled={saveMutation.isPending}
              onClick={() => void saveAndMark()}
            >
              Save &amp; Mark
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11 hidden sm:inline-flex"
              disabled={saveMutation.isPending}
              onClick={() => void clearResponse()}
            >
              <Eraser className="h-4 w-4" />
              Clear Response
            </Button>
            <div className="ml-auto w-full sm:w-auto">
              <Button
                type="button"
                size="sm"
                className="min-h-11 w-full sm:w-auto"
                onClick={() => void goToSubmission()}
              >
                <Send className="h-4 w-4" />
                Submit Assessment
              </Button>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}
