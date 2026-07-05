import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  MagnifyingGlassIcon,
  PlusIcon,
  PencilIcon,
  CheckIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import toast from "react-hot-toast";
import workflowService, { Workflow, WorkflowFilters, WorkflowStep } from "../../../services/workflowService";
import StatusBadge from "../../../components/superadmin/StatusBadge";

const TRIGGER_OPTIONS = [
  "assessment_completed",
  "student_enrolled",
  "payment_received",
  "approval_requested",
  "schedule_triggered",
];

const CATEGORY_LABELS: Record<string, string> = {
  aptitude: "Aptitude & Reasoning",
  "soft-skills": "Soft Skills",
  technical: "Technical Skills",
};

// The standard learning pipeline new workflows start with.
const DEFAULT_STAGES: WorkflowStep[] = [
  { name: "Learn", type: "learn", config: { description: "Study modules, videos, and reading material" } },
  { name: "Practice", type: "practice", config: { description: "Practice questions with instant feedback" } },
  { name: "Exam", type: "exam", config: { description: "Timed, proctored assessment" } },
  { name: "Certify", type: "certify", config: { description: "Certificate issued on passing" } },
];

export default function WorkflowsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const category = searchParams.get("category") || "";
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [seedDefaultStages, setSeedDefaultStages] = useState(true);

  const [newWorkflow, setNewWorkflow] = useState({
    name: "",
    description: "",
    trigger_event: "assessment_completed",
    category: category || "aptitude",
  });

  // Keep the modal's default category in sync when navigating between
  // the sidebar's category views.
  useEffect(() => {
    setNewWorkflow((w) => ({ ...w, category: category || "aptitude" }));
    setPage(1);
  }, [category]);

  useEffect(() => {
    loadWorkflows();
  }, [page, limit, search, statusFilter, category]);

  const loadWorkflows = async () => {
    setLoading(true);
    try {
      const filters: WorkflowFilters = {
        page,
        limit,
        search: search || undefined,
        status: statusFilter,
        category: category || undefined,
      };

      const response = await workflowService.listWorkflows(filters);
      setWorkflows(response.data);
      setTotal(response.pagination.total);
    } catch (error) {
      toast.error("Failed to load workflows");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWorkflow = async () => {
    if (!newWorkflow.name.trim()) {
      toast.error("Workflow name is required");
      return;
    }

    setSubmitLoading(true);
    try {
      const created = await workflowService.createWorkflow({
        name: newWorkflow.name,
        description: newWorkflow.description,
        trigger_event: newWorkflow.trigger_event,
        category: newWorkflow.category,
        steps: seedDefaultStages ? DEFAULT_STAGES : [],
        conditions: [],
      });

      toast.success("Workflow created successfully");
      setShowCreateModal(false);
      // Take the admin straight into the stage editor for the new workflow.
      navigate(`/app/superadmin/workflows/${created.id}`);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to create workflow");
      console.error(error);
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleToggleActive = async (workflow: Workflow) => {
    const action = workflow.is_active ? "deactivate" : "activate";
    if (!confirm(`${action === "deactivate" ? "Deactivate" : "Activate"} this workflow?`)) return;
    try {
      await workflowService.updateWorkflow(workflow.id, {
        is_active: !workflow.is_active,
      });

      toast.success(`Workflow ${action}d`);
      await loadWorkflows();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to update workflow");
      console.error(error);
    }
  };

  const pages = Math.ceil(total / limit);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">
            {category ? `${CATEGORY_LABELS[category] || category} Workflows` : "Workflows"}
          </h2>
          <p className="text-gray-600 mt-1">Manage automation workflows ({total} total)</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
        >
          <PlusIcon className="w-5 h-5" />
          Create Workflow
        </button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-3 gap-4">
          <div className="relative col-span-2">
            <MagnifyingGlassIcon className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search workflows..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as any);
              setPage(1);
            }}
            className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-600">Loading workflows...</div>
        ) : workflows.length === 0 ? (
          <div className="p-12 text-center text-gray-600">No workflows found</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Name</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Trigger</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Steps</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Created</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {workflows.map((workflow) => (
                <tr key={workflow.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium">
                    <Link
                      to={`/app/superadmin/workflows/${workflow.id}`}
                      className="text-blue-600 hover:text-blue-700"
                    >
                      {workflow.name}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {workflow.trigger_event.replace(/_/g, " ")}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{workflow.step_count || 0}</td>
                  <td className="px-6 py-4 text-sm">
                    <StatusBadge
                      status={workflow.is_active ? "active" : "inactive"}
                      label={workflow.is_active ? "Active" : "Inactive"}
                      size="sm"
                    />
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(workflow.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-sm flex gap-2">
                    <button
                      onClick={() => navigate(`/app/superadmin/workflows/${workflow.id}`)}
                      className="text-blue-600 hover:text-blue-700"
                      title="Edit stages"
                    >
                      <PencilIcon className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleToggleActive(workflow)} title={workflow.is_active ? "Deactivate" : "Activate"}>
                      {workflow.is_active ? (
                        <XMarkIcon className="w-4 h-4 text-yellow-600" />
                      ) : (
                        <CheckIcon className="w-4 h-4 text-green-600" />
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {pages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-gray-600">Page {page} of {pages}</div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm disabled:opacity-50"
            >
              Previous
            </button>
            {Array.from({ length: pages }, (_, i) => i + 1)
              .slice(Math.max(0, page - 3), page + 2)
              .map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`px-3 py-2 rounded-lg text-sm ${
                    p === page ? "bg-blue-600 text-white" : "border border-gray-300"
                  }`}
                >
                  {p}
                </button>
              ))}
            <button
              onClick={() => setPage(Math.min(pages, page + 1))}
              disabled={page === pages}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Create Workflow</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Workflow Name *
                </label>
                <input
                  type="text"
                  value={newWorkflow.name}
                  onChange={(e) => setNewWorkflow({ ...newWorkflow, name: e.target.value })}
                  placeholder="e.g., Assessment Follow-up"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={newWorkflow.description}
                  onChange={(e) => setNewWorkflow({ ...newWorkflow, description: e.target.value })}
                  placeholder="Describe what this workflow does..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category *
                </label>
                <select
                  value={newWorkflow.category}
                  onChange={(e) => setNewWorkflow({ ...newWorkflow, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Trigger Event *
                </label>
                <select
                  value={newWorkflow.trigger_event}
                  onChange={(e) => setNewWorkflow({ ...newWorkflow, trigger_event: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {TRIGGER_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>

              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={seedDefaultStages}
                  onChange={(e) => setSeedDefaultStages(e.target.checked)}
                  className="mt-1"
                />
                <span className="text-sm text-gray-700">
                  Start with the default learning pipeline
                  <span className="block text-xs text-gray-500">
                    Learn → Practice → Exam → Certify (editable after creation)
                  </span>
                </span>
              </label>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateWorkflow}
                disabled={submitLoading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {submitLoading ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
