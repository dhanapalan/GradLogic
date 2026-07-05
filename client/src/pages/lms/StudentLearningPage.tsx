// =============================================================================
// LMS — Student Learning Page
// Course Catalog · My Enrollments · Lesson Player
// =============================================================================

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate, Link } from "react-router";
import api from "../../lib/api";
import LessonContentRenderer from "../../components/LessonContentRenderer";
import {
  BookOpen,
  Play,
  CheckCircle2,
  Clock,
  Users,
  ChevronRight,
  ChevronLeft,
  Filter,
  Search,
  Award,
  Lock,
  FileText,
  Video,
  Code2,
  Layers,
  GraduationCap,
  BarChart3,
} from "lucide-react";
import toast from "react-hot-toast";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Course {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: string;
  duration_hours: number;
  thumbnail_url: string | null;
  total_modules: number;
  total_enrollments: number;
  is_free: boolean;
  tags: string[];
  status: string;
}

interface Enrollment {
  id: string;
  course_id: string;
  enrolled_at: string;
  completed_at: string | null;
  progress_percent: number;
  status: string;
}

interface Module {
  id: string;
  title: string;
  sort_order: number;
  is_locked: boolean;
  estimated_minutes: number;
  lessons: Lesson[];
}

interface Lesson {
  id: string;
  title: string;
  content_type: string;
  content_url: string | null;
  content_text: string | null;
  video_duration_seconds: number | null;
  sort_order: number;
  is_free_preview: boolean;
  is_completed?: boolean;
  watch_seconds?: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  aptitude: "bg-blue-100 text-blue-700",
  dsa: "bg-purple-100 text-purple-700",
  reasoning: "bg-green-100 text-green-700",
  sql: "bg-orange-100 text-orange-700",
  soft_skills: "bg-pink-100 text-pink-700",
  verbal: "bg-teal-100 text-teal-700",
  programming: "bg-indigo-100 text-indigo-700",
};

const DIFFICULTY_COLOR: Record<string, string> = {
  beginner: "bg-green-50 text-green-700",
  intermediate: "bg-amber-50 text-amber-700",
  advanced: "bg-red-50 text-red-700",
};

const CONTENT_ICON: Record<string, typeof Play> = {
  video: Video,
  pdf: FileText,
  text: FileText,
  quiz: BarChart3,
  coding: Code2,
};

function fmtDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

// ─── CourseCard ───────────────────────────────────────────────────────────────

function CourseCard({
  course,
  enrollment,
  onEnroll,
  enrolling,
}: {
  course: Course;
  enrollment?: Enrollment;
  onEnroll: (id: string) => void;
  enrolling: boolean;
}) {
  const navigate = useNavigate();
  const catCls = CATEGORY_COLORS[course.category] || "bg-slate-100 text-slate-600";
  const diffCls = DIFFICULTY_COLOR[course.difficulty] || "bg-slate-100 text-slate-600";

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      {/* Thumbnail */}
      <div className="h-36 bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
        <GraduationCap className="h-12 w-12 text-indigo-300" />
      </div>

      <div className="p-4 flex-1 flex flex-col">
        {/* Badges */}
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${catCls}`}>
            {course.category}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${diffCls}`}>
            {course.difficulty}
          </span>
          {course.is_free && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">
              Free
            </span>
          )}
        </div>

        <h3 className="font-semibold text-slate-800 text-sm leading-snug mb-1 line-clamp-2">
          {course.title}
        </h3>
        {course.description && (
          <p className="text-xs text-slate-500 line-clamp-2 mb-3">{course.description}</p>
        )}

        {/* Meta */}
        <div className="flex items-center gap-3 text-xs text-slate-400 mb-4 mt-auto">
          <span className="flex items-center gap-1">
            <Layers className="h-3 w-3" />
            {course.total_modules} modules
          </span>
          {course.duration_hours && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {course.duration_hours}h
            </span>
          )}
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {course.total_enrollments}
          </span>
        </div>

        {/* Progress / Enroll */}
        {enrollment ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">
                {enrollment.status === "completed" ? "Completed" : "In progress"}
              </span>
              <span className="text-xs font-semibold text-indigo-600">
                {enrollment.progress_percent}%
              </span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full">
              <div
                className={`h-1.5 rounded-full ${
                  enrollment.status === "completed" ? "bg-green-500" : "bg-indigo-500"
                }`}
                style={{ width: `${enrollment.progress_percent}%` }}
              />
            </div>
            <button
              onClick={() => navigate(`/app/lms/courses/${course.id}`)}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-2 rounded-xl text-sm font-medium hover:bg-indigo-700"
            >
              <Play className="h-3.5 w-3.5" />
              {enrollment.progress_percent > 0 ? "Continue" : "Start Learning"}
            </button>
          </div>
        ) : (
          <button
            onClick={() => onEnroll(course.id)}
            disabled={enrolling}
            className="w-full flex items-center justify-center gap-2 border border-indigo-600 text-indigo-600 py-2 rounded-xl text-sm font-medium hover:bg-indigo-50 disabled:opacity-50"
          >
            <BookOpen className="h-3.5 w-3.5" />
            Enrol Free
          </button>
        )}
      </div>
    </div>
  );
}

