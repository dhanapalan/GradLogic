import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams, useLocation } from "react-router";
import {
    Plus,
    Search,
    RocketIcon,
    Eye,
    XCircle,
    CheckCircle,
    Clock,
    Play,
    Send,
    Loader2,
} from "lucide-react";
import api from "../../lib/api";
import toast from "react-hot-toast";

// ── Types ────────────────────────────────────────────────────────────────────

interface Drive {
    id: string;
    name: string;
    rule_id: string;
    rule_name: string;
    rule_version_number: number | null;
    status: string;
    scheduled_start: string | null;
    scheduled_end: string | null;
    total_students: number;
    auto_publish: boolean;
    created_at: string;
}

const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
    draft: { label: "Draft", color: "bg-slate-100 text-slate-600", icon: Clock },
    generating: { label: "Generating", color: "bg-blue-100 text-blue-700", icon: Loader2 },
    scheduled: { label: "Scheduled", color: "bg-indigo-100 text-indigo-700", icon: Clock },
    active: { label: "Active", color: "bg-emerald-100 text-emerald-700", icon: Play },
    completed: { label: "Completed", color: "bg-amber-100 text-amber-700", icon: CheckCircle },
    published: { label: "Published", color: "bg-green-100 text-green-700", icon: Send },
    cancelled: { label: "Cancelled", color: "bg-red-100 text-red-700", icon: XCircle },
};

// ── Component ────────────────────────────────────────────────────────────────

