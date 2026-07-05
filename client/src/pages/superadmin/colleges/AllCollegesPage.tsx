import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PlusIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import StatusBadge from "../../../components/superadmin/StatusBadge";
import collegeService, { College } from "../../../services/collegeService";

export default function AllCollegesPage() {
  const [colleges, setColleges] = useState<College[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "pending" | "suspended">("all");

  useEffect(() => {
    const load = async () => {
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
    };
    const debounce = setTimeout(load, 300);
    return () => clearTimeout(debounce);
  }, [search, statusFilter]);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">All Colleges</h2>
          <p className="text-gray-600 mt-1">Manage all registered colleges and their settings</p>
        </div>
        <a
          href="/app/superadmin/colleges/new"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          <PlusIcon className="w-5 h-5" />
          Add College
        </a>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search colleges..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Status Filter */}
          <div className="flex gap-2">
            {["all", "active", "pending", "suspended"].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status as any)}
                className={`
                  px-3 py-2 rounded-lg font-medium text-sm transition-colors
                  ${statusFilter === status
                    ? "bg-blue-100 text-blue-700"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }
                `}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Colleges Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">College</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Email</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">City</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Students</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              [1, 2, 3].map((i) => (
                <tr key={i} className="animate-pulse">
                  <td className="px-6 py-4" colSpan={6}>
                    <div className="h-4 bg-gray-200 rounded w-1/3" />
                  </td>
                </tr>
              ))
            ) : (
              colleges.map((college) => (
                <tr key={college.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{college.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{college.email || "—"}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{college.city || "—"}</td>
                  <td className="px-6 py-4 text-sm text-gray-900 font-medium">{college.student_count}</td>
                  <td className="px-6 py-4">
                    <StatusBadge status={college.status} size="sm" />
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <Link
                      to={`/app/superadmin/colleges/${college.id}`}
                      className="text-blue-600 hover:text-blue-700 font-medium"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!loading && colleges.length === 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-gray-600">No colleges found</p>
        </div>
      )}
    </div>
  );
}
