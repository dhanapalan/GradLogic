import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    UserCog,
    UserPlus,
    Trash2,
    ShieldCheck,
    Mail,
    X,
} from "lucide-react";
import api from "../../lib/api";
import toast from "react-hot-toast";
import clsx from "clsx";
import campusDepartmentsService from "../../services/campusDepartmentsService";

interface StaffMember {
    id: string;
    name: string;
    email: string;
    role: string;
    department: string | null;
    is_active: boolean;
    created_at: string;
}

function AddStaffModal({ onClose }: { onClose: () => void }) {
    const queryClient = useQueryClient();
    const [form, setForm] = useState({
        name: "",
        email: "",
        password: "",
        role: "college_staff" as "college_staff" | "instructor",
        department: "",
    });

    const { data: departments = [] } = useQuery({
        queryKey: ["campus-departments"],
        queryFn: () => campusDepartmentsService.list(),
        enabled: form.role === "instructor",
    });

    const mutation = useMutation({
        mutationFn: (data: typeof form) => api.post("/colleges/staff", data),
        onSuccess: () => {
            toast.success(form.role === "instructor" ? "Faculty member added successfully." : "Staff member added successfully.");
            queryClient.invalidateQueries({ queryKey: ["college-staff"] });
            onClose();
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.error ?? "Failed to add staff member.");
        },
    });

    const canSubmit =
        form.name && form.email && form.password && (form.role !== "instructor" || form.department);

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-black text-slate-900">Add Staff Member</h2>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
                        <X className="h-4 w-4 text-slate-500" />
                    </button>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Account Type</label>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setForm((f) => ({ ...f, role: "college_staff" }))}
                                className={clsx(
                                    "flex-1 rounded-xl border px-3 py-2.5 text-sm font-bold transition-colors",
                                    form.role === "college_staff"
                                        ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                                        : "border-slate-200 text-slate-500 hover:bg-slate-50"
                                )}
                            >
                                Staff
                            </button>
                            <button
                                type="button"
                                onClick={() => setForm((f) => ({ ...f, role: "instructor" }))}
                                className={clsx(
                                    "flex-1 rounded-xl border px-3 py-2.5 text-sm font-bold transition-colors",
                                    form.role === "instructor"
                                        ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                                        : "border-slate-200 text-slate-500 hover:bg-slate-50"
                                )}
                            >
                                Faculty
                            </button>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Full Name</label>
                        <input
                            type="text"
                            placeholder="e.g. Dr. Priya Sharma"
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Email Address</label>
                        <input
                            type="email"
                            placeholder="staff@campus.edu"
                            value={form.email}
                            onChange={(e) => setForm({ ...form, email: e.target.value })}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                    </div>
                    {form.role === "instructor" && (
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Department</label>
                            <select
                                value={form.department}
                                onChange={(e) => setForm({ ...form, department: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            >
                                <option value="">Select department…</option>
                                {departments.map((d) => (
                                    <option key={d.id} value={d.name}>
                                        {d.name}
                                    </option>
                                ))}
                            </select>
                            {departments.length === 0 && (
                                <p className="mt-1 text-xs text-slate-400">
                                    No departments configured yet — add one under Settings first.
                                </p>
                            )}
                        </div>
                    )}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Temporary Password</label>
                        <input
                            type="password"
                            placeholder="Min. 6 characters"
                            value={form.password}
                            onChange={(e) => setForm({ ...form, password: e.target.value })}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                    </div>
                </div>

                <div className="flex gap-3 pt-2">
                    <button
                        onClick={onClose}
                        className="flex-1 py-2.5 rounded-xl text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => mutation.mutate(form)}
                        disabled={mutation.isPending || !canSubmit}
                        className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {mutation.isPending ? "Adding..." : "Add Member"}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function CampusAdminsPage() {
    const [showAddModal, setShowAddModal] = useState(false);
    const queryClient = useQueryClient();

    const { data: staff, isLoading } = useQuery<StaffMember[]>({
        queryKey: ["college-staff"],
        queryFn: async () => {
            const res = await api.get("/colleges/staff");
            return res.data.data;
        },
    });

    const removeMutation = useMutation({
        mutationFn: (id: string) => api.delete(`/colleges/staff/${id}`),
        onSuccess: () => {
            toast.success("Staff member removed.");
            queryClient.invalidateQueries({ queryKey: ["college-staff"] });
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.error ?? "Failed to remove staff member.");
        },
    });

    const handleRemove = (id: string, name: string) => {
        if (!window.confirm(`Remove ${name} from campus staff? They will lose access immediately.`)) return;
        removeMutation.mutate(id);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
            </div>
        );
    }

    return (
        <>
            {showAddModal && <AddStaffModal onClose={() => setShowAddModal(false)} />}

            <div className="p-8 max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex items-start justify-between">
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Campus Admins</h1>
                        <p className="mt-1 text-slate-500 font-medium">Manage staff members who have access to this campus portal.</p>
                    </div>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white font-bold text-sm rounded-xl shadow-sm hover:bg-indigo-700 transition-all active:scale-95"
                    >
                        <UserPlus className="h-4 w-4" />
                        Add Staff Member
                    </button>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[
                        { label: "Total Staff", value: staff?.length ?? 0, icon: UserCog, color: "indigo" },
                        { label: "Active", value: staff?.filter((s) => s.is_active).length ?? 0, icon: ShieldCheck, color: "emerald" },
                        { label: "Inactive", value: staff?.filter((s) => !s.is_active).length ?? 0, icon: Mail, color: "amber" },
                    ].map((kpi) => (
                        <div key={kpi.label} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                            <div className="flex items-center gap-4">
                                <div className={clsx(
                                    "p-3 rounded-xl",
                                    kpi.color === "indigo" && "bg-indigo-50 text-indigo-600",
                                    kpi.color === "emerald" && "bg-emerald-50 text-emerald-600",
                                    kpi.color === "amber" && "bg-amber-50 text-amber-600",
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

                {/* Staff Table */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50">
                        <h2 className="text-base font-black text-slate-900">Staff Directory</h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead>
                                <tr className="border-b border-slate-100 text-slate-400">
                                    <th className="px-6 py-4 font-bold">Name</th>
                                    <th className="px-6 py-4 font-bold">Email</th>
                                    <th className="px-6 py-4 font-bold text-center">Role</th>
                                    <th className="px-6 py-4 font-bold text-center">Status</th>
                                    <th className="px-6 py-4 font-bold text-center">Joined</th>
                                    <th className="px-6 py-4 font-bold text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {staff?.map((member) => (
                                    <tr key={member.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="h-9 w-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-black text-sm">
                                                    {member.name.charAt(0).toUpperCase()}
                                                </div>
                                                <span className="font-bold text-slate-900">{member.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-600 font-medium">{member.email}</td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700">
                                                {member.role === "instructor" ? "faculty" : member.role.replace("_", " ")}
                                            </span>
                                            {member.role === "instructor" && member.department && (
                                                <p className="mt-1 text-xs text-slate-400">{member.department}</p>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={clsx(
                                                "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold",
                                                member.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                                            )}>
                                                {member.is_active ? "Active" : "Inactive"}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center text-slate-500 font-medium">
                                            {new Date(member.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => handleRemove(member.id, member.name)}
                                                disabled={removeMutation.isPending}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-100 transition-all disabled:opacity-50"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                                Remove
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {(!staff || staff.length === 0) && (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center">
                                            <div className="flex flex-col items-center gap-3">
                                                <UserCog className="h-12 w-12 text-slate-200" />
                                                <p className="text-slate-400 font-bold">No staff members added yet.</p>
                                                <button
                                                    onClick={() => setShowAddModal(true)}
                                                    className="text-sm font-bold text-indigo-600 hover:text-indigo-700"
                                                >
                                                    Add your first staff member →
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </>
    );
}
