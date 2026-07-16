/**
 * Sprint 2.4 — Student Documents panel (upload / replace / preview / download / delete).
 */
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Download,
  Eye,
  FileText,
  Image as ImageIcon,
  Trash2,
  Upload,
  Replace,
  X,
  History,
} from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import campusStudentsService, {
  type StudentDocType,
  type StudentDocumentSlot,
} from "../../services/campusStudentsService";

interface Props {
  studentId: string;
  canWrite: boolean;
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function StudentDocumentsPanel({ studentId, canWrite }: Props) {
  const qc = useQueryClient();
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [preview, setPreview] = useState<{
    url: string;
    mime: string;
    name: string;
  } | null>(null);
  const [busyType, setBusyType] = useState<StudentDocType | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["college-student-documents", studentId],
    queryFn: () => campusStudentsService.listDocuments(studentId),
  });

  const uploadMutation = useMutation({
    mutationFn: ({ docType, file }: { docType: StudentDocType; file: File }) =>
      campusStudentsService.uploadDocument(studentId, docType, file),
    onSuccess: (res) => {
      toast.success(res.replaced ? "Document replaced (prior version kept)" : "Document uploaded");
      qc.invalidateQueries({ queryKey: ["college-student-documents", studentId] });
      qc.invalidateQueries({ queryKey: ["college-portal-student", studentId] });
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      toast.error(err?.response?.data?.error ?? "Upload failed");
    },
    onSettled: () => setBusyType(null),
  });

  const deleteMutation = useMutation({
    mutationFn: (docId: string) => campusStudentsService.deleteDocument(studentId, docId),
    onSuccess: () => {
      toast.success("Document deleted");
      qc.invalidateQueries({ queryKey: ["college-student-documents", studentId] });
      qc.invalidateQueries({ queryKey: ["college-portal-student", studentId] });
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      toast.error(err?.response?.data?.error ?? "Delete failed");
    },
  });

  const onPick = (docType: StudentDocType, file: File | undefined) => {
    if (!file) return;
    setBusyType(docType);
    uploadMutation.mutate({ docType, file });
  };

  const onDownload = async (docId: string, name: string) => {
    try {
      await campusStudentsService.downloadDocument(studentId, docId, name);
    } catch {
      toast.error("Download failed");
    }
  };

  const onPreview = async (docId: string, mime: string, name: string) => {
    try {
      const blob = await campusStudentsService.previewDocumentBlob(studentId, docId);
      if (preview?.url) URL.revokeObjectURL(preview.url);
      const url = URL.createObjectURL(blob);
      setPreview({ url, mime, name });
    } catch {
      toast.error("Preview failed");
    }
  };

  const closePreview = () => {
    if (preview?.url) URL.revokeObjectURL(preview.url);
    setPreview(null);
  };

  if (isLoading) {
    return <div className="h-48 animate-pulse rounded-xl bg-gray-100" />;
  }

  if (isError || !data) {
    return (
      <p className="rounded-lg border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
        Could not load documents.
      </p>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {!canWrite && (
          <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            View only — you can preview and download documents.
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          {data.documents.map((slot) => (
            <DocumentCard
              key={slot.doc_type}
              slot={slot}
              canWrite={canWrite}
              busy={busyType === slot.doc_type && uploadMutation.isPending}
              inputRef={(el) => {
                fileRefs.current[slot.doc_type] = el;
              }}
              onBrowse={() => fileRefs.current[slot.doc_type]?.click()}
              onFile={(f) => onPick(slot.doc_type, f)}
              onPreview={onPreview}
              onDownload={onDownload}
              onDelete={(id) => {
                if (confirm("Delete this document? Prior versions remain available if present.")) {
                  deleteMutation.mutate(id);
                }
              }}
            />
          ))}
        </div>
      </div>

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <p className="truncate text-sm font-medium text-gray-900">{preview.name}</p>
              <button type="button" onClick={closePreview} aria-label="Close preview">
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>
            <div className="flex-1 overflow-auto bg-slate-50 p-4">
              {preview.mime.startsWith("image/") ? (
                <img
                  src={preview.url}
                  alt={preview.name}
                  className="mx-auto max-h-[70vh] max-w-full object-contain"
                />
              ) : preview.mime === "application/pdf" ? (
                <iframe title={preview.name} src={preview.url} className="h-[70vh] w-full rounded border border-gray-200 bg-white" />
              ) : (
                <p className="text-center text-sm text-gray-500">
                  Preview not available for this file type. Use Download instead.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function DocumentCard({
  slot,
  canWrite,
  busy,
  inputRef,
  onBrowse,
  onFile,
  onPreview,
  onDownload,
  onDelete,
}: {
  slot: StudentDocumentSlot;
  canWrite: boolean;
  busy: boolean;
  inputRef: (el: HTMLInputElement | null) => void;
  onBrowse: () => void;
  onFile: (f: File | undefined) => void;
  onPreview: (id: string, mime: string, name: string) => void;
  onDownload: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}) {
  const current = slot.current;
  const Icon = slot.doc_type === "photo" ? ImageIcon : FileText;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="flex items-start gap-2">
          <Icon className="mt-0.5 h-4 w-4 text-admin-accent" />
          <div>
            <CardTitle className="text-sm font-semibold">{slot.label}</CardTitle>
            <p className="mt-0.5 text-[11px] text-gray-400">{slot.rules}</p>
          </div>
        </div>
        {current ? (
          <Badge variant="success">v{current.version}</Badge>
        ) : (
          <Badge variant="muted">Empty</Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {current ? (
          <div className="rounded-lg border border-gray-100 bg-slate-50 px-3 py-2">
            <p className="truncate text-sm font-medium text-gray-800">{current.original_name}</p>
            <p className="mt-0.5 text-xs text-gray-500">
              {formatBytes(current.file_size)} · {formatDate(current.created_at)}
            </p>
          </div>
        ) : (
          <p className="text-sm text-gray-400">No file uploaded yet.</p>
        )}

        <div className="flex flex-wrap gap-2">
          {current && current.previewable && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onPreview(current.id, current.mime_type, current.original_name)}
            >
              <Eye className="h-3.5 w-3.5" />
              Preview
            </Button>
          )}
          {current && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onDownload(current.id, current.original_name)}
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </Button>
          )}
          {canWrite && (
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onBrowse}>
              {current ? (
                <>
                  <Replace className="h-3.5 w-3.5" />
                  {busy ? "Uploading…" : "Replace"}
                </>
              ) : (
                <>
                  <Upload className="h-3.5 w-3.5" />
                  {busy ? "Uploading…" : "Upload"}
                </>
              )}
            </Button>
          )}
          {canWrite && current && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="text-rose-600 hover:text-rose-700"
              onClick={() => onDelete(current.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            onFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />

        {slot.history.length > 0 && (
          <div className="border-t border-gray-100 pt-2">
            <p className="mb-1 flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-gray-400">
              <History className="h-3 w-3" /> Prior versions
            </p>
            <ul className="space-y-1">
              {slot.history.slice(0, 3).map((h) => (
                <li
                  key={h.id}
                  className="flex items-center justify-between gap-2 text-xs text-gray-500"
                >
                  <span className="truncate">
                    v{h.version} · {h.original_name}
                  </span>
                  <button
                    type="button"
                    className="shrink-0 text-admin-accent hover:underline"
                    onClick={() => onDownload(h.id, h.original_name)}
                  >
                    Download
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
