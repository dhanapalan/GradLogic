import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
    Rocket,
    Search,
    ChevronRight,
    Download,
    CheckCircle2,
    Clock,
    PlayCircle,
    AlertCircle,
    Users,
} from "lucide-react";
import api from "../../lib/api";
import clsx from "clsx";

// ── Types ────────────────────────────────────────────────────────────────────

interface DriveKPIs {
    total: number;
    active: number;
    upcoming: number;
    completed: number;
}

interface DriveListItem {
    id: string;
    name: string;
    status: string;
    scheduled_start: string;
    scheduled_end: string;
    registered_students: number;
    appeared_students: number;
}

interface DrivesListResponse {
    kpis: DriveKPIs;
    drives: DriveListItem[];
}

// ── Constants ────────────────────────────────────────────────────────────────

const statusConfig: Record<string, { label: string; bg: string; text: string; icon: any }> = {
    ACTIVE: { label: "Active", bg: "bg-emerald-50", text: "text-emerald-700", icon: PlayCircle },
    SCHEDULED: { label: "Upcoming", bg: "bg-amber-50", text: "text-amber-700", icon: Clock },
    COMPLETED: { label: "Completed", bg: "bg-blue-50", text: "text-blue-700", icon: CheckCircle2 },
    CANCELLED: { label: "Cancelled", bg: "bg-slate-50", text: "text-slate-600", icon: AlertCircle },
    PUBLISHED: { label: "Published", bg: "bg-indigo-50", text: "text-indigo-700", icon: CheckCircle2 },
};

// ── Component ────────────────────────────────────────────────────────────────

export default function DrivesListPage() {
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");

    const { data, isLoading } = useQuery<DrivesListResponse>({
        queryKey: ["campus-drives"],
        queryFn: async () => {
            const res = await api.get("/campus/drives");
            return res.data.data;
        }
    });

    const filteredDrives = data?.drives.filter(drive => {
        const matchesSearch = drive.name.toLowerCase().includes(search.toLowerCase());
        const matchesStatus = statusFilter === "all" || (drive.status || "").toUpperCase() === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const exportToCSV = () => {
        if (!data?.drives) return;
        const headers = ["Drive Name", "Status", "Start Date", "Registered Students", "Appeared Students"];
        const rows = data.drives.map(d => [
            d.name,
            d.status,
            new Date(d.scheduled_start).toLocaleDateString(),
            d.registered_students,
            d.appeared_students
        ]);
        const csvContent = "data:text/csv;charset=utf-8,"
            + headers.join(",") + "\n"
            + rows.map(e => e.join(",")).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `campus_drives_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
            </div>
        );
    }

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Scheduled Tests</h1>
                    <p className="mt-1 text-slate-500 font-medium">View and manage practice, mock, and coding tests scheduled for your campus.</p>
                </div>
                <button
                    onClick={exportToCSV}
                    className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-700 font-bold text-sm rounded-xl shadow-sm hover:bg-slate-50 transition-all active:scale-95"
                >
                    <Download className="h-4 w-4" />
                    Export Drives (CSV)
                </button>
            </div>

            {/* KPI Summary Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[
                    { label: "Total Drives", value: data?.kpis.total || 0, icon: Rocket, color: "indigo" },
                    { label: "Active Drives", value: data?.kpis.active || 0, icon: PlayCircle, color: "emerald" },
                    { label: "Upcoming", value: data?.kpis.upcoming || 0, icon: Clock, color: "amber" },
                    { label: "Completed", value: data?.kpis.completed || 0, icon: CheckCircle2, color: "blue" },
                ].map((kpi) => (
                    <div key={kpi.label} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-4">
                            <div className={clsx(
                                "p-3 rounded-xl",
                                kpi.color === "indigo" && "bg-indigo-50 text-indigo-600",
                                kpi.color === "emerald" && "bg-emerald-50 text-emerald-600",
                                kpi.color === "amber" && "bg-amber-50 text-amber-600",
                                kpi.color === "blue" && "bg-blue-50 text-blue-600",
                            )}>
                                <kpi.icon className="h-6 w-6" />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{kpi.label}</p>
                                <p className="text-2xl font-black text-slate-900 leading-none mt-1">{kpi.value}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Filter Bar */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-4">
                <div className="relative flex-1 min-w-[300px]">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search drives by name..."
                        className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2">
                    {["all", "PUBLISHED", "ACTIVE", "SCHEDULED", "COMPLETED"].map((s) => (
                        <button
                            key={s}
                            onClick={() => setStatusFilter(s)}
                            className={clsx(
                                "px-4 py-2.5 rounded-xl text-xs font-bold transition-all",
                                statusFilter === s
                                    ? "bg-indigo-500 text-white shadow-md shadow-indigo-100"
                                    : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                            )}
                        >
                            {s === "all" ? "All Status" : statusConfig[s]?.label || s}
                        </button>
                    ))}
                </div>
            </div>

            {/* Drives Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Drive Details</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">Status</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">Schedule</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">Participation</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredDrives?.map((drive) => {
                                const statusUpper = (drive.status || "").toUpperCase();
                                const sc = statusConfig[statusUpper] || { label: drive.status, bg: "bg-slate-50", text: "text-slate-600", icon: Clock };
                                return (
                                    <tr key={drive.id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2.5 rounded-lg bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100 transition-colors">
                                                    <Rocket className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-900">{drive.name}</p>
                                                    <p className="text-xs text-slate-400 font-medium">ID: {drive.id.slice(0, 8)}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex justify-center">
                                                <span className={clsx(
                                                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold",
                                                    sc.bg,
                                                    sc.text
                                                )}>
                                                    <sc.icon className="h-3.5 w-3.5" />
                                                    {sc.label}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-center">
                                            <div className="flex flex-col items-center">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <div className="flex flex-col items-end">
                                                        <p className="text-[11px] font-bold text-slate-700">{new Date(drive.scheduled_start).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</p>
                                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">
                                                            {new Date(drive.scheduled_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </p>
                                                    </div>
                                                    <span className="text-slate-300 text-xs">→</span>
                                                    <div className="flex flex-col items-start text-left">
                                                        <p className="text-[11px] font-bold text-slate-700">
                                                            {drive.scheduled_end ? new Date(drive.scheduled_end).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : "Unlimited"}
                                                        </p>
                                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">
                                                            {drive.scheduled_end ? new Date(drive.scheduled_end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—"}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex flex-col items-center">
                                                <div className="flex items-center gap-2">
                                                    <Users className="h-3.5 w-3.5 text-slate-300" />
                                                    <span className="text-sm font-bold text-slate-700">{drive.appeared_students}/{drive.registered_students}</span>
                                                </div>
                                                <div className="w-24 h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden">
                                                    <div
                                                        className="h-full bg-indigo-500 rounded-full"
                                                        style={{ width: `${(drive.appeared_students / drive.registered_students) * 100 || 0}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            <Link
                                                to={`/app/college-portal/drives/${drive.id}`}
                                                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-all border border-indigo-100 hover:border-indigo-200"
                                            >
                                                View Details
                                                <ChevronRight className="h-3.5 w-3.5" />
                                            </Link>
                                        </td>
                                    </tr>
                                );
                            })}

                            {!isLoading && filteredDrives?.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center">
                                        <div className="flex flex-col items-center">
                                            <AlertCircle className="h-12 w-12 text-slate-200 mb-3" />
                                            <p className="text-slate-400 font-bold">No drives found matching your filters.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
