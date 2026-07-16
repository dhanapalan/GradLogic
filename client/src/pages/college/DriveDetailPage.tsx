import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    ArrowLeft,
    Rocket,
    Users,
    ClipboardCheck,
    BarChart3,
    ShieldAlert,
    Briefcase,
    LayoutDashboard,
    Clock,
    PlayCircle,
    CheckCircle2,
    Search,
    ChevronDown,
    Save,
    UserPlus,
    Target,
    Eye
} from "lucide-react";
import api from "../../lib/api";
import clsx from "clsx";
import toast from "react-hot-toast";

// ── Types ────────────────────────────────────────────────────────────────────

type Tab = "Overview" | "Students" | "Attendance" | "Results" | "Integrity" | "Placement";

const TABS: { id: Tab; icon: any }[] = [
    { id: "Overview", icon: LayoutDashboard },
    { id: "Students", icon: Users },
    { id: "Attendance", icon: ClipboardCheck },
    { id: "Results", icon: BarChart3 },
    { id: "Integrity", icon: ShieldAlert },
    { id: "Placement", icon: Briefcase },
];

const statusConfig: Record<string, { label: string; bg: string; text: string; icon: any }> = {
    ACTIVE: { label: "Active", bg: "bg-emerald-50", text: "text-emerald-700", icon: PlayCircle },
    SCHEDULED: { label: "Upcoming", bg: "bg-amber-50", text: "text-amber-700", icon: Clock },
    COMPLETED: { label: "Completed", bg: "bg-blue-50", text: "text-blue-700", icon: CheckCircle2 },
};

// ── Component ────────────────────────────────────────────────────────────────

export default function DriveDetailPage() {
    const { id } = useParams();
    const [activeTab, setActiveTab] = useState<Tab>("Overview");

    const { data: drive, isLoading } = useQuery({
        queryKey: ["campus-drive", id],
        queryFn: async () => {
            const res = await api.get(`/campus/drives/${id}`);
            return res.data.data;
        }
    });

    if (isLoading) return <div className="p-8">Loading...</div>;
    if (!drive) return <div className="p-8 text-center text-slate-500 font-bold">Drive not found.</div>;

    const sc = statusConfig[drive.status] || { label: drive.status, bg: "bg-slate-50", text: "text-slate-600", icon: Clock };

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-6">
            {/* Breadcrumb & Navigation */}
            <div className="flex items-center gap-2 mb-2">
                <Link to="/app/college-portal/drives" className="text-slate-400 hover:text-indigo-600 transition-colors">
                    <ArrowLeft className="h-5 w-5" />
                </Link>
                <span className="text-sm font-bold text-slate-300">/</span>
                <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Drives</span>
                <span className="text-sm font-bold text-slate-300">/</span>
                <span className="text-sm font-bold text-indigo-500 uppercase tracking-widest">{drive.name}</span>
            </div>

            {/* Drive Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-5">
                    <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-sm text-indigo-600">
                        <Rocket className="h-8 w-8" />
                    </div>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-black text-slate-900 tracking-tight">{drive.name}</h1>
                            <span className={clsx(
                                "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold",
                                sc.bg,
                                sc.text
                            )}>
                                <sc.icon className="h-3 w-3" />
                                {sc.label}
                            </span>
                        </div>
                        <p className="text-slate-500 font-medium mt-0.5">Assigned Rule: <span className="text-indigo-600 font-bold underline underline-offset-4">{drive.rule_name || "N/A"}</span></p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        className="px-5 py-2.5 bg-indigo-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-100 hover:bg-indigo-600 transition-all active:scale-95"
                        onClick={() => toast.success("Feature coming soon!")}
                    >
                        Sync Data
                    </button>
                    <button
                        className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 font-bold text-sm rounded-xl shadow-sm hover:bg-slate-50 transition-all active:scale-95 flex items-center gap-2"
                        onClick={() => window.print()}
                    >
                        Export Report
                    </button>
                </div>
            </div>

            {/* Tabbed Navigation */}
            <div className="flex items-center gap-1 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm overflow-x-auto no-scrollbar">
                {TABS.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={clsx(
                            "flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-xs font-bold transition-all",
                            activeTab === tab.id
                                ? "bg-indigo-500 text-white shadow-lg shadow-indigo-100"
                                : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                        )}
                    >
                        <tab.icon className={clsx("h-4 w-4", activeTab === tab.id ? "text-white" : "text-slate-400")} />
                        {tab.id}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden min-h-[500px]">
                {activeTab === "Overview" && <OverviewTab drive={drive} />}
                {activeTab === "Students" && <StudentsTab driveId={id!} />}
                {activeTab === "Attendance" && <AttendanceTab driveId={id!} />}
                {activeTab === "Results" && <ResultsTab driveId={id!} />}
                {activeTab === "Integrity" && <IntegrityTab driveId={id!} />}
                {activeTab === "Placement" && <PlacementTab driveId={id!} />}
            </div>
        </div>
    );
}

