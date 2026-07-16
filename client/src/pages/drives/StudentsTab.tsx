import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
    Users, Upload, Building2, Search, Loader2, UserPlus, Trash2,
    CheckCircle, AlertCircle, FileText, X,
    Star, Calendar, Edit3, Award, MessageSquare
} from "lucide-react";
import api from "../../lib/api";
import toast from "react-hot-toast";

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
    INVITED: { bg: "bg-indigo-100", text: "text-indigo-700" },
    invited: { bg: "bg-indigo-100", text: "text-indigo-700" },
    assigned: { bg: "bg-slate-100", text: "text-slate-600" },
    registered: { bg: "bg-blue-100", text: "text-blue-700" },
    started: { bg: "bg-amber-100", text: "text-amber-700" },
    completed: { bg: "bg-emerald-100", text: "text-emerald-700" },
};

const ELIGIBILITY_STYLES: Record<string, { bg: string; text: string }> = {
    eligible: { bg: "bg-emerald-50", text: "text-emerald-700" },
    partial: { bg: "bg-amber-50", text: "text-amber-700" },
    missing: { bg: "bg-red-50", text: "text-red-700" },
    ineligible: { bg: "bg-slate-100", text: "text-slate-500" },
};

export default function StudentsTab({ drive }: { drive: any }) {
    const queryClient = useQueryClient();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [addMode, setAddMode] = useState<null | "campus" | "csv" | "manual">(null);

    // Campus add state
    const [campusId, setCampusId] = useState("");
    const [campusSegment, setCampusSegment] = useState("");
    const [isAddingCampus, setIsAddingCampus] = useState(false);

    // CSV state
    const [isUploadingCSV, setIsUploadingCSV] = useState(false);
    const [csvResult, setCsvResult] = useState<any>(null);

    // Manual add state
    const [manualIds, setManualIds] = useState("");
    const [isAddingManual, setIsAddingManual] = useState(false);

    // Workflow actions state
    const [isActionLoading, setIsActionLoading] = useState<string | null>(null);
    const [scheduleModalNode, setScheduleModalNode] = useState<{ studentId: string, name: string } | null>(null);
    const [interviewDate, setInterviewDate] = useState("");
    const [feedbackModalNode, setFeedbackModalNode] = useState<{ studentId: string, name: string } | null>(null);
    const [interviewScore, setInterviewScore] = useState("");
    const [interviewFeedback, setInterviewFeedback] = useState("");

    const isReadOnly = ["active", "completed", "published", "cancelled"].includes(drive.status?.toLowerCase());

    // Fetch students
    const { data: students = [], isLoading } = useQuery({
        queryKey: ["drive-students", drive.id, search, statusFilter],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (search) params.set("search", search);
            if (statusFilter !== "all") params.set("status", statusFilter);
            const res = await api.get(`/drives/${drive.id}/students?${params}`);
            return res.data.data || [];
        },
        enabled: !!drive.id,
    });

    // Fetch campuses for dropdown
    const { data: campuses = [] } = useQuery({
        queryKey: ["colleges-list"],
        queryFn: async () => {
            const res = await api.get("/campuses");
            return res.data.data || [];
        },
        enabled: addMode === "campus",
    });

    const invalidateStudents = () => {
        queryClient.invalidateQueries({ queryKey: ["drive-students", drive.id] });
        queryClient.invalidateQueries({ queryKey: ["drive", drive.id] });
    };

    // ── Handlers ─────────────────────────────────────────────────────────

    const handleAddByCampus = async () => {
        if (!campusId) return toast.error("Select a campus");
        setIsAddingCampus(true);
        try {
            const res = await api.post(`/drives/${drive.id}/students/campus`, {
                college_id: campusId,
                segment: campusSegment || undefined,
            });
            toast.success(res.data.message || "Students invited from campus");
            setAddMode(null);
            setCampusId("");
            setCampusSegment("");
            invalidateStudents();
        } catch (err: any) {
            toast.error(err.response?.data?.error || "Failed to add students");
        } finally {
            setIsAddingCampus(false);
        }
    };

    const handleCSVUpload = async (file: File) => {
        setIsUploadingCSV(true);
        setCsvResult(null);
        try {
            const formData = new FormData();
            formData.append("file", file);
            const res = await api.post(`/drives/${drive.id}/students/csv`, formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            setCsvResult(res.data.data);
            toast.success(res.data.message || "CSV processed");
            invalidateStudents();
        } catch (err: any) {
            toast.error(err.response?.data?.error || "CSV upload failed");
        } finally {
            setIsUploadingCSV(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const handleAddByIds = async () => {
        const ids = manualIds.split(/[,\n]+/).map(s => s.trim()).filter(Boolean);
        if (ids.length === 0) return toast.error("Enter at least one student ID");
        setIsAddingManual(true);
        try {
            const res = await api.post(`/drives/${drive.id}/students`, { student_ids: ids });
            toast.success(res.data.message || `${ids.length} student(s) processed`);
            setAddMode(null);
            setManualIds("");
            invalidateStudents();
        } catch (err: any) {
            toast.error(err.response?.data?.error || "Failed to add students");
        } finally {
            setIsAddingManual(false);
        }
    };

    const handleRemove = async (studentId: string, name: string) => {
        if (!confirm(`Remove ${name || "this student"} from the drive?`)) return;
        try {
            await api.delete(`/drives/${drive.id}/students/${studentId}`);
            toast.success("Student removed");
            invalidateStudents();
        } catch (err: any) {
            toast.error(err.response?.data?.error || "Failed to remove student");
        }
    };

    // ── Workflow Actions ─────────────────────────────────────────────────

    const handleShortlist = async (studentId: string) => {
        setIsActionLoading(studentId + "-shortlist");
        try {
            await api.post(`/drives/${drive.id}/students/${studentId}/shortlist`);
            toast.success("Student shortlisted");
            invalidateStudents();
        } catch (err: any) {
            toast.error(err.response?.data?.error || "Failed to shortlist student");
        } finally {
            setIsActionLoading(null);
        }
    };

    const handleScheduleInterview = async () => {
        if (!scheduleModalNode || !interviewDate) return;
        setIsActionLoading(scheduleModalNode.studentId + "-schedule");
        try {
            await api.post(`/drives/${drive.id}/students/${scheduleModalNode.studentId}/interview`, { interview_date: interviewDate });
            toast.success("Interview scheduled");
            setScheduleModalNode(null);
            setInterviewDate("");
            invalidateStudents();
        } catch (err: any) {
            toast.error(err.response?.data?.error || "Failed to schedule interview");
        } finally {
            setIsActionLoading(null);
        }
    };

    const handleCompleteInterview = async () => {
        if (!feedbackModalNode || !interviewScore || !interviewFeedback) return;
        setIsActionLoading(feedbackModalNode.studentId + "-feedback");
        try {
            await api.post(`/drives/${drive.id}/students/${feedbackModalNode.studentId}/interview-feedback`, {
                score: Number(interviewScore),
                feedback: interviewFeedback
            });
            toast.success("Interview feedback saved");
            setFeedbackModalNode(null);
            setInterviewScore("");
            setInterviewFeedback("");
            invalidateStudents();
        } catch (err: any) {
            toast.error(err.response?.data?.error || "Failed to save feedback");
        } finally {
            setIsActionLoading(null);
        }
    };

    const handleOffer = async (studentId: string) => {
        if (!confirm("Are you sure you want to release an offer to this student?")) return;
        setIsActionLoading(studentId + "-offer");
        try {
            await api.post(`/drives/${drive.id}/students/${studentId}/offer`);
            toast.success("Offer released");
            invalidateStudents();
        } catch (err: any) {
            toast.error(err.response?.data?.error || "Failed to release offer");
        } finally {
            setIsActionLoading(null);
        }
    };

    // ── Render ───────────────────────────────────────────────────────────

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h2 className="text-lg font-bold text-slate-800">Drive Students</h2>
                    <p className="text-sm text-slate-500">{students.length} student(s) in this drive</p>
                </div>

                {!isReadOnly && (
                    <div className="flex gap-2">
                        <button
                            onClick={() => setAddMode(addMode === "campus" ? null : "campus")}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${addMode === "campus" ? "bg-indigo-50 border-indigo-200 text-indigo-600" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                        >
                            <Building2 className="h-3.5 w-3.5" /> From Campus
                        </button>
                        <button
                            onClick={() => setAddMode(addMode === "csv" ? null : "csv")}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${addMode === "csv" ? "bg-indigo-50 border-indigo-200 text-indigo-600" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                        >
                            <Upload className="h-3.5 w-3.5" /> Upload CSV
                        </button>
                        <button
                            onClick={() => setAddMode(addMode === "manual" ? null : "manual")}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${addMode === "manual" ? "bg-indigo-50 border-indigo-200 text-indigo-600" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                        >
                            <UserPlus className="h-3.5 w-3.5" /> Add by ID
                        </button>
                    </div>
                )}
            </div>

            {/* ── Add Students Panels ─────────────────────────────────────── */}

            {addMode === "campus" && (
                <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between mb-1">
                        <h3 className="text-sm font-bold text-indigo-800 flex items-center gap-2"><Building2 className="h-4 w-4" /> Add from Campus</h3>
                        <button title="Close" onClick={() => setAddMode(null)} className="p-1 hover:bg-indigo-100 rounded-lg"><X className="h-4 w-4 text-indigo-400" /></button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <select
                            title="Select campus"
                            value={campusId}
                            onChange={(e) => setCampusId(e.target.value)}
                            className="px-3 py-2.5 bg-white border border-indigo-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                        >
                            <option value="">Select campus...</option>
                            {campuses.map((c: any) => (
                                <option key={c.id} value={c.id}>{c.name} ({c.college_code})</option>
                            ))}
                        </select>
                        <input
                            type="text"
                            value={campusSegment}
                            onChange={(e) => setCampusSegment(e.target.value)}
                            placeholder="Segment / Department (optional)"
                            className="px-3 py-2.5 bg-white border border-indigo-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                        />
                        <button
                            onClick={handleAddByCampus}
                            disabled={isAddingCampus || !campusId}
                            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-500 text-white rounded-xl text-sm font-bold hover:bg-indigo-600 disabled:opacity-50 transition-colors"
                        >
                            {isAddingCampus ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                            Invite All Students
                        </button>
                    </div>
                </div>
            )}

            {addMode === "csv" && (
                <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between mb-1">
                        <h3 className="text-sm font-bold text-indigo-800 flex items-center gap-2"><Upload className="h-4 w-4" /> Upload CSV</h3>
                        <button title="Close" onClick={() => { setAddMode(null); setCsvResult(null); }} className="p-1 hover:bg-indigo-100 rounded-lg"><X className="h-4 w-4 text-indigo-400" /></button>
                    </div>
                    <div className="flex items-center gap-4">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".csv"
                            title="Upload CSV file"
                            onChange={(e) => e.target.files?.[0] && handleCSVUpload(e.target.files[0])}
                            className="hidden"
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploadingCSV}
                            className="flex items-center gap-2 px-5 py-3 bg-white border-2 border-dashed border-indigo-200 rounded-xl text-sm font-bold text-indigo-600 hover:border-indigo-400 hover:bg-indigo-50 transition-colors"
                        >
                            {isUploadingCSV ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                            {isUploadingCSV ? "Processing..." : "Choose CSV File"}
                        </button>
                        <p className="text-xs text-slate-500">
                            CSV must have an <strong>email</strong> or <strong>student_id</strong> column header.
                        </p>
                    </div>
                    {csvResult && (
                        <div className="bg-white rounded-xl border border-indigo-100 p-4 space-y-2 text-sm">
                            <div className="flex gap-6">
                                <span className="text-emerald-600 font-bold"><CheckCircle className="h-3.5 w-3.5 inline mr-1" />{csvResult.added} added</span>
                                <span className="text-amber-600 font-bold"><AlertCircle className="h-3.5 w-3.5 inline mr-1" />{csvResult.skipped} skipped</span>
                                <span className="text-slate-500">of {csvResult.total} rows</span>
                            </div>
                            {csvResult.errors?.length > 0 && (
                                <details className="text-xs text-red-600">
                                    <summary className="cursor-pointer font-bold">Show errors ({csvResult.errors.length})</summary>
                                    <ul className="mt-1 space-y-0.5 max-h-32 overflow-y-auto">
                                        {csvResult.errors.map((e: string, i: number) => <li key={i}>{e}</li>)}
                                    </ul>
                                </details>
                            )}
                        </div>
                    )}
                </div>
            )}

            {addMode === "manual" && (
                <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between mb-1">
                        <h3 className="text-sm font-bold text-indigo-800 flex items-center gap-2"><UserPlus className="h-4 w-4" /> Add by User ID</h3>
                        <button title="Close" onClick={() => setAddMode(null)} className="p-1 hover:bg-indigo-100 rounded-lg"><X className="h-4 w-4 text-indigo-400" /></button>
                    </div>
                    <textarea
                        value={manualIds}
                        onChange={(e) => setManualIds(e.target.value)}
                        placeholder="Paste user UUIDs (one per line or comma-separated)"
                        rows={3}
                        className="w-full px-3 py-2.5 bg-white border border-indigo-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-200 resize-none"
                    />
                    <button
                        onClick={handleAddByIds}
                        disabled={isAddingManual || !manualIds.trim()}
                        className="flex items-center gap-2 px-4 py-2.5 bg-indigo-500 text-white rounded-xl text-sm font-bold hover:bg-indigo-600 disabled:opacity-50 transition-colors"
                    >
                        {isAddingManual ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                        Add Students
                    </button>
                </div>
            )}

            {/* ── Modals ──────────────────────────────────────────────────── */}
            {scheduleModalNode && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden border border-slate-200">
                        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                <Calendar className="h-5 w-5 text-indigo-600" />
                                Schedule Interview
                            </h3>
                            <button onClick={() => setScheduleModalNode(null)} className="p-1 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Student</label>
                                <p className="text-sm text-slate-600 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">{scheduleModalNode.name}</p>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Date & Time</label>
                                <input
                                    type="datetime-local"
                                    value={interviewDate}
                                    onChange={(e) => setInterviewDate(e.target.value)}
                                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                />
                            </div>
                        </div>
                        <div className="p-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50/50">
                            <button onClick={() => setScheduleModalNode(null)} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors">Cancel</button>
                            <button
                                onClick={handleScheduleInterview}
                                disabled={!interviewDate || isActionLoading === scheduleModalNode.studentId + "-schedule"}
                                className="px-5 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                                {isActionLoading === scheduleModalNode.studentId + "-schedule" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                                Schedule
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {feedbackModalNode && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden border border-slate-200">
                        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                <MessageSquare className="h-5 w-5 text-indigo-600" />
                                Interview Feedback
                            </h3>
                            <button onClick={() => setFeedbackModalNode(null)} className="p-1 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Student</label>
                                <p className="text-sm text-slate-600 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">{feedbackModalNode.name}</p>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Interview Score (out of 100)</label>
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={interviewScore}
                                    onChange={(e) => setInterviewScore(e.target.value)}
                                    placeholder="Enter score (e.g. 85)"
                                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Detailed Feedback</label>
                                <textarea
                                    rows={4}
                                    value={interviewFeedback}
                                    onChange={(e) => setInterviewFeedback(e.target.value)}
                                    placeholder="Enter technical and behavioral feedback notes..."
                                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                                />
                            </div>
                        </div>
                        <div className="p-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50/50">
                            <button onClick={() => setFeedbackModalNode(null)} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors">Cancel</button>
                            <button
                                onClick={handleCompleteInterview}
                                disabled={!interviewScore || !interviewFeedback || isActionLoading === feedbackModalNode.studentId + "-feedback"}
                                className="px-5 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                                {isActionLoading === feedbackModalNode.studentId + "-feedback" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                                Save Feedback
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Filters ─────────────────────────────────────────────────── */}
            <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by name, email, or roll number..."
                        className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    />
                </div>
                <select
                    title="Filter by status"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                >
                    <option value="all">All Statuses</option>
                    <option value="INVITED">Invited</option>
                    <option value="assigned">Assigned</option>
                    <option value="registered">Registered</option>
                    <option value="started">Started</option>
                    <option value="completed">Completed</option>
                </select>
            </div>

            {/* ── Student Table ────────────────────────────────────────────── */}
            {isLoading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
                </div>
            ) : students.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                    <Users className="h-10 w-10 mx-auto mb-3 text-slate-300" />
                    <p className="font-bold">No students {search ? "match your search" : "assigned yet"}</p>
                    {!isReadOnly && !search && (
                        <p className="text-sm mt-1">Use the buttons above to invite students</p>
                    )}
                </div>
            ) : (
                <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase">Student</th>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase w-28">Roll No</th>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase w-36">Campus</th>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase w-32 text-center">Eligibility</th>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase w-28 text-center">Status</th>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase w-20 text-center">Score</th>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase w-20 text-center">Violations</th>
                                {!isReadOnly && (
                                    <th className="p-4 text-xs font-bold text-slate-500 uppercase w-16 text-right">Actions</th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {students.map((s: any) => {
                                const st = STATUS_STYLES[s.status] || STATUS_STYLES.assigned;
                                return (
                                    <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="p-4">
                                            <p className="text-sm font-bold text-slate-800">{s.first_name} {s.last_name}</p>
                                            <p className="text-xs text-slate-400">{s.email}</p>
                                        </td>
                                        <td className="p-4 text-sm text-slate-600">{s.roll_number || "—"}</td>
                                        <td className="p-4 text-sm text-slate-600 truncate max-w-[140px] font-bold">{s.college_name || "—"}</td>
                                        <td className="p-4 text-center">
                                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black tracking-wider uppercase ${ELIGIBILITY_STYLES[s.eligibility_status]?.bg || "bg-emerald-50"} ${ELIGIBILITY_STYLES[s.eligibility_status]?.text || "text-emerald-700"} border border-current/10`}>
                                                {s.eligibility_status || 'eligible'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${st.bg} ${st.text} capitalize`}>
                                                {s.status === 'completed' && <CheckCircle className="h-3 w-3" />}
                                                {s.status === 'started' && <Loader2 className="h-3 w-3" />}
                                                {(s.status === 'INVITED' || s.status === 'invited') && <AlertCircle className="h-3 w-3" />}
                                                {s.status}
                                            </span>
                                        </td>
                                        <td className="p-4 text-center text-sm font-bold text-slate-700">{s.score ?? "—"}</td>
                                        <td className="p-4 text-center text-sm font-bold text-red-600">{s.violations || 0}</td>
                                        {!isReadOnly && (
                                            <td className="p-4 text-right flex items-center justify-end gap-2">
                                                {/* Workflow Action Buttons */}
                                                {s.status === 'completed' && !s.is_shortlisted && s.placement_status !== 'Rejected' && (
                                                    <button
                                                        onClick={() => handleShortlist(s.student_id)}
                                                        className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors group relative"
                                                        title="Shortlist"
                                                    >
                                                        {isActionLoading === s.student_id + "-shortlist" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Star className="h-4 w-4" />}
                                                    </button>
                                                )}

                                                {s.is_shortlisted && s.placement_status === 'Shortlisted' && (
                                                    <button
                                                        onClick={() => setScheduleModalNode({ studentId: s.student_id, name: `${s.first_name}` })}
                                                        className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors group relative"
                                                        title="Schedule Interview"
                                                    >
                                                        {isActionLoading === s.student_id + "-schedule" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calendar className="h-4 w-4" />}
                                                    </button>
                                                )}

                                                {s.placement_status === 'Interviewed' && s.interview_status?.startsWith('Scheduled') && (
                                                    <button
                                                        onClick={() => setFeedbackModalNode({ studentId: s.student_id, name: `${s.first_name}` })}
                                                        className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors group relative"
                                                        title="Complete Interview"
                                                    >
                                                        {isActionLoading === s.student_id + "-feedback" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Edit3 className="h-4 w-4" />}
                                                    </button>
                                                )}

                                                {s.placement_status === 'Interviewed' && s.interview_status?.startsWith('Completed') && (!s.offer_released) && (
                                                    <button
                                                        onClick={() => handleOffer(s.student_id)}
                                                        className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors group relative"
                                                        title="Release Offer"
                                                    >
                                                        {isActionLoading === s.student_id + "-offer" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Award className="h-4 w-4" />}
                                                    </button>
                                                )}

                                                {(s.status === 'INVITED' || s.status === 'invited' || s.status === 'assigned' || s.status === 'registered') && (
                                                    <button
                                                        onClick={() => handleRemove(s.student_id, s.first_name)}
                                                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="Remove student"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                )}
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
