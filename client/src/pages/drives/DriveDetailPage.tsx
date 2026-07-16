import { useEffect, useState } from "react";
import { useParams, Link, useNavigate, useLocation, useSearchParams } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
    ArrowLeft,
    RocketIcon,
    Users,
    BarChart3,
    Eye,
    Activity,
    CheckCircle,
    Clock,
    XCircle,
    Play,
    Send,
    Loader2,
    Target,
    Database,
    Award,
    UserPlus,
    ShieldCheck,
    Radio,
} from "lucide-react";
import api from "../../lib/api";
import toast from "react-hot-toast";
import PoolReviewTab from "./PoolReviewTab";
import StudentsTab from "./StudentsTab";
import OverviewTab from "./OverviewTab";

// ── Types ────────────────────────────────────────────────────────────────────

type Tab = "overview" | "assignment" | "pool" | "students" | "monitoring" | "results";

const TABS: { key: Tab; label: string; icon: typeof Eye }[] = [
    { key: "overview", label: "Overview", icon: Eye },
    { key: "assignment", label: "Assignment", icon: Target },
    { key: "pool", label: "Preview", icon: Database },
    { key: "students", label: "Students", icon: Users },
    { key: "monitoring", label: "Monitoring", icon: Activity },
    { key: "results", label: "Results", icon: Award },
];

const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
    draft: { label: "Draft", color: "bg-slate-100 text-slate-600", icon: Clock },
    generating: { label: "Generating", color: "bg-blue-100 text-blue-700", icon: Loader2 },
    generating_pool: { label: "Generating Pool", color: "bg-blue-100 text-blue-700", icon: Loader2 },
    pool_ready: { label: "Pool Ready", color: "bg-violet-100 text-violet-700", icon: Database },
    pending_approval: { label: "Pending Approval", color: "bg-amber-100 text-amber-700", icon: Clock },
    approved: { label: "Approved", color: "bg-teal-100 text-teal-700", icon: CheckCircle },
    pool_approved: { label: "Pool Approved", color: "bg-teal-100 text-teal-700", icon: CheckCircle },
    scheduled: { label: "Scheduled", color: "bg-indigo-100 text-indigo-700", icon: Clock },
    ready: { label: "Ready", color: "bg-cyan-100 text-cyan-700", icon: ShieldCheck },
    live: { label: "Live", color: "bg-emerald-100 text-emerald-700", icon: Radio },
    active: { label: "Active", color: "bg-emerald-100 text-emerald-700", icon: Play },
    completed: { label: "Completed", color: "bg-amber-100 text-amber-700", icon: CheckCircle },
    published: { label: "Published", color: "bg-green-100 text-green-700", icon: Send },
    cancelled: { label: "Cancelled", color: "bg-red-100 text-red-700", icon: XCircle },
};

// ── Component ────────────────────────────────────────────────────────────────