export default function DrivesDashboardPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const location = useLocation();
    // Same components render under /app/drives (DashboardLayout, hr/engineer/college_admin)
    // and /app/superadmin/drives (SuperAdminLayout) — keep internal links on whichever shell we're in.
    const BASE = location.pathname.startsWith("/app/superadmin") ? "/app/superadmin/drives" : "/app/drives";
    const isAssessmentHub = location.pathname.startsWith("/app/superadmin");
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");

    const fromRule = searchParams.get("from_rule");
    const fromCollection = searchParams.get("collection_id");

    const { data: drives = [], isLoading, refetch } = useQuery<Drive[]>({
        queryKey: ["drives", statusFilter, fromRule],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (statusFilter !== "all") params.set("status", statusFilter);
            if (fromRule) params.set("rule_id", fromRule);
            const res = await api.get(`/drives?${params.toString()}`);
            return res.data.data || [];
        },
    });

    const filtered = drives.filter((d: Drive) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return d.name.toLowerCase().includes(q) || (d.rule_name || "").toLowerCase().includes(q);
    });

    const handleCancel = async (id: string) => {
        try {
            await api.post(`/drives/${id}/cancel`);
            toast.success("Drive cancelled");
            refetch();
        } catch {
            toast.error("Cancel failed");
        }
    };

    const handleGenerate = async (id: string) => {
        try {
            await api.post(`/drives/${id}/generate`);
            toast.success("Drive generated and scheduled");
            refetch();
        } catch {
            toast.error("Generation failed");
        }
    };

    const fmt = (d: string | null) =>
        d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

    // Stats
    const activeCount = drives.filter((d: Drive) => d.status?.toLowerCase() === "active").length;
    const scheduledCount = drives.filter((d: Drive) => d.status?.toLowerCase() === "scheduled").length;
    const completedCount = drives.filter((d: Drive) => ["completed", "published"].includes(d.status?.toLowerCase() || "")).length;

    const newHref = (() => {
        const p = new URLSearchParams();
        if (fromRule) p.set("rule_id", fromRule);
        if (fromCollection) p.set("collection_id", fromCollection);
        const qs = p.toString();
        return qs ? `${BASE}/new?${qs}` : `${BASE}/new`;
    })();

    const WORKFLOW = [
        { name: "Assessment", live: true },
        { name: "Sections", live: true },
        { name: "Collections", live: true },
        { name: "Randomization", live: true },
        { name: "Rules", live: true },
        { name: "Preview", live: true },
        { name: "Publish", live: true },
    ];

    return (
        <div className={isAssessmentHub ? "min-h-full bg-slate-50/80" : "min-h-screen bg-[#F8FAFC] p-8"}>
            {isAssessmentHub ? (
                <div className="border-b border-gray-200/80 bg-white">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 pb-5">
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                            Assessment Hub · Centerpiece
                        </p>
                        <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 flex items-center gap-2">
                                    <RocketIcon className="h-6 w-6 text-navy-900" />
                                    Assessment Builder
                                </h1>
                                <p className="mt-1 text-sm text-gray-500 max-w-2xl">
                                    Build assessments from rules and Question Collections — then randomize, preview the pool, and publish.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => navigate(newHref)}
                                className="inline-flex items-center gap-2 rounded-lg bg-navy-900 px-4 py-2.5 text-sm font-medium text-white"
                            >
                                <Plus className="h-4 w-4" /> New assessment
                            </button>
                        </div>
                        <div className="mt-4 flex gap-1.5 overflow-x-auto pb-1">
                            {WORKFLOW.map((step, i) => (
                                <div key={step.name} className="flex items-center gap-1.5 shrink-0">
                                    <span
                                        className={`rounded-md border px-2 py-1.5 text-[11px] font-medium whitespace-nowrap ${
                                            step.live
                                                ? "bg-slate-50 border-gray-100 text-gray-700"
                                                : "bg-white border-dashed border-gray-200 text-gray-400"
                                        }`}
                                    >
                                        {step.name}
                                        {!step.live ? " (later)" : ""}
                                    </span>
                                    {i < WORKFLOW.length - 1 ? (
                                        <span className="text-gray-300 text-xs" aria-hidden>→</span>
                                    ) : null}
                                </div>
                            ))}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs">
                            <Link to="/app/superadmin/question-collections" className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-gray-600 hover:border-navy-900/30">
                                Question Collections
                            </Link>
                            <Link to="/app/superadmin/assessment-templates" className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-gray-600 hover:border-navy-900/30">
                                Assessment Templates
                            </Link>
                            <Link to="/app/assessment-rules" className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-gray-600 hover:border-navy-900/30">
                                Rules
                            </Link>
                            <Link to="/app/superadmin/practice-sets" className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-gray-600 hover:border-navy-900/30">
                                Practice
                            </Link>
                            <Link to="/app/superadmin/mock-tests" className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-gray-600 hover:border-navy-900/30">
                                Mock
                            </Link>
                            <Link to="/app/superadmin/coding-assessments" className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-gray-600 hover:border-navy-900/30">
                                Coding
                            </Link>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="mb-8 flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <RocketIcon className="h-8 w-8 text-indigo-500" />
                            <h1 className="text-3xl font-black text-slate-900">Assessment Drives</h1>
                        </div>
                        <p className="text-sm text-slate-500 ml-11">Manage execution instances of assessment rules</p>
                    </div>
                    <button
                        onClick={() => navigate(newHref)}
                        className="flex items-center gap-2 rounded-xl bg-indigo-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-200 hover:bg-indigo-600 transition-all"
                    >
                        <Plus className="h-4 w-4" /> New Drive
                    </button>
                </div>
            )}

            <div className={isAssessmentHub ? "max-w-7xl mx-auto px-4 sm:px-6 py-6" : ""}>
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
                {[
                    { label: "Total Drives", value: drives.length, icon: RocketIcon, color: "text-indigo-600 bg-indigo-50" },
                    { label: "Active", value: activeCount, icon: Play, color: "text-emerald-600 bg-emerald-50" },
                    { label: "Scheduled", value: scheduledCount, icon: Clock, color: "text-amber-600 bg-amber-50" },
                    { label: "Completed", value: completedCount, icon: CheckCircle, color: "text-blue-600 bg-blue-50" },
                ].map((s) => (
                    <div key={s.label} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className={`p-2.5 rounded-xl ${s.color}`}><s.icon className="h-5 w-5" /></div>
                            <div>
                                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{s.label}</p>
                                <p className="text-2xl font-black text-slate-900">{s.value}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-6 shadow-sm">
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex-1 min-w-[240px] relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search drives..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                        />
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        {["all", "draft", "scheduled", "active", "completed", "published", "cancelled"].map((s) => (
                            <button
                                key={s}
                                onClick={() => setStatusFilter(s)}
                                className={`px-3 py-2 rounded-xl text-xs font-bold capitalize transition-all ${statusFilter === s
                                    ? "bg-indigo-500 text-white shadow-sm"
                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                    }`}
                            >
                                {s === "all" ? "All" : s}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {isLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <RocketIcon className="h-12 w-12 text-slate-300 mb-3" />
                        <p className="text-lg font-bold text-slate-400">No drives found</p>
                        <p className="text-sm text-slate-400 mt-1">Create a drive from an assessment rule</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-slate-100 bg-slate-50/80">
                                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-widest text-slate-400">Drive Name</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-widest text-slate-400">Rule</th>
                                    <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-widest text-slate-400">Version</th>
                                    <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-widest text-slate-400">Status</th>
                                    <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-widest text-slate-400">Start</th>
                                    <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-widest text-slate-400">End</th>
                                    <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-widest text-slate-400">Students</th>
                                    <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-widest text-slate-400">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((drive: Drive) => {
                                    const currentStatus = (drive.status || "draft").toLowerCase();
                                    const sc = statusConfig[currentStatus] || statusConfig.draft;
                                    return (
                                        <tr key={drive.id} className="border-b border-slate-50 hover:bg-indigo-50/30 transition-colors">
                                            <td className="px-6 py-4">
                                                <Link to={`${BASE}/${drive.id}`} className="font-bold text-sm text-slate-900 hover:text-indigo-600 transition-colors">
                                                    {drive.name}
                                                </Link>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-600">{drive.rule_name || "—"}</td>
                                            <td className="px-6 py-4 text-center text-sm font-bold text-slate-700">
                                                {drive.rule_version_number ? `v${drive.rule_version_number}` : "—"}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${sc.color}`}>
                                                    <sc.icon className="h-3 w-3" /> {sc.label}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center text-xs text-slate-500">{fmt(drive.scheduled_start)}</td>
                                            <td className="px-6 py-4 text-center text-xs text-slate-500">{fmt(drive.scheduled_end)}</td>
                                            <td className="px-6 py-4 text-center text-sm font-bold text-slate-700">{drive.total_students}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Link to={`${BASE}/${drive.id}`} className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors" title="View">
                                                        <Eye className="h-4 w-4" />
                                                    </Link>
                                                    {currentStatus === "draft" && (
                                                        <button onClick={() => handleGenerate(drive.id)} className="p-2 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors" title="Generate">
                                                            <RocketIcon className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                    {["draft", "scheduled"].includes(currentStatus) && (
                                                        <button onClick={() => handleCancel(drive.id)} className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Cancel">
                                                            <XCircle className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            </div>
        </div>
    );
}