// ── Tab Components ───────────────────────────────────────────────────────────

function OverviewTab({ drive }: { drive: any }) {
    return (
        <div className="p-8 space-y-8 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                    { label: "Registered Students", value: drive.total_students, icon: Users, color: "blue" },
                    { label: "Active Window", value: drive.scheduled_start ? `${new Date(drive.scheduled_start).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${new Date(drive.scheduled_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} → ${drive.scheduled_end ? new Date(drive.scheduled_end).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' + new Date(drive.scheduled_end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Unlimited"}` : "Not Set", icon: Clock, color: "amber" },
                    { label: "Participation", value: "85%", icon: Target, color: "emerald" }, // Dummy percentage for now
                ].map((stat) => (
                    <div key={stat.label} className="bg-slate-50/50 border border-slate-100 rounded-2xl p-6">
                        <div className="flex items-center gap-4">
                            <div className={clsx(
                                "p-3 rounded-xl bg-white shadow-sm",
                                stat.color === "blue" && "text-blue-600",
                                stat.color === "amber" && "text-amber-600",
                                stat.color === "emerald" && "text-emerald-600",
                            )}>
                                <stat.icon className="h-6 w-6" />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
                                <p className="text-2xl font-black text-slate-900 mt-1">{stat.value}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                    <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                        <div className="w-1.5 h-6 bg-indigo-500 rounded-full" />
                        Drive Configuration
                    </h3>
                    <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                        <dl className="divide-y divide-slate-50">
                            {[
                                { k: "Duration", v: "90 Minutes" },
                                { k: "Questions", v: "45 Items" },
                                { k: "Max Attempts", v: "1 Attempt" },
                                { k: "Proctoring", v: "AI Monitoring Enabled" },
                                { k: "Auto Publish", v: "Yes" },
                            ].map((item, i) => (
                                <div key={i} className="flex px-6 py-4 text-sm">
                                    <dt className="w-1/3 font-bold text-slate-400 uppercase text-[10px] tracking-widest flex items-center">{item.k}</dt>
                                    <dd className="flex-1 font-bold text-slate-700">{item.v}</dd>
                                </div>
                            ))}
                        </dl>
                    </div>
                </div>

                <div className="space-y-4">
                    <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                        <div className="w-1.5 h-6 bg-emerald-500 rounded-full" />
                        Quick Stats
                    </h3>
                    <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm space-y-6">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs font-bold">
                                <span className="text-slate-500">Student Turnout</span>
                                <span className="text-emerald-600">85 / 100</span>
                            </div>
                            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 rounded-full transition-all duration-1000 w-[85%]" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs font-bold">
                                <span className="text-slate-500">Completion Rate</span>
                                <span className="text-blue-600">92%</span>
                            </div>
                            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500 rounded-full transition-all duration-1000 w-[92%]" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function StudentsTab({ driveId }: { driveId: string }) {
    const { data: students = [], isLoading } = useQuery<any[]>({
        queryKey: ["campus-drive-students", driveId],
        queryFn: async () => {
            const res = await api.get(`/campus/drives/${driveId}/students`);
            return res.data.data;
        }
    });

    if (isLoading) return <div className="p-8">Loading Students...</div>;

    return (
        <div className="p-0 animate-in slide-in-from-bottom-4 duration-500">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
                <div className="relative w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search students..."
                        className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                </div>
                <button className="flex items-center gap-2 px-4 py-2 text-indigo-600 bg-indigo-50 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-all">
                    <UserPlus className="h-4 w-4" />
                    Add Individual Student
                </button>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="bg-white border-b border-slate-100">
                            <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-left">Student</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-left">Department</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">Drive Status</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">Latest Score</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {students.map((s) => (
                            <tr key={s.user_id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-400 text-sm">
                                            {s.name[0]}
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-900 text-sm">{s.name}</p>
                                            <p className="text-xs text-slate-400 font-medium">{s.roll_number}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">{s.department}</span>
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <span className={clsx(
                                        "px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                                        s.drive_status === "COMPLETED" ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"
                                    )}>
                                        {s.drive_status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-center font-black text-slate-700">{s.score ?? "-"}</td>
                                <td className="px-6 py-4 text-right">
                                    <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all" aria-label="View details">
                                        <Eye className="h-4 w-4" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function AttendanceTab({ driveId }: { driveId: string }) {
    const { data: attendance, isLoading } = useQuery<any>({
        queryKey: ["campus-drive-attendance", driveId],
        queryFn: async () => {
            const res = await api.get(`/campus/drives/${driveId}/attendance`);
            return res.data.data;
        }
    });

    if (isLoading) return <div className="p-8">Loading Attendance...</div>;

    return (
        <div className="p-8 space-y-8 animate-in fade-in duration-500">
            <div className="flex items-center gap-8">
                <div className="relative h-32 w-32">
                    <svg className="h-full w-full" viewBox="0 0 36 36">
                        <path className="text-slate-100" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                        <path className="text-emerald-500" strokeWidth="3" strokeDasharray={`${attendance?.attendance_percentage || 0}, 100`} strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-2xl font-black text-slate-900">{attendance?.attendance_percentage}%</span>
                    </div>
                </div>
                <div className="flex-1 grid grid-cols-2 gap-4">
                    <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                        <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Appeared</p>
                        <p className="text-2xl font-black text-emerald-700">{attendance?.appeared}</p>
                    </div>
                    <div className="bg-red-50 p-4 rounded-2xl border border-red-100">
                        <p className="text-[10px] font-black text-red-600 uppercase tracking-widest">Absent</p>
                        <p className="text-2xl font-black text-red-700">{attendance?.absent}</p>
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Real-time Activity Log</h4>
                <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="flex items-start gap-4 p-4 border border-slate-100 rounded-2xl bg-slate-50/50">
                            <div className="mt-1.5 h-2 w-2 rounded-full bg-emerald-500" />
                            <div className="flex-1">
                                <p className="text-xs font-bold text-slate-800">Student Roll #100{i} started the assessment</p>
                                <p className="text-[10px] font-medium text-slate-400 mt-0.5">2 minutes ago</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function ResultsTab({ driveId }: { driveId: string }) {
    const { data: results = [], isLoading } = useQuery<any[]>({
        queryKey: ["campus-drive-results", driveId],
        queryFn: async () => {
            const res = await api.get(`/campus/drives/${driveId}/results`);
            return res.data.data;
        }
    });

    if (isLoading) return <div className="p-8">Loading Results...</div>;

    return (
        <div className="p-0">
            <div className="p-8 border-b border-slate-100 bg-indigo-50/20">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-4">Score Distribution</h3>
                <div className="flex items-end gap-2 h-40">
                    {[30, 45, 12, 60, 25, 80, 40].map((h, i) => (
                        <div key={i} className={"flex-1 bg-indigo-200 rounded-t-lg relative group transition-all hover:bg-indigo-400" + ` h-[${h}%]`}>
                            <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-black px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                {h} Students
                            </div>
                        </div>
                    ))}
                </div>
                <div className="flex justify-between mt-3 text-[10px] font-bold text-slate-400 px-1 uppercase tracking-tighter">
                    <span>0-10</span>
                    <span>11-20</span>
                    <span>21-30</span>
                    <span>31-40</span>
                    <span>41-50</span>
                    <span>51-60</span>
                    <span>61+</span>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-100">
                        <tr>
                            <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-left">Ranking</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-left">Student</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">Final Score</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Percentile</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {results.map((r, i) => (
                            <tr key={r.name} className="hover:bg-slate-50/50">
                                <td className="px-6 py-4">
                                    <div className={clsx(
                                        "h-8 w-8 rounded-full flex items-center justify-center font-black text-sm",
                                        i === 0 ? "bg-amber-100 text-amber-700" :
                                            i === 1 ? "bg-slate-100 text-slate-500" :
                                                i === 2 ? "bg-orange-50 text-orange-700" : "text-slate-400"
                                    )}>
                                        #{r.rank}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <p className="font-bold text-slate-900 text-sm">{r.name}</p>
                                    <p className="text-xs text-slate-400 font-medium">{r.roll_number}</p>
                                </td>
                                <td className="px-6 py-4 text-center font-black text-slate-700">{r.score}</td>
                                <td className="px-6 py-4 text-right">
                                    <span className="text-xs font-bold text-emerald-600">{(100 - (i * 5))}% ile</span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function IntegrityTab({ driveId }: { driveId: string }) {
    const { data: integrity = [], isLoading } = useQuery<any[]>({
        queryKey: ["campus-drive-integrity", driveId],
        queryFn: async () => {
            const res = await api.get(`/campus/drives/${driveId}/integrity`);
            return res.data.data;
        }
    });

    if (isLoading) return <div className="p-8">Loading Integrity Data...</div>;

    const highRisk = integrity.filter(s => s.integrity_score < 70).length;

    return (
        <div className="p-8 space-y-8 animate-in zoom-in duration-500">
            <div className="flex items-center gap-6 p-6 bg-red-50 rounded-3xl border border-red-100">
                <div className="p-4 bg-white rounded-2xl text-red-500 shadow-sm shadow-red-100">
                    <ShieldAlert className="h-8 w-8" />
                </div>
                <div>
                    <h4 className="text-lg font-black text-red-900">Integrity Risk Warning</h4>
                    <p className="text-red-700 text-sm font-medium mt-1">We've detected <span className="font-black underline">{highRisk} students</span> with integrity scores below 70%. Please review their session recordings.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {integrity.map((s) => (
                    <div key={s.roll_number} className="flex items-center justify-between p-5 border border-slate-100 rounded-2xl bg-white shadow-sm hover:border-indigo-100 transition-all">
                        <div className="flex items-center gap-4">
                            <div className={clsx(
                                "h-11 w-11 rounded-xl flex items-center justify-center font-black",
                                s.integrity_score > 90 ? "bg-emerald-50 text-emerald-600" :
                                    s.integrity_score > 70 ? "bg-amber-50 text-amber-600" : "bg-red-50 text-red-600"
                            )}>
                                {s.integrity_score}%
                            </div>
                            <div>
                                <p className="font-bold text-slate-800 text-sm">{s.name}</p>
                                <p className="text-xs text-slate-400 font-medium">Violations: {s.violations || 0}</p>
                            </div>
                        </div>
                        <button className="p-2 text-slate-300 hover:text-indigo-600 transition-colors" aria-label="Expand row">
                            <ChevronDown className="h-5 w-5" />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}

function PlacementTab({ driveId }: { driveId: string }) {
    const queryClient = useQueryClient();
    const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
    const [status, setStatus] = useState<string>("Offered");

    const { data: students = [], isLoading } = useQuery<any[]>({
        queryKey: ["campus-drive-students", driveId],
        queryFn: async () => {
            const res = await api.get(`/campus/drives/${driveId}/students`);
            return res.data.data;
        }
    });

    const mutation = useMutation({
        mutationFn: async (payload: { studentId: string, status: string }) => {
            await api.put(`/campus/drives/${driveId}/placement`, payload);
        },
        onSuccess: () => {
            toast.success("Placement status updated!");
            queryClient.invalidateQueries({ queryKey: ["campus-drive-students", driveId] });
            setSelectedStudent(null);
        }
    });

    if (isLoading) return <div className="p-8">Loading Placement...</div>;

    return (
        <div className="p-8 space-y-8 animate-in fade-in duration-500">
            <div className="flex items-start justify-between">
                <div>
                    <h3 className="text-xl font-black text-slate-900 tracking-tight">Placement Outcome Management</h3>
                    <p className="text-slate-500 font-medium text-sm mt-1">Record hiring results for students who participated in this drive.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-4">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Select Student</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {students.slice(0, 6).map((s) => (
                            <button
                                key={s.user_id}
                                onClick={() => setSelectedStudent(s.user_id)}
                                className={clsx(
                                    "p-4 rounded-2xl border transition-all text-left group",
                                    selectedStudent === s.user_id
                                        ? "bg-indigo-50 border-indigo-200 shadow-lg shadow-indigo-50"
                                        : "bg-white border-slate-100 hover:border-slate-200"
                                )}
                            >
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className={clsx(
                                            "font-bold text-sm",
                                            selectedStudent === s.user_id ? "text-indigo-700" : "text-slate-800"
                                        )}>{s.name}</p>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5 tracking-tight">{s.department}</p>
                                    </div>
                                    <div className={clsx(
                                        "h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all",
                                        selectedStudent === s.user_id ? "border-indigo-500 bg-indigo-500 text-white" : "border-slate-200"
                                    )}>
                                        {selectedStudent === s.user_id && <CheckCircle2 className="h-3 w-3" />}
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100 space-y-6 h-fit sticky top-8">
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest text-center">Update Outcome</h4>

                    {!selectedStudent ? (
                        <div className="text-center py-8">
                            <Users className="h-10 w-10 text-slate-200 mx-auto mb-3" />
                            <p className="text-xs font-bold text-slate-400">Please select a student to update their status.</p>
                        </div>
                    ) : (
                        <div className="space-y-6 animate-in zoom-in-95 duration-300">
                            <div className="space-y-4">
                                {["Offered", "Joined", "Rejected", "Interviewing"].map((opt) => (
                                    <button
                                        key={opt}
                                        onClick={() => setStatus(opt)}
                                        className={clsx(
                                            "w-full flex items-center justify-between p-4 rounded-2xl border font-bold text-sm transition-all",
                                            status === opt
                                                ? "bg-white border-indigo-500 text-indigo-700 shadow-sm"
                                                : "bg-white border-slate-100 text-slate-500 grayscale opacity-60 hover:grayscale-0 hover:opacity-100"
                                        )}
                                    >
                                        {opt}
                                        {status === opt && <Save className="h-4 w-4" />}
                                    </button>
                                ))}
                            </div>
                            <button
                                onClick={() => mutation.mutate({ studentId: selectedStudent, status })}
                                disabled={mutation.isPending}
                                className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-sm shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50"
                            >
                                {mutation.isPending ? "Updating..." : "Confirm Update"}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
