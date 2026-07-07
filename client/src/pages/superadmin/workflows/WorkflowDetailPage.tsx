import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  ArrowLeftIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  TrashIcon,
  PlusIcon,
  AcademicCapIcon,
  PencilSquareIcon,
  ClipboardDocumentCheckIcon,
  TrophyIcon,
  EnvelopeIcon,
  BellIcon,
  CheckCircleIcon,
  ClockIcon,
  ChartBarIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";
import StatusBadge from "../../../components/superadmin/StatusBadge";
import workflowService, { Workflow, WorkflowStep } from "../../../services/workflowService";

type IconType = React.ForwardRefExoticComponent<
  React.SVGProps<SVGSVGElement> & { title?: string; titleId?: string }
>;

interface StageTypeMeta {
  label: string;
  icon: IconType;
  badge: string; // tailwind classes for the type chip
  hint: string;
}

// Learning-pipeline stages first (the default template), automation types after.
const STAGE_TYPES: Record<string, StageTypeMeta> = {
  learn: {
    label: "Learn",
    icon: AcademicCapIcon,
    badge: "bg-blue-100 text-blue-800",
    hint: "Study modules, videos, and reading material",
  },
  practice: {
    label: "Practice",
    icon: PencilSquareIcon,
    badge: "bg-green-100 text-green-800",
    hint: "Practice questions with instant feedback",
  },
  exam: {
    label: "Exam",
    icon: ClipboardDocumentCheckIcon,
    badge: "bg-orange-100 text-orange-800",
    hint: "Timed, proctored assessment",
  },
  certify: {
    label: "Certify",
    icon: TrophyIcon,
    badge: "bg-purple-100 text-purple-800",
    hint: "Certificate issued on passing",
  },
  assessment: {
    label: "Assessment",
    icon: ChartBarIcon,
    badge: "bg-gray-100 text-gray-800",
    hint: "Generic assessment step",
  },
  email: {
    label: "Email",
    icon: EnvelopeIcon,
    badge: "bg-gray-100 text-gray-800",
    hint: "Send an email from a template",
  },
  notification: {
    label: "Notification",
    icon: BellIcon,
    badge: "bg-gray-100 text-gray-800",
    hint: "Send an in-app notification",
  },
  approval: {
    label: "Approval",
    icon: CheckCircleIcon,
    badge: "bg-gray-100 text-gray-800",
    hint: "Wait for an admin approval",
  },
  delay: {
    label: "Delay",
    icon: ClockIcon,
    badge: "bg-gray-100 text-gray-800",
    hint: "Wait before the next stage",
  },
};

const PIPELINE_TYPES = ["learn", "practice", "exam", "certify"];
const AUTOMATION_TYPES = ["email", "notification", "approval", "delay"];

const CATEGORY_LABELS: Record<string, string> = {
  aptitude: "Aptitude & Reasoning",
  "soft-skills": "Soft Skills",
  technical: "Technical Skills",
};

const TRIGGER_OPTIONS = [
  "assessment_completed",
  "student_enrolled",
  "payment_received",
  "approval_requested",
  "schedule_triggered",
];

function stageMeta(type: string): StageTypeMeta {
  return (
    STAGE_TYPES[type] || {
      label: type,
      icon: ChartBarIcon,
      badge: "bg-gray-100 text-gray-800",
      hint: "",
    }
  );
}

