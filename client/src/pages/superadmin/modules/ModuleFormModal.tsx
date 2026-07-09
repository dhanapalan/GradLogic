import { useEffect, useState } from "react";
import { X } from "lucide-react";
import {
  FEATURE_CATEGORY_LABELS,
  featuresByCategory,
  type FeatureCatalogItem,
  type FeatureCategory,
} from "../../../constants/platformFeatures";
import type { CreateModuleInput, FeatureModule } from "../../../services/platformModulesService";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Select } from "../../../components/ui/select";
import { Badge } from "../../../components/ui/badge";

const ICON_OPTIONS = [
  { value: "brain", label: "Brain (Aptitude)" },
  { value: "code", label: "Code (Technical)" },
  { value: "message-circle", label: "Message (Soft Skills)" },
  { value: "mic", label: "Mic (Interview)" },
  { value: "graduation-cap", label: "Graduation (Entrance)" },
  { value: "building", label: "Building (Platform)" },
  { value: "book-open", label: "Book" },
  { value: "bar-chart", label: "Analytics" },
  { value: "sparkles", label: "Sparkles" },
];

interface ModuleFormModalProps {
  open: boolean;
  catalog: FeatureCatalogItem[];
  initial?: FeatureModule | null;
  saving: boolean;
  onClose: () => void;
  onSubmit: (data: CreateModuleInput) => void;
}

export default function ModuleFormModal({
  open,
  catalog: _catalog,
  initial,
  saving,
  onClose,
  onSubmit,
}: ModuleFormModalProps) {
  void _catalog;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"active" | "draft" | "archived">("active");
  const [moduleType, setModuleType] = useState<"lms" | "platform">("lms");
  const [isDefault, setIsDefault] = useState(false);
  const [sortOrder, setSortOrder] = useState(0);
  const [icon, setIcon] = useState("book-open");
  const [features, setFeatures] = useState<string[]>([]);

  const grouped = featuresByCategory();

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setDescription(initial?.description ?? "");
    setStatus(initial?.status ?? "active");
    setModuleType(initial?.module_type ?? "lms");
    setIsDefault(initial?.is_default ?? false);
    setSortOrder(initial?.sort_order ?? 0);
    setIcon(initial?.icon ?? "book-open");
    setFeatures(initial?.features ?? []);
  }, [open, initial]);

  if (!open) return null;

  const toggleFeature = (key: string) => {
    setFeatures((prev) =>
      prev.includes(key) ? prev.filter((f) => f !== key) : [...prev, key]
    );
  };

  const toggleCategory = (cat: FeatureCategory) => {
    const keys = grouped[cat].map((f) => f.key);
    const allSelected = keys.every((k) => features.includes(k));
    if (allSelected) {
      setFeatures((prev) => prev.filter((f) => !keys.includes(f as (typeof keys)[number])));
    } else {
      setFeatures((prev) => [...new Set([...prev, ...keys])]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      description,
      status,
      features,
      module_type: moduleType,
      is_default: isDefault,
      sort_order: sortOrder,
      icon,
    });
  };

  const categories = (Object.keys(FEATURE_CATEGORY_LABELS) as FeatureCategory[]).filter(
    (cat) => grouped[cat].length > 0
  );

  const inUse = (initial?.assigned_colleges_count ?? 0) > 0;
  const lockDeactivate = inUse && initial?.status === "active";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {initial ? "Edit Module" : "Create New Module"}
          </h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 hover:bg-gray-100">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">Module name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Aptitude & Reasoning"
                required
              />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-admin-accent/30"
                placeholder="What this module enables for colleges..."
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Type</label>
              <Select
                value={moduleType}
                onChange={(e) => setModuleType(e.target.value as "lms" | "platform")}
              >
                <option value="lms">LMS Learning Group</option>
                <option value="platform">Platform Bundle</option>
              </Select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Status</label>
              <Select
                value={status}
                disabled={lockDeactivate}
                onChange={(e) => setStatus(e.target.value as typeof status)}
              >
                <option value="active">Active</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </Select>
              {lockDeactivate && (
                <p className="mt-1 text-xs text-amber-600">
                  Enabled for {initial?.assigned_colleges_count} college
                  {initial?.assigned_colleges_count === 1 ? "" : "s"} — disable it everywhere before
                  deactivating.
                </p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Icon</label>
              <Select value={icon} onChange={(e) => setIcon(e.target.value)}>
                {ICON_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Sort order</label>
              <Input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
              />
            </div>

            <div className="flex items-center gap-2 sm:col-span-2">
              <input
                id="is-default"
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="rounded border-gray-300"
              />
              <label htmlFor="is-default" className="text-sm text-gray-700">
                Enable by default for newly approved colleges
              </label>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Included features ({features.length})
            </label>
            <div className="max-h-64 space-y-4 overflow-y-auto rounded-lg border border-gray-200 p-3">
              {categories.map((cat) => {
                const items = grouped[cat];
                const catKeys = items.map((f) => f.key);
                const selectedCount = catKeys.filter((k) => features.includes(k)).length;
                return (
                  <div key={cat}>
                    <button
                      type="button"
                      onClick={() => toggleCategory(cat)}
                      className="mb-2 flex w-full items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-left text-sm font-medium text-gray-800 hover:bg-slate-100"
                    >
                      {FEATURE_CATEGORY_LABELS[cat]}
                      <Badge variant="muted" className="text-[10px]">
                        {selectedCount}/{items.length}
                      </Badge>
                    </button>
                    <div className="space-y-1 pl-1">
                      {items.map((item) => (
                        <label
                          key={item.key}
                          className="flex cursor-pointer items-start gap-3 rounded-lg p-2 hover:bg-slate-50"
                        >
                          <input
                            type="checkbox"
                            checked={features.includes(item.key)}
                            onChange={() => toggleFeature(item.key)}
                            className="mt-1 rounded border-gray-300"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-900">{item.label}</span>
                              <Badge variant="muted" className="text-[10px]">
                                {item.portal}
                              </Badge>
                            </div>
                            <p className="text-xs text-gray-500">{item.description}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !name.trim() || features.length === 0}>
              {saving ? "Saving…" : initial ? "Update Module" : "Create Module"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
