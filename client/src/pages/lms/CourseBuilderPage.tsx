// =============================================================================
// LMS — Course Builder (Instructor / Admin)
// Course list · Create/Edit Course · Module & Lesson management
// =============================================================================

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router";
import api from "../../lib/api";
import {
  Plus,
  BookOpen,
  Layers,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Users,
  Eye,
  Save,
  Video,
  FileText,
  Code2,
  BarChart3,
  GripVertical,
  Check,
  X,
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
  total_modules: number;
  total_enrollments: number;
  is_free: boolean;
  status: string;
  created_at: string;
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
  sort_order: number;
  estimated_minutes: number | null;
  video_duration_seconds: number | null;
}

const CATEGORIES = [
  "aptitude", "dsa", "reasoning", "sql", "soft_skills", "verbal", "programming",
];

const DIFFICULTIES = ["beginner", "intermediate", "advanced"];

const CONTENT_TYPES = [
  { id: "video", label: "Video", icon: Video },
  { id: "pdf", label: "PDF", icon: FileText },
  { id: "text", label: "Text", icon: FileText },
  { id: "quiz", label: "Quiz", icon: BarChart3 },
  { id: "coding", label: "Coding", icon: Code2 },
];

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  published: "bg-green-100 text-green-700",
  archived: "bg-red-100 text-red-700",
};

// ─── CourseForm ───────────────────────────────────────────────────────────────

function CourseForm({ course, onClose }: { course?: Course; onClose: () => void }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: course?.title || "",
    description: course?.description || "",
    category: course?.category || "aptitude",
    difficulty: course?.difficulty || "beginner",
    duration_hours: course?.duration_hours?.toString() || "",
    is_free: course?.is_free ?? true,
    status: course?.status || "draft",
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        duration_hours: form.duration_hours ? Number(form.duration_hours) : null,
      };
      if (course) {
        const { data } = await api.put(`/lms/courses/${course.id}`, payload);
        return data.data;
      } else {
        const { data } = await api.post("/lms/courses", payload);
        return data.data;
      }
    },
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ["lms-admin-courses"] });
      toast.success(course ? "Course updated" : "Course created");
      if (!course) navigate(`/app/lms/builder/${saved.id}`);
      onClose();
    },
    onError: () => toast.error("Failed to save course"),
  });

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-bold text-slate-800">
          {course ? "Edit Course" : "Create New Course"}
        </h3>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="text-sm font-medium text-slate-700">Title *</label>
          <input
            className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="e.g. Complete Aptitude Mastery"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="text-sm font-medium text-slate-700">Description</label>
          <textarea
            className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="What students will learn in this course"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">Category</label>
          <select
            className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c} className="capitalize">
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">Difficulty</label>
          <select
            className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={form.difficulty}
            onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
          >
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d} className="capitalize">
                {d}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">Duration (hours)</label>
          <input
            type="number"
            min={0}
            step={0.5}
            className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={form.duration_hours}
            onChange={(e) => setForm({ ...form, duration_hours: e.target.value })}
            placeholder="e.g. 12.5"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">Status</label>
          <select
            className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        <div className="sm:col-span-2 flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_free}
              onChange={(e) => setForm({ ...form, is_free: e.target.checked })}
              className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm text-slate-700">Free course</span>
          </label>
        </div>
      </div>
      <div className="mt-6 flex gap-3">
        <button
          onClick={onClose}
          className="flex-1 border border-slate-300 text-slate-700 rounded-xl py-2.5 text-sm hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          disabled={!form.title || save.isPending}
          onClick={() => save.mutate()}
          className="flex-1 bg-indigo-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Save className="h-4 w-4" />
          {save.isPending ? "Saving…" : course ? "Update Course" : "Create Course"}
        </button>
      </div>
    </div>
  );
}

// ─── CourseDetail (Module Builder) ───────────────────────────────────────────