export default function DriveDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams, setSearchParams] = useSearchParams();
    const BASE = location.pathname.startsWith("/app/superadmin") ? "/app/superadmin/drives" : "/app/drives";
    const tabParam = searchParams.get("tab");
    const initialTab: Tab =
        tabParam && TABS.some((t) => t.key === tabParam) ? (tabParam as Tab) : "overview";
    const [activeTab, setActiveTab] = useState<Tab>(initialTab);
    const queryClient = useQueryClient();

    useEffect(() => {
        if (tabParam && TABS.some((t) => t.key === tabParam) && tabParam !== activeTab) {
            setActiveTab(tabParam as Tab);
        }
    }, [tabParam]);

    const selectTab = (tab: Tab) => {
        setActiveTab(tab);
        const next = new URLSearchParams(searchParams);
        if (tab === "overview") next.delete("tab");
        else next.set("tab", tab);
        setSearchParams(next, { replace: true });
    };

    const { data: drive, isLoading } = useQuery({
        queryKey: ["drive", id],
        queryFn: async () => {
            const res = await api.get(`/drives/${id}`);
            return res.data.data;
        },
        enabled: !!id,
    });

    const { data: assignments = [] } = useQuery({
        queryKey: ["drive-assignments", id],
        queryFn: async () => {
            const res = await api.get(`/drives/${id}/assignments`);
            return res.data.data || [];
        },
        enabled: !!id && activeTab === "assignment",
    });

    const handlePublish = async () => {
        try {
            await api.post(`/drives/${id}/publish`);
            toast.success("Drive published successfully");
            queryClient.invalidateQueries({ queryKey: ["drive", id] });
        } catch {
            toast.error("Publish failed");
        }
    };

    const handleMarkReady = async () => {
        try {
            await api.post(`/drives/${id}/ready`);
            toast.success("Drive is now READY");
            queryClient.invalidateQueries({ queryKey: ["drive", id] });
        } catch (err: any) {
            toast.error(err.response?.data?.error || "Failed to mark drive as ready");
        }
    };

    const handleScheduleDrive = async () => {
        try {
            await api.put(`/drives/${id}`, { status: 'scheduled' });
            toast.success("Drive scheduled successfully");
            queryClient.invalidateQueries({ queryKey: ["drive", id] });
        } catch {
            toast.error("Schedule failed");
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
            </div>
        );
    }

    if (!drive) {
        return (
            <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
                <p className="text-slate-400">Drive not found</p>
            </div>
        );
    }

    const currentStatus = (drive.status || "draft").toLowerCase();
    const sc = statusConfig[currentStatus] || statusConfig.draft;
    const snapshot = drive.rule_snapshot || drive.version_snapshot || {};
    const isReadOnly = ["ready", "live", "active", "completed", "published", "cancelled"].includes(currentStatus);
    return (
        <div className="min-h-screen bg-[#F8FAFC] p-8">
            {/* Header */}
            <div className="mb-6">
                <Link to={BASE} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors mb-4">
                    <ArrowLeft className="h-4 w-4" /> Back to Drives
                </Link>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-2xl bg-indigo-100">
                            <RocketIcon className="h-6 w-6 text-indigo-600" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-slate-900">{drive.name}</h1>
                            <div className="flex items-center gap-3 mt-1">
                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${sc.color}`}>
                                    <sc.icon className="h-3 w-3" /> {sc.label}
                                </span>
                                {drive.rule_name && <span className="text-xs text-slate-400">Rule: {drive.rule_name}</span>}
                                {drive.rule_version_number && <span className="text-xs text-slate-400">v{drive.rule_version_number}</span>}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                        {(currentStatus === "pool_ready" || currentStatus === "pending_approval" || currentStatus === "draft") && drive.pool_id && (
                            <button
                                type="button"
                                onClick={() => selectTab("pool")}
                                className="flex items-center gap-2 px-5 py-3 rounded-xl bg-violet-500 text-sm font-bold text-white hover:bg-violet-600 transition-all shadow-lg shadow-violet-200"
                            >
                                <Eye className="h-4 w-4" /> Preview & Approve Pool
                            </button>
                        )}
                        {(currentStatus === "approved" || currentStatus === "pool_approved") && (
                            <button onClick={handleMarkReady} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-cyan-500 text-sm font-bold text-white hover:bg-cyan-600 transition-all shadow-lg shadow-cyan-200">
                                <ShieldCheck className="h-4 w-4" /> Mark Ready
                            </button>
                        )}
                        {currentStatus === "ready" && (
                            <button onClick={handleScheduleDrive} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-indigo-500 text-sm font-bold text-white hover:bg-indigo-600 transition-all shadow-lg shadow-indigo-200">
                                <Clock className="h-4 w-4" /> Schedule Drive
                            </button>
                        )}
                        {(currentStatus === "scheduled" || currentStatus === "ready") && (
                            <button onClick={handlePublish} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-500 text-sm font-bold text-white hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-200">
                                <Send className="h-4 w-4" /> Publish Drive
                            </button>
                        )}
                        {currentStatus === "completed" && (
                            <button onClick={() => toast("Publishing results coming soon!")} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-500 text-sm font-bold text-white hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-200">
                                <Send className="h-4 w-4" /> Publish Results
                            </button>
                        )}
                        {isReadOnly && (
                            <span className="px-4 py-2 rounded-xl bg-amber-50 text-amber-700 text-xs font-bold">🔒 Read-Only (Drive {currentStatus})</span>
                        )}
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-6 shadow-sm">
                <div className="flex items-center gap-1 overflow-x-auto">
                    {TABS.map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => selectTab(tab.key)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${activeTab === tab.key
                                ? "bg-indigo-500 text-white shadow-sm"
                                : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                                }`}
                        >
                            <tab.icon className="h-4 w-4" /> {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tab Content */}
            <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
                {activeTab === "overview" && <OverviewTab drive={drive} snapshot={snapshot} />}
                {activeTab === "assignment" && (
                    <AssignmentTab
                        assignments={assignments}
                        onAssignClick={() => navigate(`${BASE}/${id}/assign-campus`)}
                        isReadOnly={isReadOnly}
                    />
                )}
                {activeTab === "pool" && <PoolReviewTab drive={drive} snapshot={snapshot} />}
                {activeTab === "students" && <StudentsTab drive={drive} />}
                {activeTab === "monitoring" && <MonitoringTab />}
                {activeTab === "results" && id ? <ResultsTab driveId={id} /> : null}
            </div>

        </div>
    );
}

