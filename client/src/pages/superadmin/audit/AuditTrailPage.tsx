import { useState, useEffect } from "react";
import {
  ArrowDownTrayIcon,
} from "@heroicons/react/24/outline";
import toast from "react-hot-toast";
import auditService, { AuditLog, AuditFilters, AuditStats } from "../../../services/auditService";
import StatusBadge from "../../../components/superadmin/StatusBadge";

const ACTION_OPTIONS = [
  "all",
  "LOGIN",
  "LOGOUT",
  "CREATE_USER",
  "UPDATE_USER",
  "DELETE_USER",
  "SUSPEND_USER",
  "CREATE_ROLE",
  "UPDATE_ROLE",
  "DELETE_ROLE",
  "UPDATE_PERMISSIONS",
];

const RESOURCE_TYPE_OPTIONS = [
  "all",
  "USER",
  "ROLE",
  "PERMISSION",
  "COLLEGE",
  "CATEGORY",
];

const SEVERITY_OPTIONS = ["all", "LOW", "MEDIUM", "HIGH"];

function formatDate(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleDateString() + " " + date.toLocaleTimeString();
}

export default function AuditTrailPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [total, setTotal] = useState(0);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  // Filters
  const [actionFilter, setActionFilter] = useState("all");
  const [resourceFilter, setResourceFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  useEffect(() => {
    loadAuditLogs();
    loadStats();
  }, [page, limit, actionFilter, resourceFilter, severityFilter, fromDate, toDate]);

  const loadAuditLogs = async () => {
    setLoading(true);
    try {
      const filters: AuditFilters = {
        page,
        limit,
        action: actionFilter === "all" ? undefined : actionFilter,
        resource_type: resourceFilter === "all" ? undefined : resourceFilter,
        severity: severityFilter === "all" ? undefined : severityFilter,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
      };

      const response = await auditService.listAuditTrail(filters);
      setLogs(response.data);
      setTotal(response.pagination.total);
    } catch (error) {
      toast.error("Failed to load audit logs");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const data = await auditService.getAuditStats(30);
      setStats(data);
    } catch (error) {
      console.error("Failed to load audit stats:", error);
    }
  };

  const handleExport = async (format: "csv" | "json") => {
    setExporting(true);
    try {
      await auditService.exportAuditLogs({
        format,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
        action: actionFilter === "all" ? undefined : actionFilter,
      });
      toast.success(`Audit logs exported as ${format.toUpperCase()}`);
    } catch (error) {
      toast.error("Failed to export audit logs");
      console.error(error);
    } finally {
      setExporting(false);
    }
  };

  const pages = Math.ceil(total / limit);

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h2 className="text-2xl font-semibold tracking-tight text-gray-900">Audit Trail</h2>
        <p className="text-gray-600 mt-1">
          Platform activity log ({total} total events)
        </p>
      </div>

      {/* Statistics */}
      {stats && (
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-4">
            <p className="text-sm text-gray-600">Total Actions (30d)</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {stats.total_actions}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-4">
            <p className="text-sm text-gray-600">Unique Users</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {stats.by_user?.length || 0}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-4">
            <p className="text-sm text-gray-600">Resource Types</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {stats.by_resource_type?.length || 0}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-4">
            <p className="text-sm text-gray-600">Action Types</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {stats.by_action?.length || 0}
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-4 mb-6">
        <div className="grid grid-cols-5 gap-4 mb-4">
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-admin-accent"
          >
            {ACTION_OPTIONS.map((action) => (
              <option key={action} value={action}>
                {action === "all" ? "All Actions" : action}
              </option>
            ))}
          </select>

          <select
            value={resourceFilter}
            onChange={(e) => {
              setResourceFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-admin-accent"
          >
            {RESOURCE_TYPE_OPTIONS.map((type) => (
              <option key={type} value={type}>
                {type === "all" ? "All Resources" : type}
              </option>
            ))}
          </select>

          <select
            value={severityFilter}
            onChange={(e) => {
              setSeverityFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-admin-accent"
          >
            {SEVERITY_OPTIONS.map((sev) => (
              <option key={sev} value={sev}>
                {sev === "all" ? "All Severity" : sev}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={fromDate}
            onChange={(e) => {
              setFromDate(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-admin-accent"
          />

          <input
            type="date"
            value={toDate}
            onChange={(e) => {
              setToDate(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-admin-accent"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => handleExport("csv")}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <ArrowDownTrayIcon className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={() => handleExport("json")}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <ArrowDownTrayIcon className="w-4 h-4" />
            Export JSON
          </button>
        </div>
      </div>

      {/* Timeline View */}
      <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-600">Loading audit logs...</div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-gray-600">No audit logs found</div>
        ) : (
          <div className="space-y-1 divide-y divide-gray-100">
            {logs.map((log) => (
              <div key={log.id} className="p-4 hover:bg-gray-50 cursor-pointer transition">
                <button
                  onClick={() => {
                    setSelectedLog(log);
                    setShowDetails(true);
                  }}
                  className="w-full text-left"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="font-semibold text-gray-900">
                            {log.action}
                          </p>
                          <p className="text-sm text-gray-600 mt-1">
                            {log.user_name} ({log.user_email})
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <StatusBadge
                          status={log.severity.toLowerCase()}
                          label={log.severity}
                          size="xs"
                        />
                        <span className="text-sm text-gray-500">
                          {log.resource_type}
                        </span>
                        {log.resource_id && (
                          <span className="text-sm text-gray-500">
                            • ID: {log.resource_id}
                          </span>
                        )}
                        <span className="text-sm text-gray-500">
                          • IP: {log.ip_address}
                        </span>
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <p className="text-sm text-gray-500">
                        {formatDate(log.created_at)}
                      </p>
                    </div>
                  </div>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Page {page} of {pages}
          </div>
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

      {/* Details Modal */}
      {showDetails && selectedLog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-900">Audit Log Details</h3>
              <button
                onClick={() => {
                  setShowDetails(false);
                  setSelectedLog(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-gray-600">Action</p>
                  <p className="text-lg font-semibold text-gray-900 mt-1">
                    {selectedLog.action}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Severity</p>
                  <div className="mt-1">
                    <StatusBadge
                      status={selectedLog.severity.toLowerCase()}
                      label={selectedLog.severity}
                      size="sm"
                    />
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-600">User</p>
                  <p className="text-lg font-semibold text-gray-900 mt-1">
                    {selectedLog.user_name} ({selectedLog.user_email})
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Resource Type</p>
                  <p className="text-lg font-semibold text-gray-900 mt-1">
                    {selectedLog.resource_type}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Resource ID</p>
                  <p className="text-lg font-semibold text-gray-900 mt-1">
                    {selectedLog.resource_id || "-"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">IP Address</p>
                  <p className="text-lg font-semibold text-gray-900 mt-1">
                    {selectedLog.ip_address}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-gray-600">Timestamp</p>
                  <p className="text-lg font-semibold text-gray-900 mt-1">
                    {formatDate(selectedLog.created_at)}
                  </p>
                </div>
              </div>

              {selectedLog.changes && (
                <div>
                  <p className="text-sm font-semibold text-gray-900 mb-2">Changes</p>
                  <pre className="bg-gray-50 border border-gray-200 rounded p-4 text-xs text-gray-700 overflow-x-auto">
                    {JSON.stringify(selectedLog.changes, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="mt-8 pt-6 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowDetails(false);
                  setSelectedLog(null);
                }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
