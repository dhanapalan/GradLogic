// =============================================================================
// Company Management (superadmin) — oversight of recruiting company accounts.
// Reuses PUT /api/users/:id/status (existing user-status endpoint) for
// activate/suspend; the list itself is new (GET /api/users/companies),
// since company.routes.ts only ever exposed self-service endpoints.
// =============================================================================

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, Globe, MapPin, Users, Briefcase, ShieldOff, ShieldCheck } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../../lib/api";

interface CompanyRow {
  id: string;
  email: string;
  contact_name: string;
  is_active: boolean;
  status: string;
  created_at: string;
  company_id: string | null;
  company_name: string | null;
  industry: string | null;
  website: string | null;
  headquarters: string | null;
  drives_created: number;
  candidates_reached: number;
}

export default function CompanyManagementPage() {
  const qc = useQueryClient();

  const { data: companies, isLoading } = useQuery({
    queryKey: ["superadmin-companies"],
    queryFn: async () => (await api.get("/users/companies")).data.data as CompanyRow[],
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) =>
      api.put(`/users/${id}/status`, { status: active ? "Active" : "Inactive" }),
    onSuccess: () => {
      toast.success("Company status updated");
      qc.invalidateQueries({ queryKey: ["superadmin-companies"] });
    },
    onError: () => toast.error("Failed to update status"),
  });

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-navy-900/[0.06] rounded-lg">
          <Building2 className="w-5 h-5 text-navy-900" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Company Management</h1>
          <p className="text-sm text-gray-500">Recruiting companies registered on the platform.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card overflow-hidden">
        {isLoading ? (
          <p className="p-6 text-sm text-gray-400">Loading…</p>
        ) : !companies || companies.length === 0 ? (
          <p className="p-8 text-center text-sm text-gray-400">No companies registered yet.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {companies.map((c) => (
              <div key={c.id} className="p-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900">{c.company_name || c.contact_name}</p>
                    {c.industry && (
                      <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-navy-900/[0.06] text-navy-900">{c.industry}</span>
                    )}
                    <span
                      className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium ${
                        c.is_active ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                      }`}
                    >
                      {c.is_active ? "Active" : "Suspended"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">{c.email}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                    {c.headquarters && (
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {c.headquarters}</span>
                    )}
                    {c.website && (
                      <a href={c.website} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-indigo-600 hover:underline">
                        <Globe className="w-3 h-3" /> Website
                      </a>
                    )}
                    <span className="flex items-center gap-1"><Briefcase className="w-3 h-3" /> {c.drives_created} drives</span>
                    <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {c.candidates_reached} candidates</span>
                  </div>
                </div>
                <button
                  onClick={() => toggleStatus.mutate({ id: c.id, active: !c.is_active })}
                  disabled={toggleStatus.isPending}
                  className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border disabled:opacity-50 ${
                    c.is_active
                      ? "border-red-200 text-red-700 bg-red-50 hover:bg-red-100"
                      : "border-green-200 text-green-700 bg-green-50 hover:bg-green-100"
                  }`}
                >
                  {c.is_active ? <ShieldOff className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                  {c.is_active ? "Suspend" : "Activate"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