export default function WorkflowDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [savingMeta, setSavingMeta] = useState(false);
  const [savingSteps, setSavingSteps] = useState(false);
  const [stepsDirty, setStepsDirty] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);

  // Editable meta fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("aptitude");
  const [triggerEvent, setTriggerEvent] = useState(TRIGGER_OPTIONS[0]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    workflowService
      .getWorkflow(id)
      .then((wf) => {
        setWorkflow(wf);
        setSteps(wf.steps || []);
        setName(wf.name);
        setDescription(wf.description || "");
        setCategory(wf.category || "aptitude");
        setTriggerEvent(wf.trigger_event);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  const mutateSteps = (next: WorkflowStep[]) => {
    setSteps(next);
    setStepsDirty(true);
  };

  const addStage = (type: string) => {
    const meta = stageMeta(type);
    mutateSteps([...steps, { name: meta.label, type, config: { description: meta.hint } }]);
    setShowAddMenu(false);
  };

  const removeStage = (index: number) => {
    mutateSteps(steps.filter((_, i) => i !== index));
  };

  const moveStage = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= steps.length) return;
    const next = [...steps];
    [next[index], next[target]] = [next[target], next[index]];
    mutateSteps(next);
  };

  const updateStage = (index: number, patch: Partial<WorkflowStep>) => {
    mutateSteps(steps.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };

  const saveMeta = async () => {
    if (!id || !name.trim()) {
      toast.error("Workflow name is required");
      return;
    }
    setSavingMeta(true);
    try {
      await workflowService.updateWorkflow(id, {
        name: name.trim(),
        description,
        category,
        trigger_event: triggerEvent,
      });
      toast.success("Workflow details saved");
    } catch {
      toast.error("Failed to save workflow details");
    } finally {
      setSavingMeta(false);
    }
  };

  const saveSteps = async () => {
    if (!id) return;
    setSavingSteps(true);
    try {
      const res = await workflowService.updateWorkflowSteps(id, steps);
      toast.success(`Saved ${res.step_count} stage(s)`);
      setStepsDirty(false);
    } catch {
      toast.error("Failed to save stages");
    } finally {
      setSavingSteps(false);
    }
  };

  const toggleActive = async () => {
    if (!id || !workflow) return;
    try {
      await workflowService.updateWorkflow(id, { is_active: !workflow.is_active });
      setWorkflow({ ...workflow, is_active: !workflow.is_active });
      toast.success(`Workflow ${!workflow.is_active ? "activated" : "deactivated"}`);
    } catch {
      toast.error("Failed to toggle workflow");
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="h-8 w-64 bg-gray-200 rounded animate-pulse" />
      </div>
    );
  }

  if (notFound || !workflow) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8">
        <Link
          to="/app/superadmin/workflows"
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Back to Workflows
        </Link>
        <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-12 text-center text-gray-600">
          Workflow not found
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <Link
        to={`/app/superadmin/workflows${workflow.category ? `?category=${workflow.category}` : ""}`}
        className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-4"
      >
        <ArrowLeftIcon className="w-4 h-4" />
        Back to Workflows
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-gray-900">{workflow.name}</h2>
          <p className="text-gray-500 mt-1">
            {CATEGORY_LABELS[workflow.category || ""] || "Uncategorized"} ·{" "}
            {workflow.trigger_event.replace(/_/g, " ")}
          </p>
        </div>
        <button onClick={toggleActive} title="Click to toggle">
          <StatusBadge
            status={workflow.is_active ? "active" : "inactive"}
            label={workflow.is_active ? "Active" : "Inactive"}
          />
        </button>
      </div>

      {/* Pipeline overview */}
      {steps.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-4 mb-6 overflow-x-auto">
          <div className="flex items-center gap-2 min-w-max">
            {steps.map((step, i) => {
              const meta = stageMeta(step.type);
              const Icon = meta.icon;
              return (
                <div key={i} className="flex items-center gap-2">
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${meta.badge}`}>
                    <Icon className="w-4 h-4" />
                    <span className="text-sm font-medium">{step.name || meta.label}</span>
                  </div>
                  {i < steps.length - 1 && <ArrowRightIcon className="w-4 h-4 text-gray-400" />}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stages editor */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Stages ({steps.length})</h3>
            <div className="relative">
              <button
                onClick={() => setShowAddMenu((v) => !v)}
                className="flex items-center gap-2 px-3 py-2 bg-navy-900 text-white rounded-lg text-sm font-medium hover:bg-navy-800"
              >
                <PlusIcon className="w-4 h-4" />
                Add Stage
              </button>
              {showAddMenu && (
                <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-10 p-2">
                  <p className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase">Learning Pipeline</p>
                  {PIPELINE_TYPES.map((t) => {
                    const meta = stageMeta(t);
                    const Icon = meta.icon;
                    return (
                      <button
                        key={t}
                        onClick={() => addStage(t)}
                        className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50 text-left"
                      >
                        <Icon className="w-4 h-4" />
                        <span className="font-medium">{meta.label}</span>
                        <span className="text-xs text-gray-400 truncate">{meta.hint}</span>
                      </button>
                    );
                  })}
                  <p className="px-2 py-1 mt-1 text-xs font-semibold text-gray-500 uppercase">Automation</p>
                  {AUTOMATION_TYPES.map((t) => {
                    const meta = stageMeta(t);
                    const Icon = meta.icon;
                    return (
                      <button
                        key={t}
                        onClick={() => addStage(t)}
                        className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50 text-left"
                      >
                        <Icon className="w-4 h-4" />
                        <span className="font-medium">{meta.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {steps.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-12 text-center text-gray-600">
              No stages yet. Add stages to build the learning pipeline
              (e.g. Learn → Practice → Exam → Certify).
            </div>
          ) : (
            <div className="space-y-3">
              {steps.map((step, i) => {
                const meta = stageMeta(step.type);
                const Icon = meta.icon;
                return (
                  <div key={i} className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-4">
                    <div className="flex items-start gap-3">
                      <span
                        className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium whitespace-nowrap mt-1 ${meta.badge}`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {meta.label}
                      </span>
                      <div className="flex-1 space-y-2">
                        <input
                          type="text"
                          value={step.name}
                          onChange={(e) => updateStage(i, { name: e.target.value })}
                          placeholder="Stage name"
                          className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-admin-accent"
                        />
                        <textarea
                          rows={2}
                          value={step.config?.description || ""}
                          onChange={(e) =>
                            updateStage(i, { config: { ...step.config, description: e.target.value } })
                          }
                          placeholder="What happens in this stage..."
                          className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-admin-accent"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => moveStage(i, -1)}
                          disabled={i === 0}
                          className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                          title="Move up"
                        >
                          <ArrowUpIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => moveStage(i, 1)}
                          disabled={i === steps.length - 1}
                          className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                          title="Move down"
                        >
                          <ArrowDownIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => removeStage(i)}
                          className="p-1 text-red-400 hover:text-red-600"
                          title="Remove stage"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <button
            onClick={saveSteps}
            disabled={savingSteps || !stepsDirty}
            className="mt-4 px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
          >
            {savingSteps ? "Saving..." : stepsDirty ? "Save Stages" : "Stages Saved"}
          </button>
        </div>

        {/* Workflow details editor */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Details</h3>
          <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-admin-accent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-admin-accent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-admin-accent"
              >
                {Object.entries(CATEGORY_LABELS).map(([value, lbl]) => (
                  <option key={value} value={value}>
                    {lbl}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Trigger Event</label>
              <select
                value={triggerEvent}
                onChange={(e) => setTriggerEvent(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-admin-accent"
              >
                {TRIGGER_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={saveMeta}
              disabled={savingMeta}
              className="w-full px-4 py-2 bg-navy-900 text-white rounded-lg font-medium hover:bg-navy-800 disabled:opacity-50"
            >
              {savingMeta ? "Saving..." : "Save Details"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
