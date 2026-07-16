import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  Play,
  Download,
} from "lucide-react";
import studentLearningService from "../../../../services/studentLearningService";
import { BASE, EmptyBlock, ErrorBlock, LoadingBlock, ProgressBar, StatusPill } from "./components";

type Lesson = {
  id: string;
  title: string;
  content_type: string;
  is_completed?: boolean;
  watch_seconds?: number;
};

type Module = {
  id: string;
  title: string;
  lessons: Lesson[];
};

export default function CourseDetailPage() {
  const { courseId = "" } = useParams();
  const qc = useQueryClient();

  const courseQ = useQuery({
    queryKey: ["learning-course", courseId],
    queryFn: () => studentLearningService.getCourse(courseId),
    enabled: !!courseId,
  });

  const bookmarkMut = useMutation({
    mutationFn: async () => {
      const c = courseQ.data as { id: string; title: string; bookmarked?: boolean };
      if (c.bookmarked) {
        const marks = await studentLearningService.getBookmarks();
        const hit = marks.find((b) => b.target_type === "course" && b.target_id === c.id);
        if (hit) await studentLearningService.removeBookmark(hit.id);
        return;
      }
      await studentLearningService.addBookmark({
        target_type: "course",
        target_id: c.id,
        title: c.title,
        href: `${BASE}/courses/${c.id}`,
      });
    },
    onSuccess: () => {
      toast.success("Bookmarks updated");
      qc.invalidateQueries({ queryKey: ["learning-course", courseId] });
      qc.invalidateQueries({ queryKey: ["learning-bookmarks"] });
    },
    onError: () => toast.error("Could not update bookmark"),
  });

  const course = courseQ.data as {
    id: string;
    title: string;
    description?: string;
    objectives?: string;
    skills_covered?: string[];
    prerequisites?: string[];
    instructor_name?: string;
    category?: string;
    difficulty?: string;
    progress_percent?: number;
    enrollment?: { id: string } | null;
    modules?: Module[];
    resources?: Array<{ id: string; title: string; url: string | null; type: string }>;
    certificate_eligible?: boolean;
    bookmarked?: boolean;
  } | undefined;

  const nextLesson = useMemo(() => {
    if (!course?.modules) return null;
    for (const m of course.modules) {
      for (const l of m.lessons || []) {
        if (!l.is_completed) return l;
      }
    }
    const first = course.modules[0]?.lessons?.[0];
    return first || null;
  }, [course]);

  if (courseQ.isLoading) return <LoadingBlock label="Loading course" />;
  if (courseQ.isError || !course) {
    return <ErrorBlock message="Course unavailable or not assigned." onRetry={() => courseQ.refetch()} />;
  }

  const started = Boolean(course.enrollment);

  return (
    <div className="mx-auto max-w-5xl space-y-5 animate-in fade-in duration-500">
      <Link to={BASE} className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-3.5 w-3.5" /> My Learning
      </Link>

      <header className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mb-2 flex flex-wrap gap-2">
              {course.category && <StatusPill status="available" />}
              {course.difficulty && (
                <span className="rounded-lg bg-slate-50 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-500">
                  {course.difficulty}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-black text-slate-900">{course.title}</h1>
            <p className="mt-1 text-sm text-slate-500">{course.instructor_name || "Instructor TBA"}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => bookmarkMut.mutate()}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold"
              aria-pressed={course.bookmarked}
            >
              {course.bookmarked ? <BookmarkCheck className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
              Bookmark
            </button>
            {nextLesson && (
              <Link
                to={`${BASE}/lessons/${nextLesson.id}`}
                className="inline-flex items-center gap-1 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white"
              >
                <Play className="h-3.5 w-3.5" /> {started ? "Continue" : "Start Course"}
              </Link>
            )}
          </div>
        </div>
        {started && (
          <div className="mt-4 max-w-md">
            <ProgressBar value={course.progress_percent || 0} label="Your progress" />
          </div>
        )}
        {course.certificate_eligible && (
          <p className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-emerald-600">
            <CheckCircle2 className="h-3.5 w-3.5" /> Certificate eligible
          </p>
        )}
      </header>

      <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-black text-slate-900">Overview</h2>
        <p className="mt-2 text-sm text-slate-600 whitespace-pre-wrap">
          {course.description || course.objectives || "No overview provided."}
        </p>
        {!!course.skills_covered?.length && (
          <>
            <h3 className="mt-4 text-xs font-bold uppercase tracking-wider text-slate-400">Skills covered</h3>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {course.skills_covered.map((s) => (
                <li key={s} className="rounded-lg bg-indigo-50 px-2 py-1 text-[11px] font-bold text-indigo-700">
                  {s}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm" aria-labelledby="lessons-heading">
        <h2 id="lessons-heading" className="mb-3 text-sm font-black text-slate-900">
          Lessons
        </h2>
        {!course.modules?.length ? (
          <EmptyBlock title="No lessons published yet" />
        ) : (
          <ol className="space-y-4">
            {course.modules.map((m) => (
              <li key={m.id}>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">{m.title}</h3>
                <ul className="space-y-1">
                  {(m.lessons || []).map((l) => (
                    <li key={l.id}>
                      <Link
                        to={`${BASE}/lessons/${l.id}`}
                        aria-label={`${l.is_completed ? "Completed" : "Open"} lesson: ${l.title}`}
                        className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 hover:bg-slate-50"
                      >
                        <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
                          {l.is_completed ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden />
                          ) : (
                            <Play className="h-4 w-4 text-indigo-400" aria-hidden />
                          )}
                          {l.title}
                        </span>
                        <span className="text-[10px] font-bold uppercase text-slate-400" aria-hidden>
                          {l.content_type}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        )}
      </section>

      {!!course.resources?.length && (
        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-black text-slate-900">Resources</h2>
          <ul className="space-y-2">
            {course.resources.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="font-semibold text-slate-700">{r.title}</span>
                {r.url ? (
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600"
                  >
                    <Download className="h-3.5 w-3.5" /> Download
                  </a>
                ) : (
                  <Link to={`${BASE}/lessons/${r.id}`} className="text-xs font-bold text-indigo-600">
                    Open
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
