// =============================================================================
// All Knowledge — unified browse (Sprint 1+2 asset types)
// =============================================================================

import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  BookOpen,
  Boxes,
  ClipboardList,
  Code2,
  FileStack,
  FileText,
  ListChecks,
  Loader2,
  Mic,
  Video,
} from "lucide-react";
import toast from "react-hot-toast";
import KnowledgeObjectCard from "../../../components/superadmin/learning-companion/KnowledgeObjectCard";
import questionBankService, { type Question } from "../../../services/questionBankService";
import superadminFeaturesService, {
  type ContentLibraryItem,
  type Flashcard,
  type PublishedLesson,
} from "../../../services/superadminFeaturesService";
import KnowledgeFilterBar, { EMPTY_FILTERS, type KnowledgeFilters } from "./KnowledgeFilterBar";

type Kind =
  | "all"
  | "lessons"
  | "questions"
  | "coding"
  | "flashcards"
  | "cases"
  | "interview"
  | "voice"
  | "videos"
  | "documents";

function isVideoLesson(l: PublishedLesson) {
  const type = (l.content_type || "").toLowerCase();
  if (type === "video" || type.includes("video")) return true;
  const url = (l.content_url || "").toLowerCase();
  return /\.(mp4|webm|mov|m4v)(\?|$)/.test(url) || url.includes("youtube") || url.includes("vimeo");
}

const KIND_TABS: { key: Kind; label: string }[] = [
  { key: "all", label: "Everything" },
  { key: "lessons", label: "Lessons" },
  { key: "questions", label: "Questions" },
  { key: "coding", label: "Coding" },
  { key: "flashcards", label: "Flashcards" },
  { key: "cases", label: "Cases" },
  { key: "interview", label: "Interview" },
  { key: "voice", label: "Voice" },
  { key: "videos", label: "Videos" },
  { key: "documents", label: "Documents" },
];

