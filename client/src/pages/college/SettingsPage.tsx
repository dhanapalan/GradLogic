import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
    Settings,
    Building2,
    MapPin,
    Award,
    Save,
    CheckCircle2,
    Target,
} from "lucide-react";
import api from "../../lib/api";
import { useAuthStore } from "../../stores/authStore";
import toast from "react-hot-toast";

interface CampusData {
    id: string;
    name: string;
    city: string;
    state: string;
    country: string;
    tier: string | null;
    category: string | null;
    institution_type: string | null;
    region: string | null;
    naac_grade: string | null;
    nirf_rank: number | null;
    is_active: boolean;
    stats?: {
        student_count: number;
        avg_score: number;
        assessments_count: number;
        violation_count: number;
    };
}

export default function SettingsPage() {
    const user = useAuthStore((s) => s.user);
    const collegeId = user?.college_id;

    const { data: campus, isLoading } = useQuery<CampusData>({
        queryKey: ["campus-settings", collegeId],
        queryFn: async () => {
            const res = await api.get(`/campuses/${collegeId}`);
            return res.data.data;
        },
        enabled: !!collegeId,
    });

    const [form, setForm] = useState({
        name: "",
        city: "",
        state: "",
        tier: "",
        category: "",
        institution_type: "",
        region: "",
        naac_grade: "",
        nirf_rank: "",
    });

    useEffect(() => {
        if (campus) {
            setForm({
                name: campus.name ?? "",
                city: campus.city ?? "",
                state: campus.state ?? "",
                tier: campus.tier ?? "",
                category: campus.category ?? "",
                institution_type: campus.institution_type ?? "",
                region: campus.region ?? "",
                naac_grade: campus.naac_grade ?? "",
                nirf_rank: campus.nirf_rank != null ? String(campus.nirf_rank) : "",
            });
        }
    }, [campus]);

    const mutation = useMutation({
        mutationFn: (data: typeof form) => {
            const payload: Record<string, any> = { ...data };
            if (payload.nirf_rank === "") delete payload.nirf_rank;
            else payload.nirf_rank = parseInt(payload.nirf_rank, 10);
            // Remove empty strings → null
            Object.keys(payload).forEach((k) => {
                if (payload[k] === "") payload[k] = null;
            });
            return api.put(`/campuses/${collegeId}`, payload);
        },
        onSuccess: () => {
            toast.success("Campus settings saved successfully.");
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.error ?? "Failed to save settings.");
        },
    });

    // ── Daily practice target (scoped college endpoint) ──────────────────────
    const { data: dailyTarget } = useQuery<{ daily_practice_target: number }>({
        queryKey: ["college-daily-target"],
        queryFn: async () => (await api.get("/college/dashboard/daily-target")).data.data,
    });
    const [target, setTarget] = useState<string>("");
    useEffect(() => {
        if (dailyTarget) setTarget(String(dailyTarget.daily_practice_target));
    }, [dailyTarget]);

    const targetMutation = useMutation({
        mutationFn: (value: number) =>
            api.put("/college/dashboard/daily-target", { daily_practice_target: value }),
        onSuccess: () => toast.success("Daily practice target updated."),
        onError: (err: any) =>
            toast.error(err?.response?.data?.error ?? "Failed to update daily target."),
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
            </div>
        );
    }

    const field = (
        label: string,
        key: keyof typeof form,
        placeholder?: string,
        type: "text" | "number" = "text"
    ) => (
        <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">{label}</label>
            <input
                type={type}
                placeholder={placeholder}
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            />
        </div>
    );

    return (
        <div className="p-8 max-w-5xl mx-auto space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Campus Settings</h1>
                <p className="mt-1 text-slate-500 font-medium">View and update your campus profile information.</p>
            </div>

            {/* Stats Overview */}
            {campus?.stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { label: "Students", value: campus.stats.student_count },
                        { label: "Assessments", value: campus.stats.assessments_count },
                        { label: "Avg Score", value: `${campus.stats.avg_score?.toFixed(1)}%` },
                        { label: "Violations", value: campus.stats.violation_count },
                    ].map((stat) => (
                        <div key={stat.label} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm text-center">
                            <p className="text-2xl font-black text-slate-900">{stat.value}</p>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{stat.label}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Settings Form */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-indigo-500" />
                    <h2 className="text-base font-black text-slate-900">Campus Information</h2>
                </div>
                <div className="p-6 space-y-6">
                    {/* Basic Info */}
                    <div>
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <Building2 className="h-4 w-4" />
                            Basic Details
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            {field("Campus Name", "name", "e.g. PSG College of Technology")}
                            {field("Category", "category", "e.g. Engineering")}
                            {field("Institution Type", "institution_type", "e.g. Autonomous")}
                            {field("Tier", "tier", "e.g. Tier 1")}
                        </div>
                    </div>

                    {/* Location */}
                    <div className="border-t border-slate-100 pt-6">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            Location
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            {field("City", "city", "e.g. Coimbatore")}
                            {field("State", "state", "e.g. Tamil Nadu")}
                            {field("Region", "region", "e.g. South India")}
                        </div>
                    </div>

                    {/* Accreditation */}
                    <div className="border-t border-slate-100 pt-6">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <Award className="h-4 w-4" />
                            Accreditation & Rankings
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            {field("NAAC Grade", "naac_grade", "e.g. A+")}
                            {field("NIRF Rank", "nirf_rank", "e.g. 15", "number")}
                        </div>
                    </div>

                    {/* Status Badge */}
                    <div className="border-t border-slate-100 pt-6 flex items-center gap-3">
                        <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold
                            ${campus?.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                            <CheckCircle2 className="h-4 w-4" />
                            {campus?.is_active ? "Campus is Active" : "Campus is Inactive"}
                        </div>
                        <p className="text-xs text-slate-400 font-medium">Status is managed by the central admin team.</p>
                    </div>
                </div>

                {/* Save Footer */}
                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
                    <button
                        onClick={() => {
                            if (campus) {
                                setForm({
                                    name: campus.name ?? "",
                                    city: campus.city ?? "",
                                    state: campus.state ?? "",
                                    tier: campus.tier ?? "",
                                    category: campus.category ?? "",
                                    institution_type: campus.institution_type ?? "",
                                    region: campus.region ?? "",
                                    naac_grade: campus.naac_grade ?? "",
                                    nirf_rank: campus.nirf_rank != null ? String(campus.nirf_rank) : "",
                                });
                            }
                        }}
                        className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
                    >
                        Reset
                    </button>
                    <button
                        onClick={() => mutation.mutate(form)}
                        disabled={mutation.isPending}
                        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white font-bold text-sm rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 shadow-sm"
                    >
                        {mutation.isPending ? (
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        ) : (
                            <Save className="h-4 w-4" />
                        )}
                        {mutation.isPending ? "Saving..." : "Save Changes"}
                    </button>
                </div>
            </div>

            {/* Student Engagement */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                    <Target className="h-5 w-5 text-indigo-500" />
                    <h2 className="text-base font-black text-slate-900">Student Engagement</h2>
                </div>
                <div className="p-6">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                        Daily Practice Target
                    </label>
                    <p className="text-sm text-slate-500 mb-3">
                        How many practice sets each student should complete per day. Shown on their
                        dashboard with a streak. Set to <span className="font-bold">0</span> to hide the target.
                    </p>
                    <div className="flex items-center gap-3">
                        <input
                            type="number"
                            min={0}
                            max={20}
                            value={target}
                            onChange={(e) => setTarget(e.target.value)}
                            className="w-28 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                        />
                        <span className="text-sm font-medium text-slate-400">sets / student / day</span>
                        <button
                            onClick={() => {
                                const v = parseInt(target, 10);
                                if (Number.isNaN(v) || v < 0 || v > 20) {
                                    toast.error("Enter a whole number between 0 and 20.");
                                    return;
                                }
                                targetMutation.mutate(v);
                            }}
                            disabled={targetMutation.isPending}
                            className="ml-auto flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white font-bold text-sm rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all active:scale-95 shadow-sm"
                        >
                            {targetMutation.isPending ? (
                                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            ) : (
                                <Save className="h-4 w-4" />
                            )}
                            Save Target
                        </button>
                    </div>
                </div>
            </div>

            {/* Read-only Info */}
            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 space-y-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Read-only Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="flex justify-between">
                        <span className="font-bold text-slate-500">Campus ID</span>
                        <span className="font-mono text-slate-700 text-xs">{campus?.id}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="font-bold text-slate-500">Country</span>
                        <span className="font-bold text-slate-700">{campus?.country ?? "India"}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
