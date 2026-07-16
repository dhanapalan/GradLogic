import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
    Loader2,
    CheckCircle,
    XCircle,
    RefreshCw,
    Eye,
    Check,
    ShieldCheck,
    AlertCircle,
    BarChart3,
    Target,
    Lock,
    Ban,
    Layers,
} from "lucide-react";
import api from "../../lib/api";
import toast from "react-hot-toast";

type SourceCollection = {
    id: string;
    name: string;
    category?: string;
    section_name?: string | null;
    question_count?: number;
};

export default function PoolReviewTab({ drive }: { drive: any; snapshot: any }) {
    const queryClient = useQueryClient();
    const [selectedQuestion, setSelectedQuestion] = useState<any | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isReseeding, setIsReseeding] = useState(false);
    const [isApproving, setIsApproving] = useState(false);
    const [showApproveConfirm, setShowApproveConfirm] = useState(false);
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectReason, setRejectReason] = useState("");
    const [isRejecting, setIsRejecting] = useState(false);

    const { data: sourceCollections = [] } = useQuery({
        queryKey: ["drive-collections", drive.id],
        queryFn: async () => {
            const res = await api.get(`/drives/${drive.id}/collections`);
            return (res.data.data || []) as SourceCollection[];
        },
        enabled: !!drive.id,
    });

    const assembler =
        typeof drive.assembler_config === "string"
            ? (() => {
                  try {
                      return JSON.parse(drive.assembler_config);
                  } catch {
                      return {};
                  }
              })()
            : drive.assembler_config || {};

    const isCollectionAssembled =
        sourceCollections.length > 0 ||
        assembler?.source === "question_collections";

    const { data: poolData, isLoading, isError, error } = useQuery({
        queryKey: ["pool", drive.id],
        queryFn: async () => {
            const res = await api.get(`/drives/${drive.id}/pool`);
            return res.data.data;
        },
        enabled: !!drive.id,
        refetchInterval: (query) => {
            const data = query.state.data as any;
            if (data?.generation_status === "generating") return 3000;
            return false;
        },
        retry: (failureCount, err: any) => {
            if (err?.response?.status === 404) return false;
            return failureCount < 2;
        },
    });

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ["drive", drive.id] });
        queryClient.invalidateQueries({ queryKey: ["pool", drive.id] });
        queryClient.invalidateQueries({ queryKey: ["drive-collections", drive.id] });
    };

    const handleGeneratePool = async () => {
        setIsGenerating(true);
        try {
            await api.post(`/drives/${drive.id}/generate`);
            toast.success("Pool generation started.");
            invalidate();
        } catch (err: any) {
            toast.error(err.response?.data?.error || "Failed to start pool generation.");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleReseedFromCollections = async () => {
        setIsReseeding(true);
        try {
            const res = await api.post(`/drives/${drive.id}/seed-from-collections`);
            const n = res.data?.data?.seed?.inserted;
            toast.success(
                typeof n === "number"
                    ? `Pool reassembled (${n} questions from collections)`
                    : "Pool reassembled from Question Collections"
            );
            invalidate();
        } catch (err: any) {
            toast.error(err.response?.data?.error || "Failed to reseed from collections.");
        } finally {
            setIsReseeding(false);
        }
    };

    const handleApprovePool = async () => {
        setIsApproving(true);
        try {
            await api.post(`/drives/${drive.id}/pool/approve`);
            toast.success("Pool approved and locked. Next: Mark Ready → Schedule → Publish.");
            setShowApproveConfirm(false);
            invalidate();
        } catch (err: any) {
            toast.error(err.response?.data?.error || "Failed to approve pool.");
        } finally {
            setIsApproving(false);
        }
    };

    const handleRejectPool = async () => {
        setIsRejecting(true);
        try {
            await api.post(`/drives/${drive.id}/pool/reject`, { reason: rejectReason || undefined });
            toast.success(
                isCollectionAssembled
                    ? "Pool rejected. You can reassemble from collections."
                    : "Pool rejected. You can regenerate the pool."
            );
            setShowRejectModal(false);
            setRejectReason("");
            invalidate();
        } catch (err: any) {
            toast.error(err.response?.data?.error || "Failed to reject pool.");
        } finally {
            setIsRejecting(false);
        }
    };

    const handleRegeneratePool = async () => {
        try {
            await api.post(`/drives/${drive.id}/pool/regenerate`, { type: "full" });
            toast.success("Full pool regeneration triggered.");
            invalidate();
        } catch {
            toast.error("Failed to regenerate pool.");
        }
    };

    const handleUpdateQuestionStatus = async (questionId: string, status: string) => {
        try {
            await api.patch(`/drives/questions/${questionId}/status`, { status });
            toast.success(`Question ${status}`);
            queryClient.invalidateQueries({ queryKey: ["pool", drive.id] });
        } catch {
            toast.error("Failed to update status");
        }
    };

    const poolMissing =
        !poolData &&
        (isError
            ? (error as any)?.response?.status === 404
            : !isLoading && !drive.pool_id);

    if (isLoading && !poolData) {
        return (
            <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
            </div>
        );
    }

    if (poolMissing || !poolData) {
        return (
            <div className="text-center py-12">
                <ShieldCheck className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                <h3 className="text-lg font-bold text-slate-700">
                    {isCollectionAssembled ? "No pool assembled yet" : "No Assessment Pool Generated"}
                </h3>
                <p className="text-slate-500 mb-6 max-w-md mx-auto">
                    {isCollectionAssembled
                        ? "Assemble a preview pool from the attached Question Collections. No new bank questions are created."
                        : "Generate an AI-curated question pool based on the rules and configuration specified in the template."}
                </p>
                {isCollectionAssembled && sourceCollections.length > 0 && (
                    <ul className="mb-6 mx-auto max-w-md text-left text-sm text-slate-600 space-y-1.5">
                        {sourceCollections.map((c) => (
                            <li key={c.id} className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                                <Layers className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                <span className="font-medium truncate">
                                    {c.section_name || c.name}
                                </span>
                                <span className="ml-auto text-xs text-slate-400 tabular-nums">
                                    {c.question_count ?? "—"} Q
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
                {isCollectionAssembled ? (
                    <button
                        type="button"
                        onClick={handleReseedFromCollections}
                        disabled={isReseeding || sourceCollections.length === 0}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-navy-900 text-white rounded-xl font-bold hover:bg-navy-800 disabled:opacity-50 transition-colors shadow-sm"
                    >
                        {isReseeding ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                            <Layers className="h-5 w-5" />
                        )}
                        Assemble from collections
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={handleGeneratePool}
                        disabled={isGenerating}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
                    >
                        {isGenerating ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                            <RefreshCw className="h-5 w-5" />
                        )}
                        Generate AI Pool
                    </button>
                )}
            </div>
        );
    }

    const questions = poolData.questions || [];
    const driveStatus = String(drive.status || "").toUpperCase();
    const isApproved =
        poolData.status === "approved" ||
        ["APPROVED", "POOL_APPROVED", "READY", "LIVE", "SCHEDULED", "ACTIVE", "PUBLISHED"].includes(
            driveStatus
        );
    const isLocked = !!poolData.is_locked;
    const isRejected = poolData.status === "rejected";
    const duplicateCount = questions.filter((q: any) => q.status === "duplicate").length;
    const duplicatePct =
        questions.length > 0 ? Math.round((duplicateCount / questions.length) * 100) : 0;
    const validationScore = poolData.validation_score
        ? Number(poolData.validation_score)
        : null;
    const isGeneratingPool = poolData.generation_status === "generating";

    const skillDist: Record<
        string,
        { target_pct: number; actual_count: number; actual_pct: number }
    > = poolData.skill_distribution
        ? typeof poolData.skill_distribution === "string"
            ? JSON.parse(poolData.skill_distribution)
            : poolData.skill_distribution
        : {};
    const diffDist: Record<
        string,
        { target_pct: number; actual_count: number; actual_pct: number }
    > = poolData.difficulty_distribution
        ? typeof poolData.difficulty_distribution === "string"
            ? JSON.parse(poolData.difficulty_distribution)
            : poolData.difficulty_distribution
        : {};

    const rebuildLabel = isCollectionAssembled
        ? "Reassemble from collections"
        : "Regenerate Full Pool";
    const onRebuild = isCollectionAssembled
        ? handleReseedFromCollections
        : handleRegeneratePool;
    const rebuilding = isCollectionAssembled ? isReseeding : false;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                    <h2 className="text-lg font-bold text-slate-800">
                        {isCollectionAssembled ? "Assessment Preview" : "Pool Review & Validation"}
                    </h2>
                    <p className="text-sm text-slate-500">
                        {isLocked
                            ? "Pool is locked — no further edits allowed."
                            : isCollectionAssembled
                              ? "Preview assembled questions (from Question Collections) before approving."
                              : "Review generated questions before approving the drive."}
                    </p>
                    {isCollectionAssembled && sourceCollections.length > 0 && (
                        <p className="mt-1 text-xs text-slate-400">
                            Sections:{" "}
                            {sourceCollections
                                .map((c) => c.section_name || c.name)
                                .join(" · ")}
                        </p>
                    )}
                </div>
                <div className="flex gap-3 flex-wrap">
                    {!isApproved && !isLocked && !isRejected && !isGeneratingPool && (
                        <>
                            <button
                                type="button"
                                onClick={onRebuild}
                                disabled={rebuilding}
                                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
                            >
                                {rebuilding ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : isCollectionAssembled ? (
                                    <Layers className="h-4 w-4" />
                                ) : (
                                    <RefreshCw className="h-4 w-4" />
                                )}
                                {rebuildLabel}
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowRejectModal(true)}
                                className="flex items-center gap-2 px-4 py-2 border border-red-200 text-red-600 rounded-xl text-sm font-bold hover:bg-red-50 transition-colors"
                            >
                                <Ban className="h-4 w-4" />
                                Reject Pool
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowApproveConfirm(true)}
                                disabled={isApproving || questions.length === 0}
                                className="flex items-center gap-2 px-6 py-2 bg-emerald-500 text-white rounded-xl text-sm font-bold hover:bg-emerald-600 disabled:opacity-50 transition-colors shadow-sm"
                            >
                                <CheckCircle className="h-4 w-4" />
                                Approve & Lock Pool
                            </button>
                        </>
                    )}
                    {isRejected && (
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 rounded-xl text-sm font-bold border border-red-200">
                                <Ban className="h-4 w-4" /> Pool Rejected
                            </div>
                            <button
                                type="button"
                                onClick={onRebuild}
                                disabled={rebuilding}
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50"
                            >
                                {rebuilding ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <RefreshCw className="h-4 w-4" />
                                )}
                                {isCollectionAssembled ? "Reassemble" : "Regenerate Pool"}
                            </button>
                        </div>
                    )}
                    {isApproved && (
                        <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl text-sm font-bold border border-emerald-200">
                            <Lock className="h-4 w-4" /> Pool Approved & Locked
                        </div>
                    )}
                </div>
            </div>

            {isRejected && poolData.rejection_reason && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-2xl">
                    <p className="text-sm font-bold text-red-700 mb-1">Rejection Reason</p>
                    <p className="text-sm text-red-600">{poolData.rejection_reason}</p>
                </div>
            )}

            {isApproved && poolData.approved_at && (
                <div className="flex items-center gap-4 p-3 bg-emerald-50 border border-emerald-100 rounded-2xl text-sm">
                    <Lock className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span className="text-emerald-700">
                        Approved on{" "}
                        <strong>
                            {new Date(poolData.approved_at).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                            })}
                        </strong>
                        {poolData.approver_name && (
                            <>
                                {" "}
                                by <strong>{poolData.approver_name}</strong>
                            </>
                        )}
                        {" — "}
                        {questions.filter((q: any) => q.status === "approved").length} questions
                        locked
                    </span>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-xs font-bold text-slate-500 uppercase">Total Questions</p>
                    <p className="text-2xl font-black text-slate-800 mt-1">{questions.length}</p>
                    {isGeneratingPool && (
                        <p className="text-xs text-indigo-500 font-medium mt-1 flex items-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" /> Generating...
                        </p>
                    )}
                    {isCollectionAssembled && !isGeneratingPool && (
                        <p className="text-xs text-slate-400 mt-1">From Question Collections</p>
                    )}
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-xs font-bold text-slate-500 uppercase">Validation Score</p>
                    <p
                        className={`text-2xl font-black mt-1 ${
                            validationScore === null
                                ? "text-slate-400"
                                : validationScore >= 80
                                  ? "text-indigo-600"
                                  : validationScore >= 60
                                    ? "text-amber-600"
                                    : "text-red-600"
                        }`}
                    >
                        {validationScore !== null ? `${validationScore}%` : "—"}
                    </p>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-xs font-bold text-slate-500 uppercase">Duplicate %</p>
                    <p
                        className={`text-2xl font-black mt-1 ${
                            duplicatePct === 0 ? "text-emerald-600" : "text-amber-600"
                        }`}
                    >
                        {duplicatePct}%
                    </p>
                    {duplicateCount > 0 && (
                        <p className="text-xs text-amber-500 font-medium mt-1">
                            {duplicateCount} duplicate(s) flagged
                        </p>
                    )}
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-xs font-bold text-slate-500 uppercase">Status</p>
                    <p className="text-lg font-bold text-slate-800 mt-1 capitalize">
                        {poolData.status}
                    </p>
                </div>
            </div>

            {(Object.keys(skillDist).length > 0 || Object.keys(diffDist).length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.keys(skillDist).length > 0 && (
                        <div className="bg-white border border-slate-200 rounded-2xl p-5">
                            <div className="flex items-center gap-2 mb-4">
                                <Target className="h-4 w-4 text-indigo-500" />
                                <h3 className="text-sm font-bold text-slate-700 uppercase">
                                    {isCollectionAssembled ? "Section Mix" : "Skill Distribution"}
                                </h3>
                            </div>
                            <div className="space-y-3">
                                {Object.entries(skillDist).map(([skill, data]) => (
                                    <div key={skill}>
                                        <div className="flex items-center justify-between text-xs mb-1">
                                            <span className="font-medium text-slate-600 truncate max-w-[160px]">
                                                {skill}
                                            </span>
                                            <span className="text-slate-400">
                                                {data.actual_count} ({data.actual_pct}%)
                                            </span>
                                        </div>
                                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                            <div
                                                className="h-full rounded-full bg-indigo-500 transition-all"
                                                style={{
                                                    width: `${Math.min(data.actual_pct, 100)}%`,
                                                }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {Object.keys(diffDist).length > 0 && (
                        <div className="bg-white border border-slate-200 rounded-2xl p-5">
                            <div className="flex items-center gap-2 mb-4">
                                <BarChart3 className="h-4 w-4 text-indigo-500" />
                                <h3 className="text-sm font-bold text-slate-700 uppercase">
                                    Difficulty Mix
                                </h3>
                            </div>
                            <div className="space-y-3">
                                {Object.entries(diffDist).map(([level, data]) => {
                                    const colors: Record<string, string> = {
                                        easy: "bg-emerald-500",
                                        medium: "bg-amber-500",
                                        hard: "bg-red-500",
                                    };
                                    return (
                                        <div key={level}>
                                            <div className="flex items-center justify-between text-xs mb-1">
                                                <span className="font-medium text-slate-600 capitalize">
                                                    {level}
                                                </span>
                                                <span className="text-slate-400">
                                                    {data.actual_count} ({data.actual_pct}%){" "}
                                                    <span className="text-slate-300">/</span>{" "}
                                                    {data.target_pct}% target
                                                </span>
                                            </div>
                                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all ${colors[level] || "bg-slate-400"}`}
                                                    style={{
                                                        width: `${Math.min(data.actual_pct, 100)}%`,
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {isGeneratingPool && (
                <div className="flex items-center gap-3 p-4 bg-indigo-50 border border-indigo-100 rounded-2xl">
                    <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
                    <div>
                        <p className="text-sm font-bold text-indigo-700">Pool generation in progress</p>
                        <p className="text-xs text-indigo-500">
                            {poolData.total_generated || 0} questions generated so far. This page will
                            auto-refresh.
                        </p>
                    </div>
                </div>
            )}

            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="p-4 text-xs font-bold text-slate-500 uppercase">
                                Question
                            </th>
                            <th className="p-4 text-xs font-bold text-slate-500 uppercase w-32">
                                {isCollectionAssembled ? "Section" : "Skill"}
                            </th>
                            <th className="p-4 text-xs font-bold text-slate-500 uppercase w-24">
                                Diff
                            </th>
                            <th className="p-4 text-xs font-bold text-slate-500 uppercase w-24">
                                Status
                            </th>
                            <th className="p-4 text-xs font-bold text-slate-500 uppercase w-32 text-right">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {questions.map((q: any) => (
                            <tr
                                key={q.id}
                                className={`hover:bg-slate-50/50 transition-colors ${q.status === "duplicate" ? "bg-amber-50/60" : ""}`}
                            >
                                <td className="p-4">
                                    <div className="line-clamp-2 text-sm text-slate-700">
                                        {q.status === "duplicate" && (
                                            <span className="inline-block mr-1.5 px-1.5 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-700 rounded">
                                                DUP
                                            </span>
                                        )}
                                        {q.question_text}
                                    </div>
                                </td>
                                <td className="p-4">
                                    <span className="inline-flex items-center px-2 py-1 rounded bg-slate-100 text-slate-600 text-xs font-medium truncate max-w-[120px]">
                                        {q.skill || "General"}
                                    </span>
                                </td>
                                <td className="p-4 text-sm capitalize text-slate-600">
                                    {q.difficulty || "Medium"}
                                </td>
                                <td className="p-4">
                                    <span
                                        className={`inline-flex items-center gap-1 text-xs font-bold ${
                                            q.status === "approved"
                                                ? "text-emerald-600"
                                                : q.status === "rejected"
                                                  ? "text-red-500"
                                                  : "text-amber-500"
                                        }`}
                                    >
                                        {q.status === "approved" && (
                                            <CheckCircle className="h-3 w-3" />
                                        )}
                                        {q.status === "rejected" && (
                                            <XCircle className="h-3 w-3" />
                                        )}
                                        {q.status === "pending" && (
                                            <AlertCircle className="h-3 w-3" />
                                        )}
                                        <span className="capitalize">{q.status}</span>
                                    </span>
                                </td>
                                <td className="p-4 text-right">
                                    <div className="flex justify-end gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setSelectedQuestion(q)}
                                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                            title="View Details"
                                        >
                                            <Eye className="h-4 w-4" />
                                        </button>
                                        {!isApproved && !isLocked && (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        handleUpdateQuestionStatus(q.id, "approved")
                                                    }
                                                    className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                                    title="Approve"
                                                >
                                                    <Check className="h-4 w-4" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        handleUpdateQuestionStatus(q.id, "rejected")
                                                    }
                                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="Reject"
                                                >
                                                    <XCircle className="h-4 w-4" />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {questions.length === 0 && (
                    <p className="p-8 text-center text-sm text-slate-400">
                        No questions in pool yet.
                    </p>
                )}
            </div>

            {selectedQuestion && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
                    <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white">
                            <h3 className="text-xl font-bold text-slate-800">Question Preview</h3>
                            <button
                                type="button"
                                onClick={() => setSelectedQuestion(null)}
                                className="p-2 text-slate-400 hover:bg-slate-100 rounded-full"
                                title="Close"
                            >
                                <XCircle className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-6">
                            <div>
                                <h4 className="text-sm font-bold text-slate-500 uppercase mb-2">
                                    Question Text
                                </h4>
                                <div className="bg-slate-50 p-4 rounded-xl text-slate-800 text-sm border border-slate-100">
                                    {selectedQuestion.question_text}
                                </div>
                            </div>

                            {selectedQuestion.options && (
                                <div>
                                    <h4 className="text-sm font-bold text-slate-500 uppercase mb-2">
                                        Options
                                    </h4>
                                    <div className="space-y-2">
                                        {(
                                            Object.entries(
                                                typeof selectedQuestion.options === "string"
                                                    ? JSON.parse(selectedQuestion.options)
                                                    : selectedQuestion.options
                                            ) as [string, any][]
                                        ).map(([key, opt]) => (
                                            <div
                                                key={key}
                                                className={`p-3 rounded-xl border text-sm ${
                                                    selectedQuestion.correct_answer === key
                                                        ? "bg-emerald-50 border-emerald-200 text-emerald-800 font-medium"
                                                        : "bg-white border-slate-200 text-slate-700"
                                                }`}
                                            >
                                                <span className="font-bold mr-2">
                                                    {key.toUpperCase()}.
                                                </span>{" "}
                                                {typeof opt === "object" ? opt?.text ?? String(opt) : opt}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <h4 className="text-sm font-bold text-slate-500 uppercase mb-1">
                                        {isCollectionAssembled ? "Section" : "Skill"}
                                    </h4>
                                    <p className="text-sm text-slate-800">
                                        {selectedQuestion.skill || "General"}
                                    </p>
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-slate-500 uppercase mb-1">
                                        Difficulty
                                    </h4>
                                    <p className="text-sm text-slate-800 capitalize">
                                        {selectedQuestion.difficulty || "Medium"}
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end">
                            <button
                                type="button"
                                onClick={() => setSelectedQuestion(null)}
                                className="px-6 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showApproveConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
                    <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl">
                        <div className="p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-3 bg-emerald-100 rounded-2xl">
                                    <Lock className="h-6 w-6 text-emerald-600" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-800">
                                        Approve & Lock Pool?
                                    </h3>
                                    <p className="text-sm text-slate-500">This action cannot be undone</p>
                                </div>
                            </div>
                            <div className="bg-slate-50 rounded-xl p-4 mb-4 space-y-2 text-sm text-slate-600">
                                <p>
                                    <strong>
                                        {
                                            questions.filter(
                                                (q: any) =>
                                                    q.status !== "duplicate" &&
                                                    q.status !== "rejected"
                                            ).length
                                        }
                                    </strong>{" "}
                                    questions will be approved
                                </p>
                                {duplicateCount > 0 && (
                                    <p>
                                        <strong>{duplicateCount}</strong> duplicate(s) will remain
                                        flagged
                                    </p>
                                )}
                                {validationScore !== null && (
                                    <p>
                                        Validation score: <strong>{validationScore}%</strong>
                                    </p>
                                )}
                                <p className="text-amber-600 font-medium mt-2">
                                    Once locked, questions cannot be edited, added, or removed.
                                </p>
                                <p className="text-slate-500 text-xs pt-1">
                                    After approve: Mark Ready → Schedule → Publish.
                                </p>
                            </div>
                        </div>
                        <div className="p-4 border-t border-slate-100 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setShowApproveConfirm(false)}
                                className="px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleApprovePool}
                                disabled={isApproving}
                                className="flex items-center gap-2 px-6 py-2.5 bg-emerald-500 text-white rounded-xl text-sm font-bold hover:bg-emerald-600 disabled:opacity-50 transition-colors shadow-sm"
                            >
                                {isApproving ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Lock className="h-4 w-4" />
                                )}
                                Confirm Approve & Lock
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showRejectModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
                    <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl">
                        <div className="p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-3 bg-red-100 rounded-2xl">
                                    <Ban className="h-6 w-6 text-red-600" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-800">Reject Pool?</h3>
                                    <p className="text-sm text-slate-500">
                                        Drive will revert to draft status
                                    </p>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">
                                    Reason (optional)
                                </label>
                                <textarea
                                    value={rejectReason}
                                    onChange={(e) => setRejectReason(e.target.value)}
                                    placeholder="Describe why this pool is being rejected..."
                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400 resize-none"
                                    rows={3}
                                />
                            </div>
                        </div>
                        <div className="p-4 border-t border-slate-100 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowRejectModal(false);
                                    setRejectReason("");
                                }}
                                className="px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleRejectPool}
                                disabled={isRejecting}
                                className="flex items-center gap-2 px-6 py-2.5 bg-red-500 text-white rounded-xl text-sm font-bold hover:bg-red-600 disabled:opacity-50 transition-colors shadow-sm"
                            >
                                {isRejecting ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Ban className="h-4 w-4" />
                                )}
                                Confirm Reject
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