// ── Tab Components ───────────────────────────────────────────────────────────

function AssignmentTab({ assignments, onAssignClick, isReadOnly }: { assignments: any[], onAssignClick: () => void, isReadOnly: boolean }) {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-800">Campus Assignments</h2>
                {!isReadOnly && (
                    <button
                        onClick={onAssignClick}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-50 text-indigo-600 font-bold text-sm hover:bg-indigo-100 transition-colors border border-indigo-100"
                    >
                        <UserPlus className="h-4 w-4" /> Assign Campus
                    </button>
                )}
            </div>

            {assignments.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                    <Target className="h-10 w-10 mx-auto mb-3 text-slate-300" />
                    <p className="font-bold">No assignments yet</p>
                    <p className="text-sm mt-1">Assign campuses or segments to this drive</p>

                    {!isReadOnly && (
                        <button
                            onClick={onAssignClick}
                            className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition-colors shadow-sm"
                        >
                            <UserPlus className="h-4 w-4 text-slate-400" /> Add First Campus
                        </button>
                    )}
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-slate-100 bg-slate-50/80">
                                <th className="px-6 py-3 text-left text-xs font-bold uppercase text-slate-400">Campus</th>
                                <th className="px-6 py-3 text-left text-xs font-bold uppercase text-slate-400">Segment</th>
                                <th className="px-6 py-3 text-left text-xs font-bold uppercase text-slate-400">Assigned On</th>
                            </tr>
                        </thead>
                        <tbody>
                            {assignments.map((a: any) => (
                                <tr key={a.id} className="border-b border-slate-50">
                                    <td className="px-6 py-3 text-sm font-bold text-slate-700">{a.college_name || "—"}</td>
                                    <td className="px-6 py-3 text-sm text-slate-600">{a.segment || "All"}</td>
                                    <td className="px-6 py-3 text-xs text-slate-400">{new Date(a.created_at).toLocaleDateString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function MonitoringTab() {
    return (
        <div className="text-center py-16">
            <Activity className="h-12 w-12 mx-auto mb-3 text-slate-300" />
            <h2 className="text-lg font-bold text-slate-400">Live Monitoring</h2>
            <p className="text-sm text-slate-400 mt-2">Real-time proctoring statistics will appear here when the drive is active</p>
        </div>
    );
}

function ResultsTab({ driveId }: { driveId: string }) {
    return (
        <div className="text-center py-16 px-4">
            <BarChart3 className="h-12 w-12 mx-auto mb-3 text-slate-300" />
            <h2 className="text-lg font-bold text-slate-700">Results & Evaluation</h2>
            <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">
                Overall / section scores, accuracy, time, weak & strong topics, recommendations,
                next practice, and Learning Journey updates.
            </p>
            <Link
                to={`/app/superadmin/assessment-results?drive_id=${driveId}`}
                className="inline-flex items-center gap-1.5 mt-4 rounded-lg bg-navy-900 px-4 py-2.5 text-sm font-medium text-white"
            >
                Open evaluation hub
            </Link>
        </div>
    );
}
