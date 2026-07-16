import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { ArrowLeft, Trash2 } from "lucide-react";
import studentLearningService from "../../../../services/studentLearningService";
import { BASE, EmptyBlock, ErrorBlock, LoadingBlock, ProgressBar } from "./components";

function Back() {
  return (
    <Link to={BASE} className="inline-flex items-center gap-1 text-xs font-bold text-slate-500">
      <ArrowLeft className="h-3.5 w-3.5" /> My Learning
    </Link>
  );
}

export function ProgressPage() {
  const q = useQuery({
    queryKey: ["learning-progress"],
    queryFn: () => studentLearningService.getProgress(),
  });
  if (q.isLoading) return <LoadingBlock />;
  if (q.isError || !q.data) return <ErrorBlock message="Couldn’t load progress." onRetry={() => q.refetch()} />;
  const data = q.data as {
    overall: { overall_progress_percent: number; learning_hours: number; learning_streak_days: number };
    courses: Array<{ course_id: string; title: string; progress_percent: number; status: string }>;
    lessons_completed: number;
    lessons_total: number;
    completion_timeline: Array<{ day: string; lessons_completed: number }>;
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5 animate-in fade-in duration-500">
      <Back />
      <h1 className="text-2xl font-black text-slate-900">Learning Progress</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-100 bg-white p-4">
          <p className="text-[10px] font-bold uppercase text-slate-400">Overall</p>
          <p className="text-2xl font-black text-indigo-600">{data.overall.overall_progress_percent}%</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4">
          <p className="text-[10px] font-bold uppercase text-slate-400">Lessons</p>
          <p className="text-2xl font-black text-slate-900">
            {data.lessons_completed}/{data.lessons_total}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4">
          <p className="text-[10px] font-bold uppercase text-slate-400">Hours</p>
          <p className="text-2xl font-black text-slate-900">{data.overall.learning_hours}</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4">
          <p className="text-[10px] font-bold uppercase text-slate-400">Streak</p>
          <p className="text-2xl font-black text-slate-900">{data.overall.learning_streak_days}d</p>
        </div>
      </div>
      <section className="space-y-2">
        <h2 className="text-sm font-black">Course progress</h2>
        {!data.courses.length ? (
          <EmptyBlock title="No enrolled courses yet" />
        ) : (
          data.courses.map((c) => (
            <Link
              key={c.course_id}
              to={`${BASE}/courses/${c.course_id}`}
              className="block rounded-2xl border border-slate-100 bg-white p-4"
            >
              <div className="mb-2 flex justify-between gap-2">
                <p className="text-sm font-bold text-slate-900">{c.title}</p>
                <span className="text-xs capitalize text-slate-400">{c.status.replace(/_/g, " ")}</span>
              </div>
              <ProgressBar value={c.progress_percent} />
            </Link>
          ))
        )}
      </section>
      {!!data.completion_timeline?.length && (
        <section>
          <h2 className="mb-2 text-sm font-black">Completion timeline</h2>
          <ul className="space-y-1 text-xs text-slate-600">
            {data.completion_timeline.map((t) => (
              <li key={t.day} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2">
                <span>{new Date(t.day).toLocaleDateString()}</span>
                <span className="font-bold">{t.lessons_completed} lessons</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export function BookmarksPage() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["learning-bookmarks"],
    queryFn: () => studentLearningService.getBookmarks(),
  });
  const del = useMutation({
    mutationFn: (id: string) => studentLearningService.removeBookmark(id),
    onSuccess: () => {
      toast.success("Bookmark removed");
      qc.invalidateQueries({ queryKey: ["learning-bookmarks"] });
    },
  });

  if (q.isLoading) return <LoadingBlock />;
  if (q.isError) return <ErrorBlock message="Couldn’t load bookmarks." onRetry={() => q.refetch()} />;

  return (
    <div className="mx-auto max-w-3xl space-y-5 animate-in fade-in duration-500">
      <Back />
      <h1 className="text-2xl font-black text-slate-900">Bookmarks</h1>
      {!q.data?.length ? (
        <EmptyBlock title="No bookmarks yet" hint="Bookmark courses, lessons, or resources while learning." />
      ) : (
        <ul className="space-y-2">
          {q.data.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3">
              <Link to={b.href || BASE} className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-900">{b.title || b.target_type}</p>
                <p className="text-[11px] capitalize text-slate-400">{b.target_type}</p>
              </Link>
              <button
                type="button"
                onClick={() => del.mutate(b.id)}
                className="rounded-lg p-2 text-rose-500 hover:bg-rose-50"
                aria-label="Remove bookmark"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function CalendarPage() {
  const q = useQuery({
    queryKey: ["learning-events", 60],
    queryFn: () => studentLearningService.getLearningEvents(60),
  });
  if (q.isLoading) return <LoadingBlock />;
  if (q.isError) return <ErrorBlock message="Couldn’t load calendar." onRetry={() => q.refetch()} />;

  return (
    <div className="mx-auto max-w-3xl space-y-5 animate-in fade-in duration-500">
      <Back />
      <h1 className="text-2xl font-black text-slate-900">Learning Calendar</h1>
      {!q.data?.length ? (
        <EmptyBlock title="No upcoming learning events" />
      ) : (
        <ul className="space-y-2">
          {q.data.map((e) => (
            <li key={e.id}>
              <Link to={e.href} className="block rounded-2xl border border-slate-100 bg-white px-4 py-3 hover:border-indigo-100">
                <p className="text-sm font-bold text-slate-900">{e.title}</p>
                <p className="text-[11px] capitalize text-slate-400">
                  {e.type.replace(/_/g, " ")}
                  {e.starts_at || e.ends_at
                    ? ` · ${new Date(e.starts_at || e.ends_at || "").toLocaleString()}`
                    : ""}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function CertificatesPage() {
  const q = useQuery({
    queryKey: ["learning-certificates"],
    queryFn: () => studentLearningService.getCertificates(),
  });
  if (q.isLoading) return <LoadingBlock />;
  if (q.isError) return <ErrorBlock message="Couldn’t load certificates." onRetry={() => q.refetch()} />;

  return (
    <div className="mx-auto max-w-3xl space-y-5 animate-in fade-in duration-500">
      <Back />
      <h1 className="text-2xl font-black text-slate-900">Certificates</h1>
      {!q.data?.length ? (
        <EmptyBlock title="No certificates earned yet" />
      ) : (
        <ul className="space-y-2">
          {q.data.map((c) => (
            <li key={c.id} className="rounded-2xl border border-slate-100 bg-white px-4 py-3">
              <p className="text-sm font-bold text-slate-900">{c.title || c.course_title}</p>
              <p className="text-[11px] text-slate-400">
                Issued {c.issue_date ? new Date(c.issue_date).toLocaleDateString() : "—"} · ID{" "}
                {c.certificate_id}
              </p>
              <Link to={`/app/certificate/${c.id}`} className="mt-2 inline-block text-xs font-bold text-indigo-600">
                View / Download
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ResourcesPage() {
  const q = useQuery({
    queryKey: ["learning-resources"],
    queryFn: () => studentLearningService.getResources(),
  });
  const qc = useQueryClient();
  const bookmark = useMutation({
    mutationFn: (r: { id: string; title: string }) =>
      studentLearningService.addBookmark({
        target_type: "resource",
        target_id: r.id,
        title: r.title,
        href: `${BASE}/lessons/${r.id}`,
      }),
    onSuccess: () => {
      toast.success("Bookmarked");
      qc.invalidateQueries({ queryKey: ["learning-bookmarks"] });
    },
  });

  if (q.isLoading) return <LoadingBlock />;
  if (q.isError) return <ErrorBlock message="Couldn’t load resources." onRetry={() => q.refetch()} />;

  const rows = (q.data || []) as Array<{
    id: string;
    title: string;
    type: string;
    url: string | null;
    course_title: string;
  }>;

  return (
    <div className="mx-auto max-w-3xl space-y-5 animate-in fade-in duration-500">
      <Back />
      <h1 className="text-2xl font-black text-slate-900">Learning Resources</h1>
      {!rows.length ? (
        <EmptyBlock title="No resources yet" />
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-100 bg-white px-4 py-3">
              <div>
                <p className="text-sm font-bold text-slate-900">{r.title}</p>
                <p className="text-[11px] text-slate-400">
                  {r.course_title} · {r.type}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => bookmark.mutate(r)}
                  className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold"
                >
                  Bookmark
                </button>
                {r.url ? (
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white"
                  >
                    Open
                  </a>
                ) : (
                  <Link
                    to={`${BASE}/lessons/${r.id}`}
                    className="rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white"
                  >
                    Preview
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
