// =============================================================================
// Module Builder (Inc 2) — reorder modules, attach/detach KL assets
// =============================================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Loader2,
  Library,
  CheckCircle2,
  ChevronUp,
  ChevronDown,
  Plus,
  Trash2,
  Unlink,
  ListChecks,
  Code2,
  FileStack,
  BookOpen,
  Mic,
} from "lucide-react";
import toast from "react-hot-toast";
import KnowledgeAssetPicker, {
  assetKey,
} from "../../../components/superadmin/course-builder/KnowledgeAssetPicker";
import PracticeAssessmentPanel from "../../../components/superadmin/course-builder/PracticeAssessmentPanel";
import courseBuilderService, {
  COURSE_BUILDER_BASE as BASE,
  DEFAULT_ASSESSMENT_CONFIG,
  type AssessmentConfig,
  type CourseDetail,
  type CourseModule,
  type CourseValidationResult,
  type ModuleAsset,
} from "../../../services/courseBuilderService";

const ROLE_STYLES: Record<string, string> = {
  lesson: "bg-blue-50 text-blue-700",
  practice: "bg-amber-50 text-amber-800",
  coding: "bg-violet-50 text-violet-700",
  assessment: "bg-rose-50 text-rose-700",
  resource: "bg-slate-100 text-slate-700",
  voice: "bg-emerald-50 text-emerald-700",
};

function RoleIcon({ role }: { role: string }) {
  if (role === "coding") return <Code2 className="w-3.5 h-3.5" />;
  if (role === "practice" || role === "assessment") return <ListChecks className="w-3.5 h-3.5" />;
  if (role === "voice") return <Mic className="w-3.5 h-3.5" />;
  if (role === "resource") return <FileStack className="w-3.5 h-3.5" />;
  return <BookOpen className="w-3.5 h-3.5" />;
}

