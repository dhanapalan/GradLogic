import { Fragment, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Loader2, Save, ShieldCheck } from "lucide-react";
import roleService, { type Role, type Permission } from "../../../services/roleService";

interface MatrixState {
  roles: Role[];
  /** category -> permissions */
  groups: Record<string, Permission[]>;
  /** roleId -> Set(permissionId) */
  grants: Record<string, Set<string>>;
}

export default function PermissionMatrixPage() {
  const [state, setState] = useState<MatrixState>({ roles: [], groups: {}, grants: {} });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState<Set<string>>(new Set());

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [roles, groups] = await Promise.all([
        roleService.listRoles(),
        roleService.getPermissions(),
      ]);

      // Fetch each role's current permission set in parallel.
      const detailed = await Promise.all(roles.map((r) => roleService.getRole(r.id)));
      const grants: Record<string, Set<string>> = {};
      detailed.forEach((role) => {
        grants[role.id] = new Set((role.permissions ?? []).map((p) => p.id));
      });

      setState({ roles, groups, grants });
      setDirty(new Set());
    } catch {
      toast.error("Failed to load permission matrix");
    } finally {
      setLoading(false);
    }
  }

  const categories = useMemo(() => Object.keys(state.groups), [state.groups]);

  function isSuperAdmin(role: Role) {
    return role.name === "super_admin";
  }

  function toggle(roleId: string, permId: string) {
    setState((prev) => {
      const next = new Set(prev.grants[roleId] ?? []);
      if (next.has(permId)) next.delete(permId);
      else next.add(permId);
      return { ...prev, grants: { ...prev.grants, [roleId]: next } };
    });
    setDirty((prev) => new Set(prev).add(roleId));
  }

  function toggleCategory(roleId: string, perms: Permission[], enable: boolean) {
    setState((prev) => {
      const next = new Set(prev.grants[roleId] ?? []);
      perms.forEach((p) => (enable ? next.add(p.id) : next.delete(p.id)));
      return { ...prev, grants: { ...prev.grants, [roleId]: next } };
    });
    setDirty((prev) => new Set(prev).add(roleId));
  }

  async function save() {
    const editableDirty = [...dirty].filter((roleId) => {
      const role = state.roles.find((r) => r.id === roleId);
      return role && !isSuperAdmin(role);
    });
    if (editableDirty.length === 0) {
      toast("No changes to save");
      return;
    }

    setSaving(true);
    try {
      await Promise.all(
        editableDirty.map((roleId) =>
          roleService.updateRolePermissions(roleId, Array.from(state.grants[roleId] ?? []))
        )
      );
      toast.success("Permission matrix saved");
      setDirty(new Set());
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to save some roles");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-500">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-full mx-auto px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-gray-900">
            <ShieldCheck className="h-6 w-6 text-indigo-600" /> Permission Matrix
          </h2>
          <p className="text-gray-500 mt-1">
            View and manage what each role can do. The <strong>super_admin</strong> role always has full access.
          </p>
        </div>
        <button
          onClick={save}
          disabled={saving || dirty.size === 0}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save changes{dirty.size > 0 ? ` (${dirty.size})` : ""}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200/70 shadow-sm overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="sticky left-0 z-10 bg-gray-50 px-4 py-3 text-left font-semibold text-gray-600 min-w-[260px]">
                Permission
              </th>
              {state.roles.map((role) => (
                <th key={role.id} className="px-3 py-3 text-center font-semibold text-gray-700 whitespace-nowrap">
                  <div>{role.name}</div>
                  <div className="text-[10px] font-normal text-gray-400">
                    {isSuperAdmin(role) ? "all access" : `${(state.grants[role.id]?.size ?? 0)} perms`}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => {
              const perms = state.groups[category] ?? [];
              return (
                <Fragment key={category}>
                  <tr className="bg-slate-50/70 border-b border-gray-100">
                    <td className="sticky left-0 z-10 bg-slate-50/70 px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                      {category}
                    </td>
                    {state.roles.map((role) => {
                      const allOn =
                        isSuperAdmin(role) ||
                        perms.every((p) => state.grants[role.id]?.has(p.id));
                      return (
                        <td key={role.id} className="px-3 py-2 text-center">
                          <button
                            disabled={isSuperAdmin(role)}
                            onClick={() => toggleCategory(role.id, perms, !allOn)}
                            className="text-[10px] font-semibold text-indigo-500 hover:text-indigo-700 disabled:text-gray-300"
                          >
                            {allOn ? "none" : "all"}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                  {perms.map((perm) => (
                    <tr key={perm.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="sticky left-0 z-10 bg-white px-4 py-2 hover:bg-gray-50">
                        <div className="font-medium text-gray-800">{perm.name}</div>
                        {perm.description && (
                          <div className="text-xs text-gray-400">{perm.description}</div>
                        )}
                      </td>
                      {state.roles.map((role) => {
                        const checked =
                          isSuperAdmin(role) || (state.grants[role.id]?.has(perm.id) ?? false);
                        return (
                          <td key={role.id} className="px-3 py-2 text-center">
                            <input
                              type="checkbox"
                              className="h-4 w-4 accent-indigo-600 disabled:opacity-40"
                              checked={checked}
                              disabled={isSuperAdmin(role)}
                              onChange={() => toggle(role.id, perm.id)}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
