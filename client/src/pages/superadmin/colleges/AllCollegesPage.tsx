import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Eye, Package, Pencil, Plus, Power, PowerOff, Search, UserPlus, Users } from "lucide-react";
import toast from "react-hot-toast";
import StatusBadge from "../../../components/superadmin/StatusBadge";
import ConfirmModal from "../../../components/superadmin/ConfirmModal";
import collegeService, { College } from "../../../services/collegeService";

const STATUS_FILTERS = ["all", "active", "pending", "suspended"] as const;

export default function AllCollegesPage() {
  const [colleges, setColleges] = useState<College[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionCollegeId, setActionCollegeId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] =
    useState<(typeof STATUS_FILTERS)[number]>("all");
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    tone: "default" | "danger";
    onConfirm: () => Promise<void>;
  } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const loadColleges = useCallback(async () => {
    setLoading(true);
    try {
      const { colleges: data } = await collegeService.getAllColleges(
        statusFilter === "all" ? undefined : statusFilter,
        search || undefined
      );
      setColleges(data);
    } catch {
      setColleges([]);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    const debounce = setTimeout(loadColleges, 300);
    return () => clearTimeout(debounce);
  }, [loadColleges]);

  const runConfirm = async () => {
    if (!confirmDialog) return;
    setConfirmBusy(true);
    try {
      await confirmDialog.onConfirm();
      setConfirmDialog(null);
    } finally {
      setConfirmBusy(false);
    }
  };

  const toggleCollegeStatus = (college: College) => {
    const suspend = college.status === "active";
    setConfirmDialog({
      title: suspend ? "Suspend college" : "Activate college",
      message: `${suspend ? "Suspend" : "Activate"} ${college.name}?`,
      confirmLabel: suspend ? "Suspend" : "Activate",
      tone: suspend ? "danger" : "default",
      onConfirm: async () => {
        setActionCollegeId(college.id);
        try {
          if (suspend) {
            await collegeService.deactivateCollege(college.id);
            toast.success("College suspended");
          } else {
            await collegeService.activateCollege(college.id);
            toast.success("College activated");
          }
          await loadColleges();
        } catch {
          toast.error("College status update failed");
        } finally {
          setActionCollegeId(null);
        }
      },
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-gray-900">All Colleges</h2>
          <p className="text-gray-500 mt-1">Manage all registered colleges and their settings.</p>
        </div>
        <Link
          to="/app/superadmin/colleges/new"
          className="inline-flex items-center gap-2 rounded-lg bg-navy-900 px-4 py-2 text-sm font-medium text-white hover:bg-navy-800 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add College
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[220px] relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search colleges..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-admin-accent"
            />
          </div>
          <div className="flex gap-1.5">
            {STATUS_FILTERS.map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-2 rounded-lg font-medium text-sm transition-colors ${
                  statusFilter === status
                    ? "bg-navy-900/[0.06] text-navy-900"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Colleges table */}
      <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50/70 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">College</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Email</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">City</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Students</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                [1, 2, 3].map((i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4" colSpan={6}>
                      <div className="h-4 bg-gray-100 rounded w-1/3" />
                    </td>
                  </tr>
                ))
              ) : (
                colleges.map((college) => (
                  <tr key={college.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{college.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{college.email || "—"}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{college.city || "—"}</td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900 tabular-nums">{college.student_count}</td>
                    <td className="px-6 py-4">
                      <StatusBadge status={college.status} size="sm" />
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          to={`/app/superadmin/colleges/${college.id}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 text-gray-700 hover:border-admin-accent hover:text-admin-accent"
                          title="View"
                          aria-label="View college"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                        <Link
                          to={`/app/superadmin/colleges/${college.id}?edit=1`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 text-gray-700 hover:border-admin-accent hover:text-admin-accent"
                          title="Edit"
                          aria-label="Edit college"
                        >
                          <Pencil className="h-4 w-4" />
                        </Link>
                        <Link
                          to={`/app/superadmin/students?collegeId=${college.id}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 text-gray-700 hover:border-admin-accent hover:text-admin-accent"
                          title="Students"
                          aria-label="View students"
                        >
                          <Users className="h-4 w-4" />
                        </Link>
                        {college.status === "active" && (
                          <Link
                            to={`/app/superadmin/students?action=add&collegeId=${college.id}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 text-gray-700 hover:border-admin-accent hover:text-admin-accent"
                            title="Add student"
                            aria-label="Add student"
                          >
                            <UserPlus className="h-4 w-4" />
                          </Link>
                        )}
                        <Link
                          to={`/app/superadmin/colleges/${college.id}?tab=modules`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 text-gray-700 hover:border-admin-accent hover:text-admin-accent"
                          title="Modules"
                          aria-label="Manage modules"
                        >
                          <Package className="h-4 w-4" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => toggleCollegeStatus(college)}
                          disabled={actionCollegeId === college.id}
                          className={`inline-flex h-8 w-8 items-center justify-center rounded-md border disabled:opacity-50 ${
                            college.status === "active"
                              ? "border-red-200 text-red-700 hover:bg-red-50"
                              : "border-green-200 text-green-700 hover:bg-green-50"
                          }`}
                          title={college.status === "active" ? "Suspend" : "Activate"}
                          aria-label={college.status === "active" ? "Suspend college" : "Activate college"}
                        >
                          {college.status === "active" ? (
                            <PowerOff className="h-4 w-4" />
                          ) : (
                            <Power className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {!loading && colleges.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-12 text-center">
          <p className="text-gray-500">No colleges found</p>
        </div>
      )}

      <ConfirmModal
        open={!!confirmDialog}
        title={confirmDialog?.title || ""}
        message={confirmDialog?.message || ""}
        confirmLabel={confirmDialog?.confirmLabel}
        tone={confirmDialog?.tone}
        busy={confirmBusy}
        onConfirm={runConfirm}
        onCancel={() => {
          if (!confirmBusy) setConfirmDialog(null);
        }}
      />
    </div>
  );
}
