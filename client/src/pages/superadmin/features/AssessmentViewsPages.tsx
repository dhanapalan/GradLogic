import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ClipboardList, Loader2, Plus, Search } from "lucide-react";
import api from "../../../lib/api";
import { EmptyState, PageHeader } from "./FeatureUi";

interface Drive {
  id: string;
  name: string;
  rule_name?: string;
  status: string;
  drive_type?: string;
  scheduled_start?: string | null;
  total_students?: number;
}

function DriveFilterPage({
  title,
  description,
  icon: Icon,
  driveType,
  emptyMessage,
}: {
  title: string;
  description: string;
  icon: typeof ClipboardList;
  driveType: string;
  emptyMessage: string;
}) {
  const [search, setSearch] = useState("");
  const { data: drives = [], isLoading } = useQuery<Drive[]>({
    queryKey: ["drives", driveType],
    queryFn: async () => {
      const res = await api.get(`/drives?drive_type=${driveType}`);
      return res.data.data || [];
    },
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return drives.filter((d) => !q || d.name.toLowerCase().includes(q) || (d.rule_name || "").toLowerCase().includes(q));
  }, [drives, search]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
      <PageHeader
        icon={Icon}
        title={title}
        description={description}
        action={
          <Link
            to={`/app/superadmin/drives/new?drive_type=${driveType}`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-navy-900 px-3 py-2 text-sm font-medium text-white"
          >
            <Plus className="w-4 h-4" /> Create
          </Link>
        }
      />

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search…"
          className="w-full rounded-lg border border-gray-200 pl-9 pr-3 py-2 text-sm"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-300" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState message={emptyMessage} ctaHref={`/app/superadmin/drives/new?drive_type=${driveType}`} ctaLabel="Create one" />
      ) : (
        <div className="space-y-2">
          {filtered.map((d) => (
            <Link
              key={d.id}
              to={`/app/superadmin/drives/${d.id}`}
              className="block rounded-xl border border-gray-200/70 bg-white p-4 shadow-admin-card hover:border-gray-300"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-medium text-gray-900">{d.name}</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    {d.rule_name || "No rule"} · {d.status}
                    {d.total_students != null ? ` · ${d.total_students} students` : ""}
                  </p>
                </div>
                <span className="text-[11px] uppercase text-gray-400">{d.drive_type || driveType}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function PracticeTestsPage() {
  return (
    <DriveFilterPage
      title="Practice Sets"
      description="Practice assessments for skill building (practice_test drives)."
      icon={ClipboardList}
      driveType="practice_test"
      emptyMessage="No practice sets yet."
    />
  );
}