export default function AllKnowledgePage() {
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState<KnowledgeFilters>({
    ...EMPTY_FILTERS,
    tag: searchParams.get("tag") || "",
    category: searchParams.get("category") || "",
    type: searchParams.get("type") || "",
    status: searchParams.get("status") || "",
  });
  const [kind, setKind] = useState<Kind>("all");
  const [debounced, setDebounced] = useState(filters.search);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [coding, setCoding] = useState<Question[]>([]);
  const [qTotal, setQTotal] = useState(0);
  const [codingTotal, setCodingTotal] = useState(0);
  const [lessons, setLessons] = useState<PublishedLesson[]>([]);
  const [voice, setVoice] = useState<PublishedLesson[]>([]);
  const [videos, setVideos] = useState<PublishedLesson[]>([]);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [cases, setCases] = useState<ContentLibraryItem[]>([]);
  const [interview, setInterview] = useState<ContentLibraryItem[]>([]);
  const [documents, setDocuments] = useState<ContentLibraryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(filters.search), 300);
    return () => clearTimeout(t);
  }, [filters.search]);

  useEffect(() => {
    setLoading(true);
    const want = (k: Kind) => kind === "all" || kind === k;

    const jobs: Promise<void>[] = [];

    if (want("questions")) {
      jobs.push(
        questionBankService
          .searchQuestions({
            search: debounced || undefined,
            category: filters.category || undefined,
            type: filters.type || "multiple_choice",
            difficulty: filters.difficulty || undefined,
            status: filters.status || undefined,
            tags: filters.tag ? [filters.tag] : undefined,
            page: 1,
            limit: 18,
          })
          .then((q) => {
            setQuestions(q.questions);
            setQTotal(q.total);
          })
          .catch(() => {
            toast.error("Failed to load questions");
            setQuestions([]);
            setQTotal(0);
          })
      );
    } else {
      setQuestions([]);
      setQTotal(0);
    }

    if (want("coding") || (kind === "all" && !filters.type)) {
      jobs.push(
        questionBankService
          .searchQuestions({
            search: debounced || undefined,
            category: filters.category || undefined,
            type: "coding_challenge",
            difficulty: filters.difficulty || undefined,
            status: filters.status || undefined,
            tags: filters.tag ? [filters.tag] : undefined,
            page: 1,
            limit: 12,
          })
          .then((q) => {
            setCoding(q.questions);
            setCodingTotal(q.total);
          })
          .catch(() => {
            setCoding([]);
            setCodingTotal(0);
          })
      );
    } else {
      setCoding([]);
      setCodingTotal(0);
    }

    if (want("lessons") || want("videos")) {
      jobs.push(
        superadminFeaturesService
          .listLessons({ search: debounced || undefined })
          .then((list) => {
            let lessonRows = list.filter((l) => !isVideoLesson(l));
            let videoRows = list.filter(isVideoLesson);
            if (filters.category) {
              const needle = filters.category.replace(/_/g, " ").toLowerCase();
              const match = (r: PublishedLesson) =>
                (r.course_category || "").toLowerCase().includes(needle) ||
                (r.title || "").toLowerCase().includes(needle);
              lessonRows = lessonRows.filter(match);
              videoRows = videoRows.filter(match);
            }
            setLessons(want("lessons") ? lessonRows : []);
            setVideos(want("videos") ? videoRows : []);
          })
          .catch(() => {
            toast.error("Failed to load lessons");
            setLessons([]);
            setVideos([]);
          })
      );
    } else {
      setLessons([]);
      setVideos([]);
    }

    if (want("voice")) {
      jobs.push(
        superadminFeaturesService
          .listLessons({ voice: true, search: debounced || undefined })
          .then(setVoice)
          .catch(() => setVoice([]))
      );
    } else {
      setVoice([]);
    }

    if (want("flashcards")) {
      jobs.push(
        superadminFeaturesService
          .listFlashcards({
            search: debounced || undefined,
            category: filters.category || undefined,
          })
          .then(setFlashcards)
          .catch(() => setFlashcards([]))
      );
    } else {
      setFlashcards([]);
    }

    if (want("cases")) {
      jobs.push(
        superadminFeaturesService
          .listContentLibrary({
            content_type: "case_study",
            search: debounced || undefined,
            status: filters.status || "published",
          })
          .then(setCases)
          .catch(() => setCases([]))
      );
    } else {
      setCases([]);
    }

    if (want("interview")) {
      jobs.push(
        superadminFeaturesService
          .listContentLibrary({
            content_type: "interview_question",
            search: debounced || undefined,
            status: filters.status || "published",
          })
          .then(setInterview)
          .catch(() => setInterview([]))
      );
    } else {
      setInterview([]);
    }

    if (want("documents")) {
      jobs.push(
        superadminFeaturesService
          .listContentLibrary({
            content_type: "learning_resource",
            search: debounced || undefined,
            status: filters.status || "published",
          })
          .then(setDocuments)
          .catch(() => setDocuments([]))
      );
    } else {
      setDocuments([]);
    }

    Promise.all(jobs).finally(() => setLoading(false));
  }, [kind, debounced, filters.category, filters.type, filters.difficulty, filters.status, filters.tag]);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">All Knowledge</h2>
        <p className="text-sm text-gray-500">
          Browse every asset type in one stream. Topic parenting arrives in Sprint 3.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {KIND_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setKind(t.key)}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
              kind === t.key
                ? "border-navy-900 bg-navy-900 text-white"
                : "border-gray-200 bg-white text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <KnowledgeFilterBar
        value={filters}
        onChange={setFilters}
        showType={kind === "all" || kind === "questions"}
        showStatus={kind === "all" || kind === "questions" || kind === "coding" || kind === "cases" || kind === "interview" || kind === "documents"}
        showTag
        searchPlaceholder="Natural language or keyword search…"
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
        </div>
      ) : (
        <div className="space-y-8">
          <Section
            show={kind === "all" || kind === "lessons"}
            title="Lessons"
            count={lessons.length}
            href="/app/superadmin/knowledge-library/assets/lessons"
            icon={BookOpen}
            empty="No lessons match."
          >
            <div className="grid sm:grid-cols-2 gap-3">
              {lessons.slice(0, 12).map((l) => (
                <LessonCard key={l.id} lesson={l} kind="Lesson" />
              ))}
            </div>
          </Section>

          <Section
            show={kind === "all" || kind === "questions"}
            title="Questions"
            count={qTotal}
            href="/app/superadmin/knowledge-library/assets/questions"
            icon={ListChecks}
            empty="No questions match."
          >
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {questions.map((q) => (
                <KnowledgeObjectCard key={q.id} question={q} />
              ))}
            </div>
          </Section>

          <Section
            show={kind === "all" || kind === "coding"}
            title="Coding Challenges"
            count={codingTotal}
            href="/app/superadmin/knowledge-library/assets/coding"
            icon={Code2}
            empty="No coding challenges match."
          >
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {coding.map((q) => (
                <KnowledgeObjectCard key={q.id} question={q} />
              ))}
            </div>
          </Section>

          <Section
            show={kind === "all" || kind === "flashcards"}
            title="Flashcards"
            count={flashcards.length}
            href="/app/superadmin/knowledge-library/assets/flashcards"
            icon={FileStack}
            empty="No flashcards match."
          >
            <div className="grid sm:grid-cols-2 gap-3">
              {flashcards.slice(0, 12).map((f) => (
                <div key={f.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-admin-card">
                  <p className="text-[11px] uppercase text-gray-400 mb-1">Flashcard</p>
                  <p className="font-medium text-gray-900">{f.front}</p>
                  <p className="mt-2 text-sm text-gray-600 border-t border-gray-100 pt-2 line-clamp-2">{f.back}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section
            show={kind === "all" || kind === "cases"}
            title="Case Studies"
            count={cases.length}
            href="/app/superadmin/knowledge-library/assets/case-studies"
            icon={Boxes}
            empty="No case studies match."
          >
            <ContentCards items={cases.slice(0, 12)} label="Case" />
          </Section>

          <Section
            show={kind === "all" || kind === "interview"}
            title="Interview Questions"
            count={interview.length}
            href="/app/superadmin/knowledge-library/assets/interview-questions"
            icon={ClipboardList}
            empty="No interview questions match."
          >
            <ContentCards items={interview.slice(0, 12)} label="Interview" />
          </Section>

          <Section
            show={kind === "all" || kind === "voice"}
            title="Voice Lessons"
            count={voice.length}
            href="/app/superadmin/knowledge-library/assets/voice-lessons"
            icon={Mic}
            empty="No voice lessons match."
          >
            <div className="grid sm:grid-cols-2 gap-3">
              {voice.slice(0, 12).map((l) => (
                <LessonCard key={l.id} lesson={l} kind="Voice" />
              ))}
            </div>
          </Section>

          <Section
            show={kind === "all" || kind === "videos"}
            title="Videos"
            count={videos.length}
            href="/app/superadmin/knowledge-library/assets/videos"
            icon={Video}
            empty="No videos match."
          >
            <div className="grid sm:grid-cols-2 gap-3">
              {videos.slice(0, 12).map((l) => (
                <LessonCard key={l.id} lesson={l} kind="Video" />
              ))}
            </div>
          </Section>

          <Section
            show={kind === "all" || kind === "documents"}
            title="Documents"
            count={documents.length}
            href="/app/superadmin/knowledge-library/assets/documents"
            icon={FileText}
            empty="No documents match."
          >
            <ContentCards items={documents.slice(0, 12)} label="Document" />
          </Section>
        </div>
      )}
    </div>
  );
}

function Section({
  show,
  title,
  count,
  href,
  icon: Icon,
  empty,
  children,
}: {
  show: boolean;
  title: string;
  count: number;
  href: string;
  icon: typeof BookOpen;
  empty: string;
  children: React.ReactNode;
}) {
  if (!show) return null;
  const emptyState = count === 0;
  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <Icon className="w-4 h-4" /> {title}
          <span className="text-gray-400 font-normal">({count})</span>
        </h3>
        <Link to={href} className="text-xs text-admin-accent hover:underline">
          View all →
        </Link>
      </div>
      {emptyState ? (
        <p className="text-sm text-gray-400 py-6 text-center border border-dashed border-gray-200 rounded-xl">{empty}</p>
      ) : (
        children
      )}
    </section>
  );
}

function LessonCard({ lesson, kind }: { lesson: PublishedLesson; kind: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-admin-card">
      <p className="text-[11px] uppercase tracking-wide text-gray-400">{kind}</p>
      <h4 className="font-medium text-gray-900 mt-1">{lesson.title}</h4>
      <p className="text-xs text-gray-500 mt-1">
        {lesson.course_title} · {lesson.module_title}
      </p>
      {lesson.content_text ? (
        <p className="mt-2 text-sm text-gray-600 line-clamp-2">{lesson.content_text}</p>
      ) : null}
    </div>
  );
}

function ContentCards({ items, label }: { items: ContentLibraryItem[]; label: string }) {
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-admin-card">
          <p className="text-[11px] uppercase tracking-wide text-gray-400">{label}</p>
          <h4 className="font-medium text-gray-900 mt-1">{item.title}</h4>
          <p className="text-xs text-gray-500 mt-1">
            {item.category} · {item.difficulty}
          </p>
          {item.body ? <p className="mt-2 text-sm text-gray-600 line-clamp-2">{item.body}</p> : null}
        </div>
      ))}
    </div>
  );
}
