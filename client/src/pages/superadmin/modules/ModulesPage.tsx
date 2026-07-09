import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Package, Star, Layers, Lock } from "lucide-react";
import toast from "react-hot-toast";
import StatusBadge from "../../../components/superadmin/StatusBadge";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { featureLabel } from "../../../constants/platformFeatures";
import { moduleIcon } from "../../../constants/lmsModules";
import platformModulesService, {
  type FeatureModule,
  type CreateModuleInput,
} from "../../../services/platformModulesService";
import ModuleFormModal from "./ModuleFormModal";

function groupModules(modules: FeatureModule[]) {
  const lms = modules.filter((m) => m.module_type === "lms");
  const platform = modules.filter((m) => m.module_type === "platform");
  return { lms, platform };
}

function ModuleRow({
  mod,
  onEdit,
  onDelete,
}: {
  mod: FeatureModule;
  onEdit: (m: FeatureModule) => void;
  onDelete: (m: FeatureModule) => void;
}) {
  const Icon = moduleIcon(mod.icon);
  const inUse = mod.assigned_colleges_count > 0;

  return (
    <div className="flex items-start gap-4 px-6 py-4 transition-colors hover:bg-slate-50/80">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-admin-accent/10 text-admin-accent">
        <Icon className="h-5 w-5" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold text-gray-900">{mod.name}</h3>
          {mod.is_default && (
            <Badge variant="info" className="gap-0.5 text-[10px]">
              <Star className="h-3 w-3" />
              Default
            </Badge>
          )}
          {inUse && (
            <Badge variant="muted" className="gap-0.5 text-[10px]">
              <Lock className="h-3 w-3" />
              In use · {mod.assigned_colleges_count} college
              {mod.assigned_colleges_count === 1 ? "" : "s"}
            </Badge>
          )}
          <span className="text-xs text-gray-400">{mod.key}</span>
        </div>
        {mod.description && (
          <p className="mt-0.5 text-sm text-gray-500">{mod.description}</p>
        )}
        <div className="mt-2 flex flex-wrap gap-1">
          {mod.features.slice(0, 8).map((f) => (
            <Badge key={f} variant="muted" className="text-[10px]">
              {featureLabel(f)}
            </Badge>
          ))}
          {mod.features.length > 8 && (
            <Badge variant="muted" className="text-[10px]">
              +{mod.features.length - 8}
            </Badge>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <StatusBadge
          status={mod.status === "active" ? "active" : mod.status === "draft" ? "pending" : "inactive"}
          size="sm"
        />
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => onEdit(mod)}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
            title="Edit"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(mod)}
            disabled={inUse}
            className="rounded-lg p-2 text-rose-500 enabled:hover:bg-rose-50 disabled:cursor-not-allowed disabled:text-gray-300"
            title={
              inUse
                ? "Cannot archive — module is enabled for one or more colleges"
                : "Archive"
            }
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ModulesPage() {
  const [modules, setModules] = useState<FeatureModule[]>([]);
  const [catalog, setCatalog] = useState<Awaited<ReturnType<typeof platformModulesService.getCatalog>>>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<FeatureModule | null>(null);
  const [saving, setSaving] = useState(false);

  const { lms, platform } = useMemo(() => groupModules(modules), [modules]);

  const load = async () => {
    setLoading(true);
    try {
      const [mods, cat] = await Promise.all([
        platformModulesService.list(),
        platformModulesService.getCatalog(),
      ]);
      setModules(mods);
      setCatalog(cat);
    } catch {
      toast.error("Failed to load modules");
      setModules([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (mod: FeatureModule) => {
    setEditing(mod);
    setModalOpen(true);
  };

  const handleSubmit = async (data: CreateModuleInput) => {
    setSaving(true);
    try {
      if (editing) {
        await platformModulesService.update(editing.id, data);
        toast.success("Module updated");
      } else {
        await platformModulesService.create(data);
        toast.success("Module created");
      }
      setModalOpen(false);
      load();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        "Save failed";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (mod: FeatureModule) => {
    if (mod.assigned_colleges_count > 0) {
      toast.error(
        `"${mod.name}" is enabled for ${mod.assigned_colleges_count} college${
          mod.assigned_colleges_count === 1 ? "" : "s"
        }. Disable it everywhere before deleting.`
      );
      return;
    }
    if (!confirm(`Archive module "${mod.name}"? Colleges will lose this assignment.`)) return;
    try {
      await platformModulesService.remove(mod.id);
      toast.success("Module archived");
      load();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        "Delete failed";
      toast.error(msg);
    }
  };

  const renderSection = (title: string, subtitle: string, items: FeatureModule[]) => (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Layers className="h-5 w-5 text-admin-accent" />
        <div>
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <p className="text-sm text-gray-500">{subtitle}</p>
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-gray-200/70 bg-white shadow-admin-card">
        {items.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">No modules in this category.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {items.map((mod) => (
              <ModuleRow key={mod.id} mod={mod} onEdit={openEdit} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>
    </section>
  );

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-gray-900">Module Management</h2>
          <p className="mt-1 text-gray-500">
            Define LMS learning groups and platform bundles — assign them per college.
          </p>
        </div>
        <Button type="button" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Create New Module
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
      ) : modules.length === 0 ? (
        <div className="rounded-xl border border-gray-200/70 bg-white py-16 text-center shadow-admin-card">
          <Package className="mx-auto mb-2 h-8 w-8 text-gray-300" />
          <p className="text-gray-500">No modules yet. Create your first feature bundle.</p>
        </div>
      ) : (
        <div className="space-y-10">
          {renderSection(
            "LMS Learning Groups",
            "Aptitude, technical, soft skills, interview prep, and entrance exams — shown in college & student sidebars.",
            lms
          )}
          {platform.length > 0 &&
            renderSection(
              "Platform Bundles",
              "Optional add-on capability packs beyond core campus operations.",
              platform
            )}
        </div>
      )}

      <ModuleFormModal
        open={modalOpen}
        catalog={catalog}
        initial={editing}
        saving={saving}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