function CourseDetailBuilder() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editCourse, setEditCourse] = useState(false);
  const [newModuleTitle, setNewModuleTitle] = useState("");
  const [addingModule, setAddingModule] = useState(false);
  const [expandedMod, setExpandedMod] = useState<string | null>(null);
  const [addingLesson, setAddingLesson] = useState<string | null>(null);
  const [newLesson, setNewLesson] = useState({ title: "", content_type: "video" });

  const { data: course } = useQuery({
    queryKey: ["lms-course", courseId],
    queryFn: async () => {
      const { data } = await api.get(`/lms/courses/${courseId}`);
      return data.data as Course;
    },
    enabled: !!courseId,
  });

  const { data: modules, isLoading } = useQuery({
    queryKey: ["lms-modules", courseId],
    queryFn: async () => {
      const { data } = await api.get(`/lms/courses/${courseId}/modules`);
      return data.data as Module[];
    },
    enabled: !!courseId,
  });

  const createModule = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/lms/courses/${courseId}/modules`, {
        title: newModuleTitle,
        sort_order: (modules?.length || 0) + 1,
      });
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lms-modules", courseId] });
      setNewModuleTitle("");
      setAddingModule(false);
      toast.success("Module added");
    },
    onError: () => toast.error("Failed to add module"),
  });

  const deleteModule = useMutation({
    mutationFn: async (modId: string) => {
      await api.delete(`/lms/modules/${modId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lms-modules", courseId] });
      toast.success("Module deleted");
    },
  });

  const createLesson = useMutation({
    mutationFn: async (modId: string) => {
      const lessons = modules?.find((m) => m.id === modId)?.lessons || [];
      const { data } = await api.post(`/lms/modules/${modId}/lessons`, {
        ...newLesson,
        sort_order: lessons.length + 1,
      });
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lms-modules", courseId] });
      setAddingLesson(null);
      setNewLesson({ title: "", content_type: "video" });
      toast.success("Lesson added");
    },
    onError: () => toast.error("Failed to add lesson"),
  });

  const deleteLesson = useMutation({
    mutationFn: async (lessonId: string) => {
      await api.delete(`/lms/lessons/${lessonId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lms-modules", courseId] });
      toast.success("Lesson deleted");
    },
  });

  const publishCourse = useMutation({
    mutationFn: async () => {
      await api.put(`/lms/courses/${courseId}`, { status: "published" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lms-course", courseId] });
      qc.invalidateQueries({ queryKey: ["lms-admin-courses"] });
      toast.success("Course published!");
    },
  });

  if (!course) return null;

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-6">
      {/* Back */}
      <button
        onClick={() => navigate("/app/lms/builder")}
        className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        <ChevronLeft className="h-4 w-4" />
        All Courses
      </button>

      {/* Course Header */}
      {editCourse ? (
        <CourseForm course={course} onClose={() => setEditCourse(false)} />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-xl font-bold text-slate-900">{course.title}</h1>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${
                    STATUS_BADGE[course.status] || STATUS_BADGE.draft
                  }`}
                >
                  {course.status}
                </span>
              </div>
              {course.description && (
                <p className="text-sm text-slate-500 mb-3">{course.description}</p>
              )}
              <div className="flex items-center gap-4 text-xs text-slate-400">
                <span className="capitalize">{course.category}</span>
                <span>·</span>
                <span className="capitalize">{course.difficulty}</span>
                <span>·</span>
                <span>{course.total_modules} modules</span>
                <span>·</span>
                <span>{course.total_enrollments} enrolled</span>
              </div>
            </div>
            <div className="flex items-center gap-2 ml-4">
              {course.status !== "published" && (
                <button
                  onClick={() => publishCourse.mutate()}
                  disabled={publishCourse.isPending}
                  className="flex items-center gap-1.5 bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50"
                >
                  <Eye className="h-3.5 w-3.5" />
                  Publish
                </button>
              )}
              <button
                onClick={() => setEditCourse(true)}
                className="flex items-center gap-1.5 border border-slate-300 text-slate-600 px-3 py-1.5 rounded-lg text-xs hover:bg-slate-50"
              >
                <Edit2 className="h-3.5 w-3.5" />
                Edit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modules */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">
            Modules ({(modules || []).length})
          </h2>
          <button
            onClick={() => setAddingModule(true)}
            className="flex items-center gap-1.5 bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            Add Module
          </button>
        </div>

        {/* New module input */}
        {addingModule && (
          <div className="flex items-center gap-2 bg-white p-3 rounded-xl border border-indigo-300">
            <Layers className="h-4 w-4 text-slate-400" />
            <input
              autoFocus
              className="flex-1 text-sm focus:outline-none"
              placeholder="Module title…"
              value={newModuleTitle}
              onChange={(e) => setNewModuleTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") createModule.mutate();
                if (e.key === "Escape") { setAddingModule(false); setNewModuleTitle(""); }
              }}
            />
            <button
              disabled={!newModuleTitle || createModule.isPending}
              onClick={() => createModule.mutate()}
              className="text-indigo-600 hover:text-indigo-700 disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              onClick={() => { setAddingModule(false); setNewModuleTitle(""); }}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
          </div>
        ) : (modules || []).length === 0 ? (
          <div className="text-center py-10 bg-white rounded-2xl border border-dashed border-slate-300">
            <Layers className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">No modules yet. Add your first module above.</p>
          </div>
        ) : (
          (modules || []).map((mod) => (
            <div
              key={mod.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
            >
              {/* Module header */}
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50"
                onClick={() => setExpandedMod(expandedMod === mod.id ? null : mod.id)}
              >
                <GripVertical className="h-4 w-4 text-slate-300 cursor-grab" />
                <Layers className="h-4 w-4 text-indigo-500" />
                <span className="flex-1 font-medium text-slate-800 text-sm">{mod.title}</span>
                <span className="text-xs text-slate-400">
                  {(mod.lessons || []).length} lessons
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm("Delete this module and all its lessons?")) {
                      deleteModule.mutate(mod.id);
                    }
                  }}
                  className="text-slate-300 hover:text-red-500 p-1"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <ChevronRight
                  className={`h-4 w-4 text-slate-400 transition-transform ${
                    expandedMod === mod.id ? "rotate-90" : ""
                  }`}
                />
              </div>

              {/* Lessons */}
              {expandedMod === mod.id && (
                <div className="border-t border-slate-100">
                  {(mod.lessons || []).map((lesson) => {
                    const ct = CONTENT_TYPES.find((c) => c.id === lesson.content_type);
                    const Icon = ct?.icon || FileText;
                    return (
                      <div
                        key={lesson.id}
                        className="flex items-center gap-3 px-6 py-2.5 border-b border-slate-50 hover:bg-slate-50"
                      >
                        <GripVertical className="h-3.5 w-3.5 text-slate-200 cursor-grab" />
                        <Icon className="h-3.5 w-3.5 text-slate-400" />
                        <span className="flex-1 text-sm text-slate-700">{lesson.title}</span>
                        <span className="text-xs text-slate-400 capitalize">
                          {lesson.content_type}
                        </span>
                        <button
                          onClick={() => {
                            if (confirm("Delete this lesson?")) deleteLesson.mutate(lesson.id);
                          }}
                          className="text-slate-200 hover:text-red-500 p-1"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}

                  {/* Add lesson */}
                  {addingLesson === mod.id ? (
                    <div className="px-6 py-3 flex items-center gap-2 bg-indigo-50">
                      <input
                        autoFocus
                        className="flex-1 text-sm border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        placeholder="Lesson title…"
                        value={newLesson.title}
                        onChange={(e) => setNewLesson({ ...newLesson, title: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") createLesson.mutate(mod.id);
                          if (e.key === "Escape") setAddingLesson(null);
                        }}
                      />
                      <select
                        className="border border-slate-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                        value={newLesson.content_type}
                        onChange={(e) =>
                          setNewLesson({ ...newLesson, content_type: e.target.value })
                        }
                      >
                        {CONTENT_TYPES.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                      <button
                        disabled={!newLesson.title || createLesson.isPending}
                        onClick={() => createLesson.mutate(mod.id)}
                        className="text-indigo-600 disabled:opacity-50"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setAddingLesson(null)}
                        className="text-slate-400"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAddingLesson(mod.id)}
                      className="w-full flex items-center gap-2 px-6 py-2.5 text-sm text-indigo-600 hover:bg-indigo-50 transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Lesson
                    </button>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Course List ──────────────────────────────────────────────────────────────

export default function CourseBuilderPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);

  const { data: courses, isLoading } = useQuery({
    queryKey: ["lms-admin-courses"],
    queryFn: async () => {
      const { data } = await api.get("/lms/courses");
      return data.data as Course[];
    },
  });

  const deleteCourse = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/lms/courses/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lms-admin-courses"] });
      toast.success("Course deleted");
    },
  });

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Course Builder</h1>
          <p className="text-sm text-slate-500 mt-1">
            Create and manage courses, modules, and lessons
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" />
          New Course
        </button>
      </div>

      {showCreate && <CourseForm onClose={() => setShowCreate(false)} />}

      {/* Course list */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
        </div>
      ) : (courses || []).length === 0 && !showCreate ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-300">
          <BookOpen className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 mb-2">No courses yet</h3>
          <p className="text-sm text-slate-500 mb-5">
            Create your first course to get started
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            Create Course
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100">
          {(courses || []).map((course) => (
            <div key={course.id} className="flex items-center gap-4 p-4 hover:bg-slate-50">
              <div className="h-10 w-10 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
                <GraduationCap className="h-5 w-5 text-indigo-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-slate-800 text-sm truncate">{course.title}</p>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize flex-shrink-0 ${
                      STATUS_BADGE[course.status] || STATUS_BADGE.draft
                    }`}
                  >
                    {course.status}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400">
                  <span className="capitalize">{course.category}</span>
                  <span>·</span>
                  <span>{course.total_modules} modules</span>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {course.total_enrollments}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigate(`/app/lms/builder/${course.id}`)}
                  className="flex items-center gap-1.5 border border-slate-300 text-slate-600 px-3 py-1.5 rounded-lg text-xs hover:bg-slate-50"
                >
                  <Layers className="h-3.5 w-3.5" />
                  Build
                </button>
                <button
                  onClick={() => {
                    if (confirm("Delete this course? This cannot be undone.")) {
                      deleteCourse.mutate(course.id);
                    }
                  }}
                  className="text-slate-300 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Named export for nested route
export { CourseDetailBuilder };
