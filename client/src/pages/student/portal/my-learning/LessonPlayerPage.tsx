import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  Bookmark,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Moon,
} from "lucide-react";
import LessonContentRenderer from "../../../../components/LessonContentRenderer";
import studentLearningService from "../../../../services/studentLearningService";
import { useStudentMobilePrefs } from "../../../../hooks/useStudentMobilePrefs";
import { BASE, ErrorBlock, LoadingBlock } from "./components";

const NOTES_KEY = (id: string) => `learning-lesson-notes-${id}`;
const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2] as const;
const SLEEP_OPTIONS = [
  { minutes: 0, label: "Off" },
  { minutes: 15, label: "15m" },
  { minutes: 30, label: "30m" },
  { minutes: 45, label: "45m" },
] as const;

export default function LessonPlayerPage() {
  const { lessonId = "" } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { lowBandwidth } = useStudentMobilePrefs();
  const [speed, setSpeed] = useState(1);
  const [notes, setNotes] = useState("");
  const [sleepMinutes, setSleepMinutes] = useState(0);
  const [mediaAllowed, setMediaAllowed] = useState(!lowBandwidth);
  const [progressPct, setProgressPct] = useState(0);
  const lastSaved = useRef(0);
  const sleepTimerRef = useRef<number | null>(null);

  const lessonQ = useQuery({
    queryKey: ["learning-lesson", lessonId],
    queryFn: () => studentLearningService.getLesson(lessonId),
    enabled: !!lessonId,
  });

  useEffect(() => {
    try {
      setNotes(sessionStorage.getItem(NOTES_KEY(lessonId)) || "");
    } catch {
      setNotes("");
    }
  }, [lessonId]);

  useEffect(() => {
    setMediaAllowed(!lowBandwidth);
  }, [lowBandwidth, lessonId]);

  const progressMut = useMutation({
    mutationFn: (body: { watch_seconds?: number; is_completed?: boolean }) =>
      studentLearningService.saveLessonProgress(lessonId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["learning-lesson", lessonId] });
      qc.invalidateQueries({ queryKey: ["learning-continue"] });
      qc.invalidateQueries({ queryKey: ["learning-summary"] });
      qc.invalidateQueries({ queryKey: ["learning-courses"] });
    },
  });

  const bookmarkMut = useMutation({
    mutationFn: async () => {
      const l = lessonQ.data as {
        id: string;
        title: string;
        bookmarked?: boolean;
        course_id: string;
      };
      if (l.bookmarked) {
        const marks = await studentLearningService.getBookmarks();
        const hit = marks.find((b) => b.target_type === "lesson" && b.target_id === l.id);
        if (hit) await studentLearningService.removeBookmark(hit.id);
        return;
      }
      await studentLearningService.addBookmark({
        target_type: "lesson",
        target_id: l.id,
        title: l.title,
        href: `${BASE}/lessons/${l.id}`,
      });
    },
    onSuccess: () => {
      toast.success("Bookmark updated");
      qc.invalidateQueries({ queryKey: ["learning-lesson", lessonId] });
    },
  });

  useEffect(() => {
    if (!lessonQ.data) return;
    const l = lessonQ.data as { watch_seconds?: number; is_completed?: boolean };
    if (l.is_completed) {
      setProgressPct(100);
      return;
    }
    const t = window.setInterval(() => {
      const next = Math.max(Number(l.watch_seconds) || 0, lastSaved.current) + 15;
      lastSaved.current = next;
      setProgressPct((p) => Math.min(99, Math.max(p, Math.round((next / 600) * 100))));
      progressMut.mutate({ watch_seconds: next });
    }, 30_000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId, lessonQ.data]);

  useEffect(() => {
    const media = document.querySelectorAll<HTMLVideoElement | HTMLAudioElement>("video, audio");
    media.forEach((el) => {
      el.playbackRate = speed;
      if (lowBandwidth && !mediaAllowed) {
        el.pause();
        el.removeAttribute("autoplay");
      }
    });
  }, [speed, lessonQ.data, lowBandwidth, mediaAllowed]);

  // Sleep timer — pause all media when it fires
  useEffect(() => {
    if (sleepTimerRef.current) {
      window.clearTimeout(sleepTimerRef.current);
      sleepTimerRef.current = null;
    }
    if (!sleepMinutes) return;
    sleepTimerRef.current = window.setTimeout(
      () => {
        document.querySelectorAll<HTMLVideoElement | HTMLAudioElement>("video, audio").forEach((el) => {
          el.pause();
        });
        toast("Sleep timer — playback paused");
        setSleepMinutes(0);
      },
      sleepMinutes * 60 * 1000
    );
    return () => {
      if (sleepTimerRef.current) window.clearTimeout(sleepTimerRef.current);
    };
  }, [sleepMinutes, lessonId]);

  const lesson = lessonQ.data as
    | {
        id: string;
        title: string;
        content_type: string;
        content_url?: string | null;
        content_text?: string | null;
        course_id: string;
        course_title: string;
        module_title: string;
        is_completed?: boolean;
        previous_lesson_id?: string | null;
        next_lesson_id?: string | null;
        bookmarked?: boolean;
        watch_seconds?: number;
      }
    | undefined;

  if (lessonQ.isLoading) return <LoadingBlock label="Loading lesson" />;
  if (lessonQ.isError || !lesson) {
    return (
      <ErrorBlock
        message="This lesson is unavailable or requires enrollment."
        onRetry={() => lessonQ.refetch()}
      />
    );
  }

  const saveNotes = () => {
    try {
      sessionStorage.setItem(NOTES_KEY(lessonId), notes);
      toast.success("Notes saved for this session");
    } catch {
      toast.error("Could not save notes");
    }
  };

  const displayPct = lesson.is_completed ? 100 : progressPct;

  return (
    <div className="mx-auto max-w-5xl space-y-4 animate-in fade-in duration-500">
      {/* Sticky mini player bar */}
      <div className="sticky top-0 z-10 -mx-1 space-y-2 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/95 sm:mx-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {lesson.module_title}
            </p>
            <p className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">{lesson.title}</p>
          </div>
          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {displayPct}%
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" aria-hidden>
          <div className="h-full rounded-full bg-admin-accent transition-all" style={{ width: `${displayPct}%` }} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex min-h-11 items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400">
            Speed
            <select
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              className="min-h-11 rounded-xl border border-slate-200 px-2 dark:border-slate-700 dark:bg-slate-900"
              aria-label="Playback speed"
            >
              {SPEEDS.map((s) => (
                <option key={s} value={s}>
                  {s}x
                </option>
              ))}
            </select>
          </label>
          <div className="inline-flex min-h-11 items-center gap-1" role="group" aria-label="Sleep timer">
            <Moon className="h-3.5 w-3.5 text-slate-400" aria-hidden />
            {SLEEP_OPTIONS.map((opt) => (
              <button
                key={opt.minutes}
                type="button"
                onClick={() => setSleepMinutes(opt.minutes)}
                className={`min-h-11 rounded-xl border px-2.5 text-xs font-bold ${
                  sleepMinutes === opt.minutes
                    ? "border-admin-accent bg-admin-accent/10 text-admin-accent"
                    : "border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          to={`${BASE}/courses/${lesson.course_id}`}
          className="inline-flex min-h-11 items-center gap-1 text-xs font-bold text-slate-500"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> {lesson.course_title}
        </Link>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => bookmarkMut.mutate()}
            className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-slate-200 px-3 text-xs font-bold dark:border-slate-700"
          >
            <Bookmark className="h-3.5 w-3.5" /> Bookmark
          </button>
          <button
            type="button"
            disabled={lesson.is_completed || progressMut.isPending}
            onClick={() =>
              progressMut.mutate(
                { is_completed: true, watch_seconds: lastSaved.current || 1 },
                { onSuccess: () => toast.success("Lesson marked complete") }
              )
            }
            className="inline-flex min-h-11 items-center gap-1 rounded-xl bg-emerald-600 px-3 text-xs font-bold text-white disabled:opacity-50"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {lesson.is_completed ? "Completed" : "Mark Complete"}
          </button>
        </div>
      </div>

      <header>
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{lesson.module_title}</p>
        <h1 className="text-xl font-black text-slate-900 dark:text-slate-50">{lesson.title}</h1>
      </header>

      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {lowBandwidth && !mediaAllowed ? (
          <div className="space-y-3 p-6 text-center">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Low bandwidth mode is on — media is paused to save data.
            </p>
            <p className="text-xs text-slate-500">
              Reading notes below still work. Load video/audio when you are ready.
            </p>
            <button
              type="button"
              onClick={() => setMediaAllowed(true)}
              className="min-h-11 rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white"
            >
              Load media
            </button>
            {lesson.content_text && (
              <div className="mt-4 rounded-xl bg-slate-50 p-4 text-left text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                {lesson.content_text.slice(0, 1200)}
                {lesson.content_text.length > 1200 ? "…" : ""}
              </div>
            )}
          </div>
        ) : (
          <div style={{ ["--playback-rate" as string]: String(speed) }}>
            <LessonContentRenderer
              contentType={lesson.content_type}
              contentUrl={lesson.content_url}
              contentText={lesson.content_text}
              title={lesson.title}
              onEnded={() =>
                progressMut.mutate({ is_completed: true, watch_seconds: lastSaved.current || 1 })
              }
            />
          </div>
        )}
      </div>

      <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-2 text-sm font-black text-slate-900 dark:text-slate-100">Notes</h2>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          placeholder="Jot down key takeaways…"
          aria-label="Lesson notes"
        />
        <button
          type="button"
          onClick={saveNotes}
          className="mt-2 min-h-11 rounded-xl border border-slate-200 px-3 text-xs font-bold dark:border-slate-700"
        >
          Save notes
        </button>
      </section>

      <nav className="flex items-center justify-between gap-3 pb-2" aria-label="Lesson navigation">
        <button
          type="button"
          disabled={!lesson.previous_lesson_id}
          onClick={() =>
            lesson.previous_lesson_id && navigate(`${BASE}/lessons/${lesson.previous_lesson_id}`)
          }
          className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-slate-200 px-4 text-xs font-bold disabled:opacity-40 dark:border-slate-700"
        >
          <ChevronLeft className="h-4 w-4" /> Previous
        </button>
        <button
          type="button"
          disabled={!lesson.next_lesson_id}
          onClick={() => lesson.next_lesson_id && navigate(`${BASE}/lessons/${lesson.next_lesson_id}`)}
          className="inline-flex min-h-11 items-center gap-1 rounded-xl bg-indigo-600 px-4 text-xs font-bold text-white disabled:opacity-40"
        >
          Next <ChevronRight className="h-4 w-4" />
        </button>
      </nav>
    </div>
  );
}
