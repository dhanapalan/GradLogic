import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  MagnifyingGlassIcon,
  PlusIcon,
  EyeIcon,
  TrashIcon,
  NoSymbolIcon,
  CheckIcon,
} from "@heroicons/react/24/outline";
import toast from "react-hot-toast";
import userService, { User, UserFilters } from "../../../services/userService";
import collegeService, { College } from "../../../services/collegeService";
import StatusBadge from "../../../components/superadmin/StatusBadge";

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  college_admin: { title: "College Administrators", subtitle: "College admin accounts across the platform" },
  instructor: { title: "Faculty", subtitle: "Faculty / instructor accounts across the platform" },
};

// Roles the backend actually persists a college_id for (see user.controller.ts isCollegeRole).
const COLLEGE_SCOPED_ROLES = new Set(["college_admin", "college_staff", "college", "student", "instructor"]);

export default function AllUsersPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialRole = searchParams.get("role") || "all";
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>(initialRole);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [total, setTotal] = useState(0);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<string>("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    full_name: "",
    email: "",
    password: "",
    role: "college_admin",
    phone: "",
    college_id: "",
  });
  const [colleges, setColleges] = useState<College[]>([]);

  useEffect(() => {
    collegeService
      .getAllColleges()
      .then((res) => setColleges(res.colleges))
      .catch(() => setColleges([]));
  }, []);

  useEffect(() => {
    const loadUsers = async () => {
      setLoading(true);
      try {
        const filters: UserFilters = {
          page,
          limit,
          search: search || undefined,
          role: roleFilter === "all" ? undefined : roleFilter,
          status: statusFilter === "all" ? undefined : statusFilter,
        };

        const response = await userService.listUsers(filters);
        setUsers(response.data);
        setTotal(response.pagination.total);
      } catch (error) {
        toast.error("Failed to load users");
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    loadUsers();
  }, [search, roleFilter, statusFilter, page, limit]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedUsers(new Set(users.map((u) => u.id)));
    } else {
      setSelectedUsers(new Set());
    }
  };

  const handleSelectUser = (userId: string, checked: boolean) => {
    const newSelected = new Set(selectedUsers);
    if (checked) {
      newSelected.add(userId);
    } else {
      newSelected.delete(userId);
    }
    setSelectedUsers(newSelected);
  };

  const handleBulkAction = async () => {
    if (selectedUsers.size === 0) {
      toast.error("No users selected");
      return;
    }

    if (!bulkAction) {
      toast.error("Select an action");
      return;
    }

    setBulkLoading(true);
    try {
      await userService.bulkUserAction(
        Array.from(selectedUsers),
        bulkAction as "suspend" | "delete" | "deactivate" | "activate"
      );

      toast.success(`${bulkAction} completed for ${selectedUsers.size} users`);
      setSelectedUsers(new Set());
      setBulkAction("");

      const filters: UserFilters = {
        page,
        limit,
        search: search || undefined,
        role: roleFilter === "all" ? undefined : roleFilter,
        status: statusFilter === "all" ? undefined : statusFilter,
      };

      const response = await userService.listUsers(filters);
      setUsers(response.data);
      setTotal(response.pagination.total);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Bulk action failed");
      console.error(error);
    } finally {
      setBulkLoading(false);
    }
  };

  const handleToggleActive = async (user: User) => {
    const deactivate = user.status === "active" || user.status === "suspended";
    if (
      !confirm(
        deactivate
          ? "Deactivate this user? They can be reactivated later."
          : "Activate this user?"
      )
    ) {
      return;
    }
    try {
      if (deactivate) {
        await userService.deactivateUser(user.id);
        setUsers((prev) =>
          prev.map((u) => (u.id === user.id ? { ...u, status: "inactive" } : u))
        );
        toast.success("User deactivated");
      } else {
        await userService.activateUser(user.id);
        setUsers((prev) =>
          prev.map((u) => (u.id === user.id ? { ...u, status: "active" } : u))
        );
        toast.success("User activated");
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Action failed");
    }
  };

  const handleInviteUser = async () => {
    if (!inviteForm.full_name.trim() || !inviteForm.email.trim() || !inviteForm.password) {
      toast.error("Name, email, and password are required");
      return;
    }
    if (COLLEGE_SCOPED_ROLES.has(inviteForm.role) && !inviteForm.college_id) {
      toast.error("Select a college for this role");
      return;
    }
    setInviteLoading(true);
    try {
      await userService.createUser({
        full_name: inviteForm.full_name.trim(),
        email: inviteForm.email.trim(),
        password: inviteForm.password,
        role: inviteForm.role,
        phone: inviteForm.phone || undefined,
        college_id: COLLEGE_SCOPED_ROLES.has(inviteForm.role) ? inviteForm.college_id : undefined,
      });
      toast.success("User invited successfully");
      setShowInvite(false);
      setInviteForm({ full_name: "", email: "", password: "", role: "college_admin", phone: "", college_id: "" });
      const response = await userService.listUsers({ page, limit });
      setUsers(response.data);
      setTotal(response.pagination.total);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to invite user");
    } finally {
      setInviteLoading(false);
    }
  };

  const handleSuspendUser = async (userId: string) => {
    try {
      await userService.suspendUser(userId);
      toast.success("User suspended");
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, status: "suspended" } : u
        )
      );
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to suspend user");
      console.error(error);
    }
  };

  const handleUnsuspendUser = async (userId: string) => {
    try {
      await userService.unsuspendUser(userId);
      toast.success("User unsuspended");
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, status: "active" } : u))
      );
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to unsuspend user");
      console.error(error);
    }
  };

  const pages = Math.ceil(total / limit);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-gray-900">
            {PAGE_TITLES[roleFilter]?.title || "All Users"}
          </h2>
          <p className="text-gray-500 mt-1">
            {PAGE_TITLES[roleFilter]?.subtitle || "Manage platform users"} ({total} total).
          </p>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="flex items-center gap-2 px-4 py-2 bg-navy-900 text-white rounded-lg font-medium hover:bg-navy-800"
        >
          <PlusIcon className="w-5 h-5" />
          Invite User
        </button>
      </div>

      {showInvite && (
        <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Invite User</h3>
          <div className="grid grid-cols-2 gap-4">
            <input
              placeholder="Full name *"
              value={inviteForm.full_name}
              onChange={(e) => setInviteForm({ ...inviteForm, full_name: e.target.value })}
              className="px-4 py-2 border border-gray-200 rounded-lg"
            />
            <input
              type="email"
              placeholder="Email *"
              value={inviteForm.email}
              onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
              className="px-4 py-2 border border-gray-200 rounded-lg"
            />
            <input
              type="password"
              placeholder="Temporary password *"
              value={inviteForm.password}
              onChange={(e) => setInviteForm({ ...inviteForm, password: e.target.value })}
              className="px-4 py-2 border border-gray-200 rounded-lg"
            />
            <select
              value={inviteForm.role}
              onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
              className="px-4 py-2 border border-gray-200 rounded-lg"
            >
              <option value="college_admin">College Admin</option>
              <option value="super_admin">Super Admin</option>
              <option value="instructor">Instructor / Faculty</option>
              <option value="hr">HR</option>
              <option value="student">Student</option>
            </select>
            {COLLEGE_SCOPED_ROLES.has(inviteForm.role) && (
              <select
                value={inviteForm.college_id}
                onChange={(e) => setInviteForm({ ...inviteForm, college_id: e.target.value })}
                className="px-4 py-2 border border-gray-200 rounded-lg"
              >
                <option value="">Select college *</option>
                {colleges.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleInviteUser}
              disabled={inviteLoading}
              className="px-4 py-2 bg-navy-900 text-white rounded-lg disabled:opacity-50"
            >
              {inviteLoading ? "Creating..." : "Create User"}
            </button>
            <button onClick={() => setShowInvite(false)} className="px-4 py-2 border border-gray-300 rounded-lg">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-4 mb-6">
        <div className="grid grid-cols-3 gap-4">
          <div className="relative col-span-2">
            <MagnifyingGlassIcon className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, email, phone..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-admin-accent"
            />
          </div>

          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-admin-accent"
          >
            <option value="all">All Roles</option>
            <option value="super_admin">Super Admin</option>
            <option value="college_admin">College Admin</option>
            <option value="instructor">Instructor / Faculty</option>
            <option value="tpo">TPO</option>
            <option value="mentor">Mentor</option>
            <option value="student">Student</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-admin-accent"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
      </div>

      {selectedUsers.size > 0 && (
        <div className="bg-navy-900/[0.04] border border-navy-900/10 rounded-xl p-4 mb-6 flex items-center gap-4">
          <p className="font-semibold text-navy-900">{selectedUsers.size} selected</p>
          <select
            value={bulkAction}
            onChange={(e) => setBulkAction(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">-- Action --</option>
            <option value="suspend">Suspend</option>
            <option value="activate">Activate</option>
            <option value="deactivate">Deactivate</option>
          </select>
          <button
            onClick={handleBulkAction}
            disabled={bulkLoading || !bulkAction}
            className="px-4 py-2 bg-navy-900 text-white rounded-lg text-sm disabled:opacity-50"
          >
            {bulkLoading ? "Processing..." : "Apply"}
          </button>
          <button
            onClick={() => {
              setSelectedUsers(new Set());
              setBulkAction("");
            }}
            className="px-4 py-2 text-admin-accent text-sm"
          >
            Cancel
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-600">Loading users...</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50/70 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedUsers.size === users.length && users.length > 0}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Role</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">College</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Joined</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          checked={selectedUsers.has(user.id)}
                          onChange={(e) => handleSelectUser(user.id, e.target.checked)}
                        />
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{user.full_name}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{user.email}</td>
                      <td className="px-6 py-4 text-sm text-gray-600 capitalize">{user.role}</td>
                      <td className="px-6 py-4 text-sm">
                        <StatusBadge status={user.status} label={user.status} size="sm" />
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{user.college_name || "-"}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-sm flex gap-2">
                        <button onClick={() => navigate(`/app/superadmin/users/${user.id}`)}>
                          <EyeIcon className="w-4 h-4 text-admin-accent" />
                        </button>
                        {user.status === "suspended" ? (
                          <button onClick={() => handleUnsuspendUser(user.id)}>
                            <CheckIcon className="w-4 h-4 text-green-600" />
                          </button>
                        ) : (
                          <button onClick={() => handleSuspendUser(user.id)}>
                            <NoSymbolIcon className="w-4 h-4 text-yellow-600" />
                          </button>
                        )}
                        <button onClick={() => handleToggleActive(user)} title={user.status === "inactive" ? "Activate" : "Deactivate"}>
                          {user.status === "inactive" ? (
                            <CheckIcon className="w-4 h-4 text-green-600" />
                          ) : (
                            <TrashIcon className="w-4 h-4 text-red-600" />
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {users.length === 0 && (
              <div className="p-12 text-center text-gray-600">No users found</div>
            )}
          </>
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
                    p === page
                      ? "bg-navy-900 text-white"
                      : "border border-gray-300"
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
    </div>
  );
}
