import { useState, useEffect } from "react";
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import toast from "react-hot-toast";
import roleService, { Role, Permission } from "../../../services/roleService";
import StatusBadge from "../../../components/superadmin/StatusBadge";

interface PermissionGroup {
  category: string;
  permissions: Permission[];
}

export default function RoleManagementPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [permissionGroups, setPermissionGroups] = useState<PermissionGroup[]>([]);
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(
    new Set()
  );
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDescription, setNewRoleDescription] = useState("");
  const [editRoleName, setEditRoleName] = useState("");
  const [editRoleDescription, setEditRoleDescription] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);

  useEffect(() => {
    loadRoles();
  }, []);

  const loadRoles = async () => {
    setLoading(true);
    try {
      const data = await roleService.listRoles();
      setRoles(data);
    } catch (error) {
      toast.error("Failed to load roles");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadPermissions = async () => {
    try {
      const perms = await roleService.getPermissions();
      const grouped: PermissionGroup[] = Object.entries(perms).map(
        ([category, permissions]) => ({
          category,
          permissions,
        })
      );
      setPermissionGroups(grouped);
    } catch (error) {
      toast.error("Failed to load permissions");
      console.error(error);
    }
  };

  const handleCreateRole = async () => {
    if (!newRoleName.trim()) {
      toast.error("Role name is required");
      return;
    }

    setSubmitLoading(true);
    try {
      await roleService.createRole({
        name: newRoleName,
        description: newRoleDescription,
      });

      toast.success("Role created successfully");
      setNewRoleName("");
      setNewRoleDescription("");
      setShowCreateModal(false);
      await loadRoles();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to create role");
      console.error(error);
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleEditRole = async () => {
    if (!selectedRole || !editRoleName.trim()) {
      toast.error("Role name is required");
      return;
    }

    setSubmitLoading(true);
    try {
      await roleService.updateRole(selectedRole.id, {
        name: editRoleName,
        description: editRoleDescription,
      });

      toast.success("Role updated successfully");
      setShowEditModal(false);
      setSelectedRole(null);
      await loadRoles();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to update role");
      console.error(error);
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    if (
      confirm(
        "Are you sure? This action cannot be undone. Custom roles with users cannot be deleted."
      )
    ) {
      try {
        await roleService.deleteRole(roleId);
        toast.success("Role deleted successfully");
        await loadRoles();
      } catch (error: any) {
        toast.error(error.response?.data?.message || "Failed to delete role");
        console.error(error);
      }
    }
  };

  const handleOpenPermissionsModal = async (role: Role) => {
    setSelectedRole(role);
    await loadPermissions();

    // Load existing permissions
    const roleData = await roleService.getRole(role.id);
    const selectedPermIds = new Set(
      roleData.permissions?.map((p) => p.id) || []
    );
    setSelectedPermissions(selectedPermIds);
    setShowPermissionsModal(true);
  };

  const handleTogglePermission = (permissionId: string, checked: boolean) => {
    const newSelected = new Set(selectedPermissions);
    if (checked) {
      newSelected.add(permissionId);
    } else {
      newSelected.delete(permissionId);
    }
    setSelectedPermissions(newSelected);
  };

  const handleSavePermissions = async () => {
    if (!selectedRole) return;

    setSubmitLoading(true);
    try {
      await roleService.updateRolePermissions(
        selectedRole.id,
        Array.from(selectedPermissions)
      );

      toast.success("Permissions updated successfully");
      setShowPermissionsModal(false);
      setSelectedRole(null);
      await loadRoles();
    } catch (error: any) {
      toast.error(
        error.response?.data?.message || "Failed to update permissions"
      );
      console.error(error);
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-gray-900">Role Management</h2>
          <p className="text-gray-500 mt-1">Manage roles and permissions ({roles.length} total).</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-navy-900 text-white rounded-lg font-medium hover:bg-navy-800"
        >
          <PlusIcon className="w-5 h-5" />
          Create Role
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-600">Loading roles...</div>
        ) : roles.length === 0 ? (
          <div className="p-12 text-center text-gray-600">No roles found</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Role Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Users
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Permissions
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {roles.map((role) => (
                <tr key={role.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {role.name}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {role.description || "-"}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <StatusBadge
                      status={role.is_system ? "system" : "custom"}
                      label={role.is_system ? "System" : "Custom"}
                      size="sm"
                    />
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {role.user_count || 0}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {role.permissions?.length || 0} permissions
                  </td>
                  <td className="px-6 py-4 text-sm flex gap-2">
                    <button
                      onClick={() => handleOpenPermissionsModal(role)}
                      className="px-3 py-1 text-admin-accent text-sm border border-admin-accent/30 rounded hover:bg-navy-900/[0.04]"
                    >
                      Permissions
                    </button>
                    {!role.is_system && (
                      <>
                        <button
                          onClick={() => {
                            setSelectedRole(role);
                            setEditRoleName(role.name);
                            setEditRoleDescription(role.description || "");
                            setShowEditModal(true);
                          }}
                          className="px-2 py-1 text-gray-500 hover:text-admin-accent"
                        >
                          <PencilIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteRole(role.id)}
                          className="px-2 py-1 text-gray-600 hover:text-red-600"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Role Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Create New Role</h3>
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
                  Role Name *
                </label>
                <input
                  type="text"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  placeholder="e.g., Content Manager"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-admin-accent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={newRoleDescription}
                  onChange={(e) => setNewRoleDescription(e.target.value)}
                  placeholder="Role description..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-admin-accent"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateRole}
                disabled={submitLoading}
                className="flex-1 px-4 py-2 bg-navy-900 text-white rounded-lg font-medium hover:bg-navy-800 disabled:opacity-50"
              >
                {submitLoading ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Role Modal */}
      {showEditModal && selectedRole && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Edit Role</h3>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedRole(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role Name *
                </label>
                <input
                  type="text"
                  value={editRoleName}
                  onChange={(e) => setEditRoleName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-admin-accent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={editRoleDescription}
                  onChange={(e) => setEditRoleDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-admin-accent"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedRole(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleEditRole}
                disabled={submitLoading}
                className="flex-1 px-4 py-2 bg-navy-900 text-white rounded-lg font-medium hover:bg-navy-800 disabled:opacity-50"
              >
                {submitLoading ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permissions Modal */}
      {showPermissionsModal && selectedRole && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 sticky top-0 bg-white pb-4">
              <h3 className="text-lg font-semibold">
                Manage Permissions - {selectedRole.name}
              </h3>
              <button
                onClick={() => {
                  setShowPermissionsModal(false);
                  setSelectedRole(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6">
              {permissionGroups.map((group) => (
                <div key={group.category}>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
                    {group.category}
                  </h4>
                  <div className="space-y-2 pl-4">
                    {group.permissions.map((perm) => (
                      <label
                        key={perm.id}
                        className="flex items-start gap-3 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedPermissions.has(perm.id)}
                          onChange={(e) =>
                            handleTogglePermission(perm.id, e.target.checked)
                          }
                          className="mt-1"
                        />
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {perm.name}
                          </p>
                          <p className="text-sm text-gray-600">
                            {perm.description}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3 mt-8 sticky bottom-0 bg-white pt-4">
              <button
                onClick={() => {
                  setShowPermissionsModal(false);
                  setSelectedRole(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePermissions}
                disabled={submitLoading}
                className="flex-1 px-4 py-2 bg-navy-900 text-white rounded-lg font-medium hover:bg-navy-800 disabled:opacity-50"
              >
                {submitLoading ? "Saving..." : "Save Permissions"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
