// =============================================================================
// Course Detail (superadmin) — manage modules + lessons within a course, and
// toggle draft/published status. Reuses lms.routes.ts backend.
// =============================================================================

import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, CheckCircle2, EyeOff, Building2, X } from "lucide-react";
import toast from "react-hot-toast";
import lmsCourseService, { CourseDetail, CourseModule } from "../../../services/lmsCourseService";
import collegeService, { College } from "../../../services/collegeService";

interface AssignedCollege {
  college_id: string;
  college_name: string;
  assigned_at: string;
}

export default function CourseDetailPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [newModuleTitle, setNewModuleTitle] = useState("");
  const [addingModule, setAddingModule] = useState(false);
  const [lessonDrafts, setLessonDrafts] = useState<Record<string, string>>({});
  const [assignedColleges, setAssignedColleges] = useState<AssignedCollege[]>([]);
  const [allColleges, setAllColleges] = useState<College[]>([]);
  const [addCollegeId, setAddCollegeId] = useState("");

  const load = () => {
    if (!courseId) return;
    setLoading(true);
    lmsCourseService
      .getCourse(courseId)
      .then(setCourse)
      .catch(() => toast.error("Failed to load course"))
      .finally(() => setLoading(false));
    lmsCourseService.listAssignedColleges(courseId).then(setAssignedColleges).catch(() => setAssignedColleges([]));
  };

  useEffect(() => {
    load();
    collegeService.getAllColleges().then((res) => setAllColleges(res.colleges)).catch(() => setAllColleges([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  const assignCollege = async () => {
    if (!course || !addCollegeId) return;
    try {
      await lmsCourseService.assignCollege(course.id, addCollegeId);
      setAddCollegeId("");
      lmsCourseService.listAssignedColleges(course.id).then(setAssignedColleges);
      toast.success("College added");
    } catch {
      toast.error("Failed to add college");
    }
  };

  const unassignCollege = async (collegeId: string) => {
    if (!course) return;
    try {
      await lmsCourseService.unassignCollege(course.id, collegeId);
      lmsCourseService.listAssignedColleges(course.id).then(setAssignedColleges);
      toast.success("College removed");
    } catch {
      toast.error("Failed to remove college");
    }
  };

  const togglePublish = async () => {
    if (!course) return;
    const nextStatus = course.status === "published" ? "draft" : "published";
    try {
      await lmsCourseService.updateCourse(course.id, { status: nextStatus });
      toast.success(nextStatus === "published" ? "Course published — available to colleges" : "Course moved back to draft");
      load();
    } catch {
      toast.error("Failed to update status");
    }
  };

  const addModule = async () => {
    if (!course || !newModuleTitle.trim()) return;
    setAddingModule(true);
    try {
      await lmsCourseService.createModule(course.id, {
        title: newModuleTitle.trim(),
        sort_order: course.modules.length,
      });
      setNewModuleTitle("");
      load();
    } catch {
      toast.error("Failed to add module");
    } finally {
      setAddingModule(false);
    }
  };

  const deleteModule = async (moduleId: string) => {
    if (!confirm("Delete this module and all its lessons?")) return;
    try {
      await lmsCourseService.deleteModule(moduleId);
      toast.success("Module deleted");
      load();
    } catch {
      toast.error("Failed to delete module");
    }
  };

  const addLesson = async (mod: CourseModule) => {
    const title = (lessonDrafts[mod.id] || "").trim();
    if (!title) return;
    try {
      await lmsCourseService.createLesson(mod.id, {
        title,
        content_type: "text",
        sort_order: mod.lessons.length,
      });
      setLessonDrafts((d) => ({ ...d, [mod.id]: "" }));
      load();
    } catch {
      toast.error("Failed to add lesson");
    }
  };

  const deleteLesson = async (lessonId: string) => {
    if (!confirm("Delete this lesson?")) return;
    try {
      await lmsCourseService.deleteLesson(lessonId);
      toast.success("Lesson deleted");
      load();
    } catch {
      toast.error("Failed to delete lesson");
    }
  };

  if (loading) {
    return <div className="max-w-4xl mx-auto px-6 py-8 text-sm text-gray-400">Loading…</div>;
  }
  if (!course) {
    return <div className="max-w-4xl mx-auto px-6 py-8 text-sm text-gray-400">Course not found.</div>;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <Link to="/app/superadmin/courses" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to Courses
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-gray-900">{course.title}</h1>
            <span
              className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium capitalize ${
                course.status === "published" ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600"
              }`}
            >
              {course.status}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {course.category} · {course.difficulty} · {course.modules.length} modules
          </p>
        </div>
        <button
          onClick={togglePublish}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${
            course.status === "published"
              ? "border border-gray-300 text-gray-700 hover:bg-gray-50"
              : "bg-navy-900 text-white hover:bg-navy-800"
          }`}
        >
          {course.status === "published" ? (
            <>
              <EyeOff className="w-4 h-4" /> Unpublish
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4" /> Publish — make available to colleges
            </>
          )}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-5 mb-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-1 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-navy-900" /> Available to colleges
        </h3>
        <p className="text-xs text-gray-500 mb-3">
          {assignedColleges.length === 0
            ? "No colleges assigned — available to every college once published."
            : `Restricted to ${assignedColleges.length} college${assignedColleges.length === 1 ? "" : "s"}.`}
        </p>

        {assignedColleges.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {assignedColleges.map((c) => (
              <span
                key={c.college_id}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-navy-900/[0.06] text-navy-900 text-xs font-medium"
              >
                {c.college_name}
                <button onClick={() => unassignCollege(c.college_id)} className="hover:text-red-600">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          <select
            value={addCollegeId}
            onChange={(e) => setAddCollegeId(e.target.value)}
            className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm"
          >
            <option value="">Add a college…</option>
            {allColleges
              .filter((c) => !assignedColleges.some((a) => a.college_id === c.id))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
          <button
            onClick={assignCollege}
            disabled={!addCollegeId}
            className="inline-flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {course.modules.map((mod, i) => (
          <div key={mod.id} className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">
                Module {i + 1}: {mod.title}
              </h3>
              <button onClick={() => deleteModule(mod.id)} className="text-gray-400 hover:text-red-600">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 mb-3">
              {mod.lessons.map((lesson, j) => (
                <div key={lesson.id} className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-2">
                  <span className="text-gray-700">
                    {j + 1}. {lesson.title}
                  </span>
                  <button onClick={() => deleteLesson(lesson.id)} className="text-gray-400 hover:text-red-600">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {mod.lessons.length === 0 && <p className="text-xs text-gray-400">No lessons yet.</p>}
            </div>

            <div className="flex items-center gap-2">
              <input
                placeholder="New lesson title..."
                value={lessonDrafts[mod.id] || ""}
                onChange={(e) => setLessonDrafts((d) => ({ ...d, [mod.id]: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && addLesson(mod)}
                className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm"
              />
              <button
                onClick={() => addLesson(mod)}
                className="inline-flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                <Plus className="w-3.5 h-3.5" /> Add Lesson
              </button>
            </div>
          </div>
        ))}

        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-5">
          <div className="flex items-center gap-2">
            <input
              placeholder="New module title..."
              value={newModuleTitle}
              onChange={(e) => setNewModuleTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addModule()}
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
            <button
              onClick={addModule}
              disabled={addingModule}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-navy-900 text-white rounded-lg text-sm font-medium disabled:opacity-50"
            >
              <Plus className="w-4 h-4" /> Add Module
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
