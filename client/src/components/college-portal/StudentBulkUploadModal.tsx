/**
 * Sprint 2.3 — Student Bulk Upload wizard.
 */
import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Download,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  X,
  RefreshCw,
} from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import campusStudentsService, {
  type BulkImportResult,
  type ValidatedBulkRow,
  type BulkValidateResult,
} from "../../services/campusStudentsService";

type Step = "upload" | "preview" | "summary";

interface Props {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

export default function StudentBulkUploadModal({ open, onClose, onImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [validated, setValidated] = useState<BulkValidateResult | null>(null);
  const [importResult, setImportResult] = useState<BulkImportResult | null>(null);
  const [retryRows, setRetryRows] = useState<ValidatedBulkRow[]>([]);

  const reset = () => {
    setStep("upload");
    setFileName("");
    setValidated(null);
    setImportResult(null);
    setRetryRows([]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const close = () => {
    reset();
    onClose();
  };

  const validateMutation = useMutation({
    mutationFn: (file: File) => campusStudentsService.bulkValidate(file),
    onSuccess: (data) => {
      setValidated(data);
      setStep("preview");
      toast.success(`Validated ${data.summary.total} row(s)`);
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      toast.error(err?.response?.data?.error ?? "Validation failed");
    },
  });

  const importMutation = useMutation({
    mutationFn: (rows: ValidatedBulkRow[]) => campusStudentsService.bulkImportRows(rows),
    onSuccess: (data) => {
      setImportResult(data);
      setStep("summary");
      onImported();
      toast.success(
        `Imported ${data.summary.successful} · Failed ${data.summary.failed} · Skipped ${data.summary.skipped}`
      );
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      toast.error(err?.response?.data?.error ?? "Import failed");
    },
  });

  if (!open) return null;

  const onFile = (file: File | undefined) => {
    if (!file) return;
    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".xlsx") && !lower.endsWith(".xls")) {
      toast.error("Upload an Excel file (.xlsx or .xls)");
      return;
    }
    setFileName(file.name);
    validateMutation.mutate(file);
  };

  const downloadTemplate = async () => {
    try {
      await campusStudentsService.downloadBulkTemplate();
    } catch {
      toast.error("Could not download template");
    }
  };

  const downloadErrors = async () => {
    const failed = importResult?.failed ?? [];
    if (!failed.length) {
      toast.error("No failed rows to export");
      return;
    }
    try {
      await campusStudentsService.downloadBulkErrorReport(failed);
    } catch {
      toast.error("Could not download error report");
    }
  };

  const retryFailed = () => {
    if (!importResult?.failed.length || !validated) {
      toast.error("Nothing to retry");
      return;
    }
    // Rebuild ok rows from failed data for re-import attempt (user may have fixed nothing —
    // still useful after fixing duplicates in DB or correcting via re-upload).
    // Better UX: put failed rows back into preview as editable status=ok after stripping
    // transient errors, and let user re-import. For now re-validate by rebuilding rows
    // marked ok from failed payloads (user should re-upload after fixing file).
    const rows: ValidatedBulkRow[] = importResult.failed.map((f) => {
      const original = validated.rows.find((r) => r.row_number === f.row_number);
      return {
        row_number: f.row_number,
        status: "ok" as const,
        errors: [],
        data: original?.data ?? {
          roll_number: f.roll_number,
          register_number: "",
          name: "",
          gender: "",
          dob: "",
          email: f.email,
          phone_number: "",
          department: "",
          program: "",
          batch: "",
          semester: "",
          section: "",
          academic_year: "",
          cgpa: "",
          placement_eligible: "",
          placement_status: "Not Shortlisted",
        },
      };
    });
    // Only retry rows that still have full data from validation
    const usable = rows.filter((r) => r.data.name && r.data.department && r.data.batch);
    if (!usable.length) {
      toast.error("Re-upload a corrected Excel file to retry failed rows.");
      setStep("upload");
      return;
    }
    setRetryRows(usable);
    importMutation.mutate(usable);
  };

  const okRows = validated?.rows.filter((r) => r.status === "ok") ?? [];
  const previewRows = validated?.rows ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Bulk Upload Students</h2>
            <p className="text-sm text-gray-500">
              {step === "upload" && "Download template, then upload Excel"}
              {step === "preview" && "Review validation results before import"}
              {step === "summary" && "Import complete"}
            </p>
          </div>
          <button type="button" onClick={close} aria-label="Close">
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {step === "upload" && (
            <div className="space-y-5">
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={downloadTemplate}>
                  <Download className="h-4 w-4" />
                  Download Sample Template
                </Button>
              </div>

              <div
                className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-slate-50 px-6 py-12 text-center transition-colors hover:border-admin-accent/40"
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  onFile(e.dataTransfer.files?.[0]);
                }}
              >
                <FileSpreadsheet className="mb-3 h-10 w-10 text-admin-accent" />
                <p className="text-sm font-medium text-gray-800">
                  {validateMutation.isPending
                    ? "Validating…"
                    : fileName
                      ? fileName
                      : "Drop Excel here or click to browse"}
                </p>
                <p className="mt-1 text-xs text-gray-500">.xlsx or .xls · max 5MB · up to 500 rows</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                  className="hidden"
                  onChange={(e) => onFile(e.target.files?.[0])}
                />
              </div>
            </div>
          )}