// ─── CourseDetailPage ────────────────────────────────────────────────────────

export function CourseDetailPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);

  const { data: course, isLoading: loadingCourse } = useQuery({
    queryKey: ["lms-course", courseId],
    queryFn: async () => {
      const { data } = await api.get(`/lms/courses/${courseId}`);
      return data.data as Course;
    },
    enabled: !!courseId,
  });

  const { data: modules, isLoading: loadingModules } = useQuery({
    queryKey: ["lms-modules", courseId],
    queryFn: async () => {
      const { data } = await api.get(`/lms/courses/${courseId}/modules`);
      return data.data as Module[];
    },
    enabled: !!courseId,
  });

  const { data: progress } = useQuery({
    queryKey: ["lms-progress", courseId],
    queryFn: async () => {
      const { data } = await api.get(`/lms/courses/${courseId}/my-progress`);
      return data.data;
    },
    enabled: !!courseId,
  });

  const markProgress = useMutation({
    mutationFn: async (lessonId: string) => {
      const { data } = await api.put(`/lms/lessons/${lessonId}/progress`, {
        is_completed: true,
        watch_seconds: activeLesson?.video_duration_seconds || 0,
      });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lms-progress", courseId] });
      qc.invalidateQueries({ queryKey: ["lms-modules", courseId] });
      toast.success("Lesson marked complete");
    },
  });

  if (loadingCourse || loadingModules) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  if (!course) return <div className="text-center py-16 text-slate-500">Course not found</div>;

  const allLessons = (modules || []).flatMap((m) => m.lessons || []);
  const completedLessons = (progress?.lesson_progress || []).filter(
    (lp: any) => lp.is_completed
  ).length;
  const pct = allLessons.length > 0 ? Math.round((completedLessons / allLessons.length) * 100) : 0;

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      {/* Back */}
      <button
        onClick={() => navigate("/app/lms/catalog")}
        className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-5"
      >
        <ChevronLeft className="h-4 w-4" />
        Course Catalog
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Modules list */}
        <div className="lg:col-span-1 space-y-3">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h2 className="font-bold text-slate-800 mb-1">{course.title}</h2>
            <p className="text-xs text-slate-500 mb-4">{course.description}</p>
            {/* Overall progress */}
            <div className="mb-1 flex justify-between text-xs text-slate-500">
              <span>Progress</span>
              <span className="font-semibold text-indigo-600">{pct}%</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full mb-4">
              <div
                className="h-2 rounded-full bg-indigo-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* Modules */}
          {(modules || []).map((mod) => (
            <div key={mod.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 border-b border-slate-100">
                {mod.is_locked ? (
                  <Lock className="h-3.5 w-3.5 text-slate-400" />
                ) : (
                  <Layers className="h-3.5 w-3.5 text-indigo-500" />
                )}
                <span className="text-sm font-semibold text-slate-700">{mod.title}</span>
                {mod.estimated_minutes && (
                  <span className="ml-auto text-xs text-slate-400">{mod.estimated_minutes}m</span>
                )}
              </div>
              <div className="divide-y divide-slate-100">
                {(mod.lessons || []).map((lesson) => {
                  const Icon = CONTENT_ICON[lesson.content_type] || Play;
                  const lessonProgress = (progress?.lesson_progress || []).find(
                    (lp: any) => lp.lesson_id === lesson.id
                  );
                  const isDone = lessonProgress?.is_completed;
                  return (
                    <button
                      key={lesson.id}
                      disabled={mod.is_locked}
                      onClick={() => setActiveLesson(lesson)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 disabled:cursor-not-allowed transition-colors ${
                        activeLesson?.id === lesson.id ? "bg-indigo-50" : ""
                      }`}
                    >
                      <div
                        className={`h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                          isDone ? "bg-green-100" : "bg-slate-100"
                        }`}
                      >
                        {isDone ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                        ) : (
                          <Icon className="h-3.5 w-3.5 text-slate-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-700 truncate">{lesson.title}</p>
                        <p className="text-xs text-slate-400 capitalize">
                          {lesson.content_type}
                          {lesson.video_duration_seconds &&
                            ` · ${fmtDuration(lesson.video_duration_seconds)}`}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Right: Lesson viewer */}
        <div className="lg:col-span-2">
          {activeLesson ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              {/* Lesson header */}
              <div className="px-6 pt-5 pb-4 border-b border-slate-100 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="font-bold text-slate-800 truncate">{activeLesson.title}</h2>
                  <p className="text-xs text-slate-400 capitalize mt-0.5">
                    {activeLesson.content_type} lesson
                    {activeLesson.video_duration_seconds
                      ? ` · ${fmtDuration(activeLesson.video_duration_seconds)}`
                      : ""}
                  </p>
                </div>
                {activeLesson.is_completed ? (
                  <span className="shrink-0 flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Completed
                  </span>
                ) : (
                  <button
                    onClick={() => markProgress.mutate(activeLesson.id)}
                    disabled={markProgress.isPending}
                    className="shrink-0 flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {markProgress.isPending ? "Saving…" : "Mark Complete"}
                  </button>
                )}
              </div>

              {/* Actual content */}
              <div className="p-6">
                <LessonContentRenderer
                  contentType={activeLesson.content_type}
                  contentUrl={activeLesson.content_url}
                  contentText={activeLesson.content_text}
                  title={activeLesson.title}
                  onEnded={() => {
                    if (!activeLesson.is_completed) markProgress.mutate(activeLesson.id);
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
              <BookOpen className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">Select a lesson from the left to start learning</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main: Course Catalog ─────────────────────────────────────────────────────

type LMSTab = "catalog" | "my-courses";

export default function StudentLearningPage() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<LMSTab>("catalog");
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("");

  const { data: courses, isLoading: loadingCourses } = useQuery({
    queryKey: ["lms-courses", catFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ status: "published" });
      if (catFilter) params.set("category", catFilter);
      const { data } = await api.get(`/lms/courses?${params}`);
      return data.data as Course[];
    },
  });

  const { data: enrollments } = useQuery({
    queryKey: ["lms-enrollments"],
    queryFn: async () => {
      const { data } = await api.get("/lms/my-courses");
      return data.data as (Enrollment & { title: string; description: string })[];
    },
  });

  const enroll = useMutation({
    mutationFn: async (courseId: string) => {
      await api.post(`/lms/courses/${courseId}/enroll`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lms-enrollments"] });
      toast.success("Enrolled successfully!");
      setActiveTab("my-courses");
    },
    onError: () => toast.error("Enrolment failed"),
  });

  const enrollmentMap = new Map(
    (enrollments || []).map((e) => [e.course_id, e])
  );

  const filteredCourses = (courses || []).filter(
    (c) =>
      !search ||
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.category.toLowerCase().includes(search.toLowerCase())
  );

  const categories = [...new Set((courses || []).map((c) => c.category))];

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Learning</h1>
        <p className="text-sm text-slate-500 mt-1">
          Explore courses and track your learning progress
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {[
          { id: "catalog" as LMSTab, label: "Course Catalog", icon: BookOpen },
          { id: "my-courses" as LMSTab, label: "My Courses", icon: GraduationCap },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-white text-indigo-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
              {tab.id === "my-courses" && enrollments && enrollments.length > 0 && (
                <span className="bg-indigo-600 text-white text-xs px-1.5 py-0.5 rounded-full">
                  {enrollments.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Catalog ───────────────────────────────────────────────────────── */}
      {activeTab === "catalog" && (
        <div className="space-y-5">
          {/* Search + Filter */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Search courses…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 overflow-x-auto">
              <Filter className="h-4 w-4 text-slate-400 flex-shrink-0" />
              <button
                onClick={() => setCatFilter("")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors flex-shrink-0 ${
                  catFilter === ""
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "border-slate-300 text-slate-600 hover:border-indigo-400"
                }`}
              >
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCatFilter(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors capitalize flex-shrink-0 ${
                    catFilter === cat
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "border-slate-300 text-slate-600 hover:border-indigo-400"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {loadingCourses ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
            </div>
          ) : filteredCourses.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-300">
              <BookOpen className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">
                {search ? "No courses match your search" : "No courses available yet"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCourses.map((course) => (
                <CourseCard
                  key={course.id}
                  course={course}
                  enrollment={enrollmentMap.get(course.id)}
                  onEnroll={enroll.mutate}
                  enrolling={enroll.isPending}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── My Courses ────────────────────────────────────────────────────── */}
      {activeTab === "my-courses" && (
        <div className="space-y-4">
          {!enrollments || enrollments.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-300">
              <GraduationCap className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-700 mb-2">
                You haven't enrolled in any courses yet
              </h3>
              <p className="text-sm text-slate-500 mb-5">
                Browse the catalog to find courses that match your goals
              </p>
              <button
                onClick={() => setActiveTab("catalog")}
                className="inline-flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700"
              >
                <BookOpen className="h-4 w-4" />
                Browse Catalog
              </button>
            </div>
          ) : (
            enrollments.map((e) => (
              <Link
                key={e.id}
                to={`/app/lms/courses/${e.course_id}`}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center gap-5 hover:border-indigo-300 transition-colors block"
              >
                <div className="h-14 w-14 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
                  <GraduationCap className="h-7 w-7 text-indigo-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 truncate">
                    {(e as any).title || "Course"}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Enrolled {new Date(e.enrolled_at).toLocaleDateString()}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full max-w-xs">
                      <div
                        className={`h-1.5 rounded-full ${
                          e.status === "completed" ? "bg-green-500" : "bg-indigo-500"
                        }`}
                        style={{ width: `${e.progress_percent}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-indigo-600">
                      {e.progress_percent}%
                    </span>
                    {e.status === "completed" && (
                      <Award className="h-4 w-4 text-amber-500" />
                    )}
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-300 flex-shrink-0" />
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
