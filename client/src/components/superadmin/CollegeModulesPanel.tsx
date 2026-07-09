import { useEffect, useMemo, useState } from "react";
import { Package, Save, RotateCcw, Star } from "lucide-react";
import toast from "react-hot-toast";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { featureLabel } from "../../constants/platformFeatures";
import { moduleIcon } from "../../constants/lmsModules";
import platformModulesService, {
  type CollegeModuleAssignment,
} from "../../services/platformModulesService";

interface CollegeModulesPanelProps {
  collegeId: string;
  collegeName: string;
}

/** Checkbox grid to enable/disable feature modules for one college. */
export default function CollegeModulesPanel({ collegeId, collegeName }: CollegeModulesPanelProps) {
  const [assignments, setAssignments] = useState<CollegeModuleAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [applyingDefaults, setApplyingDefaults] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = () => {
    setLoading(true);
    platformModulesService
      .getCollegeModules(collegeId)
      .then(setAssignments)
      .catch(() => toast.error("Failed to load module assignments"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [collegeId]);

  const { lms, platform } = useMemo(() => {
    const lmsMods = assignments.filter((a) => a.module_type === "lms");
    const platformMods = assignments.filter((a) => a.module_type === "platform");
    return { lms: lmsMods, platform: platformMods };
  }, [assignments]);

  const toggle = (moduleId: string) => {
    setAssignments((prev) =>
      prev.map((a) =>
        a.module_id === moduleId ? { ...a, enabled: !a.enabled } : a
      )
    );
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const updated = await platformModulesService.setCollegeModules(
        collegeId,
        assignments.map((a) => ({ module_id: a.module_id, enabled: a.enabled }))
      );
      setAssignments(updated);
      setDirty(false);
      toast.success(`Modules updated for ${collegeName}`);
    } catch {
      toast.error("Failed to save module assignments");
    } finally {
      setSaving(false);
    }
  };

  const applyDefaults = async () => {
    if (
      !confirm(
        "Reset module assignments to platform defaults? This will enable default modules and disable others."
      )
    ) {
      return;
    }
    setApplyingDefaults(true);
    try {
      const updated = await platformModulesService.applyCollegeDefaults(collegeId);
      setAssignments(updated);
      setDirty(false);
      toast.success("Default modules applied");
    } catch {
      toast.error("Failed to apply defaults");
    } finally {
      setApplyingDefaults(false);
    }
  };

  const renderGroup = (title: string, mods: CollegeModuleAssignment[]) => (
    <div className="divide-y divide-gray-100">
      <div className="bg-slate-50/80 px-6 py-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</p>
      </div>
      {mods.map((mod) => {
        const Icon = moduleIcon(mod.icon);
        return (
          <label
            key={mod.module_id}
            className="flex cursor-pointer items-start gap-4 px-6 py-4 hover:bg-slate-50/80"
          >
            <input
              type="checkbox"
              checked={mod.enabled}
              onChange={() => toggle(mod.module_id)}
              className="mt-1 rounded border-gray-300"
            />
            <div className="flex min-w-0 flex-1 gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-admin-accent/10 text-admin-accent">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-gray-900">{mod.module_name}</span>
                  {mod.is_default && (
                    <Badge variant="info" className="gap-0.5 text-[10px]">
                      <Star className="h-3 w-3" />
                      Default
                    </Badge>
                  )}
                  <span className="text-xs text-gray-400">{mod.module_key}</span>
                </div>
                {mod.description && (
                  <p className="mt-0.5 text-sm text-gray-500">{mod.description}</p>
                )}
                <div className="mt-2 flex flex-wrap gap-1">
                  {mod.features.map((f) => (
                    <Badge key={f} variant="muted" className="text-[10px]">
                      {featureLabel(f)}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </label>
        );
      })}
    </div>
  );

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200/70 bg-white p-6 shadow-admin-card">
        <div className="h-24 animate-pulse rounded-lg bg-gray-100" />
      </div>
    );
  }

  const enabledCount = assignments.filter((a) => a.enabled).length;

  return (
    <div className="rounded-xl border border-gray-200/70 bg-white shadow-admin-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-6 py-4">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-admin-accent" />
          <div>
            <h3 className="font-semibold text-gray-900">Assigned Modules</h3>
            <p className="text-xs text-gray-500">
              {enabledCount} of {assignments.length} modules enabled for this college
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={applyDefaults}
            disabled={applyingDefaults || saving}
          >
            <RotateCcw className="h-4 w-4" />
            {applyingDefaults ? "Applying…" : "Reset to Defaults"}
          </Button>
          <Button type="button" size="sm" onClick={save} disabled={!dirty || saving}>
            <Save className="h-4 w-4" />
            {saving ? "Saving…" : "Save Modules"}
          </Button>
        </div>
      </div>

      {assignments.length === 0 ? (
        <p className="px-6 py-8 text-center text-sm text-gray-500">
          No active modules in catalog. Create modules in System → Modules.
        </p>
      ) : (
        <>
          {lms.length > 0 && renderGroup("LMS Learning Groups", lms)}
          {platform.length > 0 && renderGroup("Platform Bundles", platform)}
        </>
      )}
    </div>
  );
}