          {step === "preview" && validated && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Total" value={validated.summary.total} />
                <Stat label="Valid" value={validated.summary.ok} tone="success" />
                <Stat label="Errors" value={validated.summary.error} tone="danger" />
                <Stat label="Skip" value={validated.summary.skip} tone="muted" />
              </div>

              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-3 py-2">Row</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Roll</th>
                      <th className="px-3 py-2">Name</th>
                      <th className="px-3 py-2">Email</th>
                      <th className="px-3 py-2">Issues</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.slice(0, 100).map((r) => (
                      <tr key={r.row_number} className="border-t border-gray-100">
                        <td className="px-3 py-2 tabular-nums text-gray-500">{r.row_number}</td>
                        <td className="px-3 py-2">
                          <Badge
                            variant={
                              r.status === "ok"
                                ? "success"
                                : r.status === "skip"
                                  ? "muted"
                                  : "danger"
                            }
                          >
                            {r.status}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 font-medium">{r.data.roll_number || "—"}</td>
                        <td className="px-3 py-2">{r.data.name || "—"}</td>
                        <td className="px-3 py-2 text-gray-600">{r.data.email || "—"}</td>
                        <td className="px-3 py-2 text-xs text-rose-600">
                          {r.errors.join("; ") || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {previewRows.length > 100 && (
                  <p className="border-t border-gray-100 px-3 py-2 text-xs text-gray-500">
                    Showing first 100 of {previewRows.length} rows
                  </p>
                )}
              </div>
            </div>
          )}

          {step === "summary" && importResult && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
                <div>
                  <p className="text-sm font-medium text-emerald-900">Import finished</p>
                  <p className="text-sm text-emerald-800">
                    {importResult.summary.successful} created successfully
                    {retryRows.length > 0 ? ` (including retry batch)` : ""}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Total Records" value={importResult.summary.total} />
                <Stat label="Successful" value={importResult.summary.successful} tone="success" />
                <Stat label="Failed" value={importResult.summary.failed} tone="danger" />
                <Stat label="Skipped" value={importResult.summary.skipped} tone="muted" />
              </div>

              {importResult.failed.length > 0 && (
                <div className="rounded-lg border border-rose-100 bg-rose-50/50 px-4 py-3">
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium text-rose-800">
                    <AlertTriangle className="h-4 w-4" />
                    Failed rows
                  </div>
                  <ul className="max-h-40 space-y-1 overflow-y-auto text-xs text-rose-700">
                    {importResult.failed.slice(0, 50).map((f) => (
                      <li key={f.row_number}>
                        Row {f.row_number}: {f.roll_number || f.email} — {f.errors.join("; ")}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 px-6 py-4">
          <div className="flex gap-2">
            {step === "preview" && (
              <Button type="button" variant="outline" onClick={() => setStep("upload")}>
                <Upload className="h-4 w-4" />
                Choose another file
              </Button>
            )}
            {step === "summary" && importResult && importResult.failed.length > 0 && (
              <>
                <Button type="button" variant="outline" onClick={downloadErrors}>
                  <Download className="h-4 w-4" />
                  Download Error Report
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={retryFailed}
                  disabled={importMutation.isPending}
                >
                  <RefreshCw className="h-4 w-4" />
                  Retry Failed Records
                </Button>
              </>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={close}>
              {step === "summary" ? "Close" : "Cancel"}
            </Button>
            {step === "preview" && (
              <Button
                type="button"
                disabled={!okRows.length || importMutation.isPending}
                onClick={() => importMutation.mutate(okRows)}
              >
                {importMutation.isPending
                  ? "Importing…"
                  : `Import ${okRows.length} valid record${okRows.length === 1 ? "" : "s"}`}
              </Button>
            )}
            {step === "summary" && (
              <Button
                type="button"
                onClick={() => {
                  reset();
                }}
              >
                Upload another file
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "success" | "danger" | "muted";
}) {
  const color =
    tone === "success"
      ? "text-emerald-700"
      : tone === "danger"
        ? "text-rose-700"
        : tone === "muted"
          ? "text-gray-500"
          : "text-gray-900";
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-center">
      <p className={`text-xl font-semibold tabular-nums ${color}`}>{value}</p>
      <p className="text-[11px] uppercase tracking-wide text-gray-400">{label}</p>
    </div>
  );
}
