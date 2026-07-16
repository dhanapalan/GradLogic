// =============================================================================
// Course-level assessment gates + per-module practice/assessment mapping summary
// =============================================================================

import { useEffect, useState } from "react";
import { Loader2, Save, AlertTriangle, CheckCircle2 } from "lucide-react";
import toast from "react-hot-toast";
import courseBuilderService, {
  type AssessmentConfig,
  type ModuleAsset,
  type CourseValidationResult,
} from "../../../services/courseBuilderService";

const ASSESSMENT_KINDS = [
  { value: "quiz", label: "Quiz" },
  { value: "mock", label: "Mock test" },
  { value: "coding", label: "Coding assessment" },
] as const;

interface PracticeAssessmentPanelProps {
  courseId: string;
  config: AssessmentConfig;
  onConfigChange: (c: AssessmentConfig) => void;
  moduleAssets: ModuleAsset[];
  onAssetsChange: () => void;
  validation: CourseValidationResult | null;
  onRefreshValidation: () => void;
}

export default function PracticeAssessmentPanel({
  courseId,
  config,
  onConfigChange,
  moduleAssets,
  onAssetsChange,
  validation,
  onRefreshValidation,
}: PracticeAssessmentPanelProps) {
  const [saving, setSaving] = useState(false);
  const [local, setLocal] = useState(config);
  const [metaBusy, setMetaBusy] = useState<string | null>(null);

  useEffect(() => {
    setLocal(config);
  }, [config]);

  const practiceItems = moduleAssets.filter((a) => a.role === "practice" || a.role === "coding");
  const assessmentItems = moduleAssets.filter((a) => a.role === "assessment");

  const saveConfig = async () => {
    setSaving(true);
    try {
      const next = await courseBuilderService.updateAssessmentConfig(courseId, local);
      onConfigChange(next);
      setLocal(next);
      toast.success("Assessment settings saved");
      onRefreshValidation();
    } catch {
      toast.error("Failed to save assessment settings");
    } finally {
      setSaving(false);
    }
  };

  const patchAssessmentMeta = async (assetId: string, patch: Record<string, unknown>) => {
    setMetaBusy(assetId);
    try {
      await courseBuilderService.updateAssetMeta(assetId, patch);
      onAssetsChange();
      onRefreshValidation();
    } catch {
      toast.error("Failed to update assessment meta");
    } finally {
      setMetaBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200/70 bg-white p-4 shadow-admin-card space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Course assessment gates</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Passing score, attempts, and minimum practice required per module before publish.
            </p>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={() => void saveConfig()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-navy-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-navy-800 disabled:opacity-40"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <label className="block">
            <span className="text-[11px] font-medium text-gray-500">Passing %</span>
            <input
              type="number"
              min={1}
              max={100}
              value={local.passing_percent}
              onChange={(e) =>
                setLocal((c) => ({ ...c, passing_percent: Number(e.target.value) }))
              }
              className="mt-1 w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-medium text-gray-500">Attempts</span>
            <input
              type="number"
              min={1}
              value={local.attempts}
              onChange={(e) => setLocal((c) => ({ ...c, attempts: Number(e.target.value) }))}
              className="mt-1 w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-medium text-gray-500">Min practice / module</span>
            <input
              type="number"
              min={0}
              value={local.min_practice_per_module}
              onChange={(e) =>
                setLocal((c) => ({ ...c, min_practice_per_module: Number(e.target.value) }))
              }
              className="mt-1 w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm"
            />
          </label>
          <label className="flex items-end gap-2 pb-1.5">
            <input
              type="checkbox"
              checked={local.require_assessment}
              onChange={(e) =>
                setLocal((c) => ({ ...c, require_assessment: e.target.checked }))
              }
              className="rounded border-gray-300"
            />
            <span className="text-xs text-gray-600">Require assessment assets</span>
          </label>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200/70 bg-white p-4 shadow-admin-card">
        <h3 className="text-sm font-semibold text-gray-900">This module · Practice</h3>
        <p className="text-xs text-gray-500 mt-0.5 mb-3">
          MCQ / flashcards (practice) and coding challenges. Use the picker with role Practice or
          Coding.
        </p>
        {practiceItems.length === 0 ? (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            No practice or coding items yet — need {local.min_practice_per_module} for publish.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {practiceItems.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between gap-2 text-sm border border-gray-100 rounded-lg px-3 py-2 bg-slate-50/80"
              >
                <span className="truncate">
                  <span className="text-[10px] uppercase text-gray-400 mr-2">{a.role}</span>
                  {a.asset_title || a.asset_id}
                </span>
                <span className="text-[11px] text-gray-400 shrink-0">
                  {a.asset_type.replace(/_/g, " ")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-gray-200/70 bg-white p-4 shadow-admin-card">
        <h3 className="text-sm font-semibold text-gray-900">This module · Assessment</h3>
        <p className="text-xs text-gray-500 mt-0.5 mb-3">
          Attach with role Assessment, then set kind (quiz / mock / coding).
        </p>
        {assessmentItems.length === 0 ? (
          <p className="text-xs text-gray-400">
            No assessment assets on this module. Attach from the picker with role Assessment.
          </p>
        ) : (
          <ul className="space-y-2">
            {assessmentItems.map((a) => {
              const kind =
                typeof a.meta?.assessment_kind === "string" ? a.meta.assessment_kind : "quiz";
              return (
                <li
                  key={a.id}
                  className="rounded-lg border border-gray-100 bg-slate-50/80 px-3 py-2 space-y-2"
                >
                  <p className="text-sm text-gray-800 line-clamp-2">
                    {a.asset_title || a.asset_id}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="text-[11px] text-gray-500 flex items-center gap-1.5">
                      Kind
                      <select
                        value={kind}
                        disabled={metaBusy === a.id}
                        onChange={(e) =>
                          void patchAssessmentMeta(a.id, { assessment_kind: e.target.value })
                        }
                        className="rounded border border-gray-200 text-xs px-1.5 py-1 bg-white"
                      >
                        {ASSESSMENT_KINDS.map((k) => (
                          <option key={k.value} value={k.value}>
                            {k.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    {metaBusy === a.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {validation ? (
        <div
          className={`rounded-xl border p-4 text-sm ${
            validation.ok
              ? "border-emerald-200 bg-emerald-50/80 text-emerald-900"
              : "border-amber-200 bg-amber-50/80 text-amber-950"
          }`}
        >
          <div className="flex items-center gap-2 font-medium">
            {validation.ok ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-700" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-700" />
            )}
            {validation.ok ? "Ready to publish" : "Publish blocked — fix issues below"}
          </div>
          <p className="text-xs mt-1 opacity-80">
            {validation.stats.modules} modules · {validation.stats.practice} practice ·{" "}
            {validation.stats.coding} coding · {validation.stats.assessment} assessment
          </p>
          {validation.issues.length > 0 ? (
            <ul className="mt-2 space-y-1 text-xs">
              {validation.issues.map((issue, i) => (
                <li key={`${issue.code}-${i}`}>
                  <span className="font-semibold uppercase mr-1">{issue.severity}</span>
                  {issue.message}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