export default function CourseWorkspacePage() {
  const { courseId } = useParams<{ courseId: string }>();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [assets, setAssets] = useState<ModuleAsset[]>([]);
  const [config, setConfig] = useState<AssessmentConfig>(DEFAULT_ASSESSMENT_CONFIG);
  const [validation, setValidation] = useState<CourseValidationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [addingModule, setAddingModule] = useState(false);
  const [newModuleTitle, setNewModuleTitle] = useState("");

  const refreshValidation = useCallback(async () => {
    if (!courseId) return;
    try {
      setValidation(await courseBuilderService.validateCourse(courseId));
    } catch {
      /* validation endpoint may fail if migration not applied — surface on publish */
    }
  }, [courseId]);

  const reload = useCallback(async () => {
    if (!courseId) return;
    const [c, a, cfg] = await Promise.all([
      courseBuilderService.getCourse(courseId),
      courseBuilderService.listCourseAssets(courseId),
      courseBuilderService.getAssessmentConfig(courseId).catch(() => DEFAULT_ASSESSMENT_CONFIG),
    ]);
    setCourse(c);
    setAssets(a);
    setConfig(cfg);
    setSelectedModuleId((prev) => {
      if (prev && c.modules.some((m) => m.id === prev)) return prev;
      return c.modules[0]?.id ?? null;
    });
    try {
      setValidation(await courseBuilderService.validateCourse(courseId));
    } catch {
      setValidation(null);
    }
  }, [courseId]);

  useEffect(() => {
    setLoading(true);
    reload()
      .catch(() => toast.error("Failed to load course"))
      .finally(() => setLoading(false));
  }, [reload]);

  const selectedModule: CourseModule | undefined = useMemo(
    () => course?.modules.find((m) => m.id === selectedModuleId),
    [course, selectedModuleId]
  );

  const moduleAssets = useMemo(
    () => assets.filter((a) => a.module_id === selectedModuleId),
    [assets, selectedModuleId]
  );

  const attachedKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const a of moduleAssets) {
      keys.add(assetKey(a.asset_type, a.asset_id, a.role));
    }
    return keys;
  }, [moduleAssets]);

  const assetsByRole = useMemo(() => {
    const map: Record<string, ModuleAsset[]> = {};
    for (const a of moduleAssets) {
      (map[a.role] ||= []).push(a);
    }
    return map;
  }, [moduleAssets]);

  const publish = async () => {
    if (!courseId || !course) return;
    setPublishing(true);
    try {
      const { course: updated, validation: v } =
        await courseBuilderService.publishCourse(courseId);
      setValidation(v);
      setCourse({ ...course, ...updated, modules: course.modules });
      toast.success("Course published");
    } catch (err: unknown) {
      const ax = err as {
        response?: { data?: { data?: CourseValidationResult; error?: string } };
      };
      const v = ax.response?.data?.data;
      if (v?.issues) {
        setValidation(v);
        toast.error(v.issues.find((i) => i.severity === "error")?.message || "Validation failed");
      } else {
        toast.error(ax.response?.data?.error || "Publish failed");
      }
    } finally {
      setPublishing(false);
    }
  };

  const reorder = async (index: number, dir: -1 | 1) => {
    if (!course) return;
    const modules = [...course.modules].sort((a, b) => a.sort_order - b.sort_order);
    const j = index + dir;
    if (j < 0 || j >= modules.length) return;
    const a = modules[index];
    const b = modules[j];
    try {
      await Promise.all([
        courseBuilderService.updateModule(a.id, { sort_order: b.sort_order }),
        courseBuilderService.updateModule(b.id, { sort_order: a.sort_order }),
      ]);
      await reload();
    } catch {
      toast.error("Reorder failed");
    }
  };

  const addModule = async () => {
    if (!courseId || !newModuleTitle.trim()) return;
    setAddingModule(true);
    try {
      const sort = (course?.modules.length || 0);
      const mod = await courseBuilderService.createModule(courseId, {
        title: newModuleTitle.trim(),
        sort_order: sort,
      });
      setNewModuleTitle("");
      await reload();
      setSelectedModuleId(mod.id);
      toast.success("Module added");
    } catch {
      toast.error("Failed to add module");
    } finally {
      setAddingModule(false);
    }
  };

  const removeModule = async (id: string) => {
    if (!confirm("Delete this module and its attached assets?")) return;
    try {
      await courseBuilderService.deleteModule(id);
      await reload();
      toast.success("Module deleted");
    } catch {
      toast.error("Delete failed");
    }
  };

  const detach = async (id: string) => {
    try {
      await courseBuilderService.detachAsset(id);
      await reload();
      toast.success("Detached");
    } catch {
      toast.error("Detach failed");
    }
  };

  if (loading || !course) {
    return (
      <div className="flex justify-center py-20 text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  const sortedModules = [...(course.modules || [])].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="space-y-6">
      <div>
        <Link to={`${BASE}/all`} className="text-xs text-admin-accent hover:underline">
          ← All courses
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Module Builder
            </p>
            <h2 className="text-xl font-semibold text-gray-900">{course.title}</h2>
            <p className="text-sm text-gray-500 mt-1 capitalize">
              {course.category.replace(/_/g, " ")} · {course.difficulty} ·{" "}
              <span className="font-medium">{course.status}</span>
              {" · "}
              {assets.length} assets attached
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/app/superadmin/knowledge-library"
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            >
              <Library className="w-4 h-4" />
              Knowledge Library
            </Link>
            {course.status === "draft" && (
              <button
                type="button"
                disabled={publishing || (validation != null && !validation.ok)}
                onClick={() => void publish()}
                title={
                  validation && !validation.ok
                    ? "Fix validation issues before publishing"
                    : "Publish course"
                }
                className="inline-flex items-center gap-1.5 rounded-lg bg-navy-900 px-3 py-2 text-sm font-medium text-white hover:bg-navy-800 disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                Publish
              </button>
            )}
            <Link
              to={`${BASE}/review`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            >
              Review
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Module list */}
        <aside className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800">Modules</h3>
            <span className="text-xs text-gray-400">{sortedModules.length}</span>
          </div>
          <ul className="space-y-2">
            {sortedModules.map((m, i) => {
              const count = assets.filter((a) => a.module_id === m.id).length;
              const active = m.id === selectedModuleId;
              return (
                <li key={m.id}>
                  <div
                    className={`rounded-xl border bg-white shadow-admin-card ${
                      active ? "border-navy-900 ring-1 ring-navy-900/20" : "border-gray-200/70"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedModuleId(m.id)}
                      className="w-full text-left px-3 py-3"
                    >
                      <p className="text-[11px] text-gray-400">Module {i + 1}</p>
                      <p className="font-medium text-gray-900 text-sm">{m.title}</p>
                      <p className="text-[11px] text-gray-400 mt-1">{count} attached</p>
                    </button>
                    <div className="flex items-center gap-1 border-t border-gray-100 px-2 py-1.5">
                      <button
                        type="button"
                        className="p-1.5 text-gray-400 hover:text-gray-700 rounded"
                        onClick={() => reorder(i, -1)}
                        aria-label="Move up"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        className="p-1.5 text-gray-400 hover:text-gray-700 rounded"
                        onClick={() => reorder(i, 1)}
                        aria-label="Move down"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        className="ml-auto p-1.5 text-rose-500 hover:bg-rose-50 rounded"
                        onClick={() => removeModule(m.id)}
                        aria-label="Delete module"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="flex gap-2">
            <input
              value={newModuleTitle}
              onChange={(e) => setNewModuleTitle(e.target.value)}
              placeholder="New module title"
              className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter") void addModule();
              }}
            />
            <button
              type="button"
              disabled={addingModule || !newModuleTitle.trim()}
              onClick={() => void addModule()}
              className="inline-flex items-center gap-1 rounded-lg bg-navy-900 px-3 py-2 text-sm text-white disabled:opacity-40"
            >
              {addingModule ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            </button>
          </div>
        </aside>

        {/* Module detail + picker */}
        <section className="lg:col-span-8 space-y-4">
          {!selectedModule ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
              Add or select a module to attach Knowledge Library assets.
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-gray-200/70 bg-white p-4 shadow-admin-card">
                <h3 className="font-semibold text-gray-900">{selectedModule.title}</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Map lessons, practice, coding, assessments, and voice from the Knowledge Library.
                </p>

                {(["lesson", "practice", "coding", "assessment", "resource", "voice"] as const).map(
                  (role) => {
                    const rows = assetsByRole[role] || [];
                    if (rows.length === 0) return null;
                    return (
                      <div key={role} className="mt-4">
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-1.5">
                          <RoleIcon role={role} />
                          {role}
                        </p>
                        <ul className="space-y-2">
                          {rows.map((a) => (
                            <li
                              key={a.id}
                              className="flex items-start gap-2 rounded-lg border border-gray-100 bg-slate-50/80 px-3 py-2"
                            >
                              <span
                                className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${
                                  ROLE_STYLES[a.role] || "bg-gray-100 text-gray-600"
                                }`}
                              >
                                {a.asset_type.replace(/_/g, " ")}
                              </span>
                              <p className="flex-1 text-sm text-gray-800 line-clamp-2">
                                {a.asset_title ||
                                  (typeof a.meta?.title === "string" ? a.meta.title : a.asset_id)}
                              </p>
                              <button
                                type="button"
                                onClick={() => void detach(a.id)}
                                className="shrink-0 p-1.5 text-gray-400 hover:text-rose-600 rounded"
                                title="Detach"
                              >
                                <Unlink className="w-4 h-4" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  }
                )}

                {moduleAssets.length === 0 ? (
                  <p className="mt-4 text-sm text-gray-400">
                    No assets attached yet — use the picker below.
                  </p>
                ) : null}
              </div>

              <PracticeAssessmentPanel
                courseId={course.id}
                config={config}
                onConfigChange={setConfig}
                moduleAssets={moduleAssets}
                onAssetsChange={() => void reload()}
                validation={validation}
                onRefreshValidation={() => void refreshValidation()}
              />

              <KnowledgeAssetPicker
                moduleId={selectedModule.id}
                category={course.category}
                attachedKeys={attachedKeys}
                onAttached={() => void reload()}
              />
            </>
          )}
        </section>
      </div>
    </div>
  );
}
