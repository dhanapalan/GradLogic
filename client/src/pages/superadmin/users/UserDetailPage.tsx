import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import toast from "react-hot-toast";
import userService, { User } from "../../../services/userService";
import StatusBadge from "../../../components/superadmin/StatusBadge";

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ full_name: "", email: "", phone: "" });

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    userService
      .getUser(id)
      .then((u) => {
        setUser(u);
        setForm({ full_name: u.full_name, email: u.email, phone: u.phone || "" });
      })
      .catch(() => {
        toast.error("User not found");
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const save = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const updated = await userService.updateUser(id, form);
      setUser(updated);
      toast.success("User updated");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to update user");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async () => {
    if (!id || !user) return;
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
        await userService.deactivateUser(id);
        setUser({ ...user, status: "inactive" });
        toast.success("User deactivated");
      } else {
        await userService.activateUser(id);
        setUser({ ...user, status: "active" });
        toast.success("User activated");
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Action failed");
    }
  };

  if (loading) {
    return <div className="p-8 text-gray-600">Loading user...</div>;
  }

  if (!user) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <Link to="/app/superadmin/users" className="text-sm text-admin-accent hover:underline">
          ← Back to users
        </Link>
        <p className="mt-4 text-gray-600">User not found.</p>
      </div>
    );
  }

  const isInactive = user.status === "inactive";

  return (
    <div className="p-8 max-w-2xl">
      <Link
        to="/app/superadmin/users"
        className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeftIcon className="w-4 h-4" />
        Back to All Users
      </Link>

      <div className="flex items-start justify-between mb-8">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-gray-900">{user.full_name}</h2>
          <p className="text-gray-600 mt-1 capitalize">{user.role.replace(/_/g, " ")}</p>
        </div>
        <StatusBadge status={user.status} label={user.status} />
      </div>

      <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
          <input
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-admin-accent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-admin-accent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-admin-accent"
          />
        </div>
        {user.college_name && (
          <p className="text-sm text-gray-600">
            College: <span className="font-medium">{user.college_name}</span>
          </p>
        )}
        <p className="text-sm text-gray-500">
          Joined {new Date(user.created_at).toLocaleDateString()}
          {user.last_login && ` · Last login ${new Date(user.last_login).toLocaleDateString()}`}
        </p>

        <div className="flex gap-3 pt-2">
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 bg-navy-900 text-white rounded-lg font-medium hover:bg-navy-800 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
          <button
            onClick={toggleActive}
            className={`px-4 py-2 rounded-lg font-medium border ${
              isInactive
                ? "border-green-300 text-green-700 hover:bg-green-50"
                : "border-red-300 text-red-700 hover:bg-red-50"
            }`}
          >
            {isInactive ? "Activate" : "Deactivate"}
          </button>
          <button
            onClick={() => navigate("/app/superadmin/users")}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
