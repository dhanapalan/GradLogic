import { useState } from "react";
import { Clock, Cloud, CloudOff, Shield, Wifi, WifiOff, MoreHorizontal } from "lucide-react";
import { cn } from "../../../../lib/utils";

type SaveState = "idle" | "saving" | "saved" | "error" | "offline";

type Props = {
  assessmentName: string;
  campaignName: string;
  studentName?: string | null;
  status: string;
  timeLeft: number;
  warningSeconds: number;
  saveState: SaveState;
  lastSavedAt?: string | null;
  offline: boolean;
  proctoringActive?: boolean;
  integrityScore?: number;
  cameraActive?: boolean;
  micActive?: boolean;
  requireCamera?: boolean;
  requireMic?: boolean;
  fullscreenOk?: boolean;
  requireFullscreen?: boolean;
};

function formatTime(totalSec: number) {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export default function WorkspaceHeader({
  assessmentName,
  campaignName,
  studentName,
  status,
  timeLeft,
  warningSeconds,
  saveState,
  lastSavedAt,
  offline,
  proctoringActive,
  integrityScore,
  cameraActive,
  micActive,
  requireCamera,
  requireMic,
  fullscreenOk,
  requireFullscreen,
}: Props) {
  const [showMore, setShowMore] = useState(false);
  const inWarning = timeLeft > 0 && timeLeft <= warningSeconds;
  const lowTime = timeLeft <= 60;

  const saveLabel =
    saveState === "saving"
      ? "Saving…"
      : saveState === "error"
        ? "Save failed"
        : saveState === "offline"
          ? "Offline"
          : saveState === "saved"
            ? "Saved"
            : "Auto-save";

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white px-3 py-2 shadow-sm pt-[max(0.5rem,env(safe-area-inset-top,0px))] sm:px-4 sm:py-3">
      {/* Compact primary row — timer + save + online */}
      <div className="mx-auto flex max-w-6xl items-center gap-2 sm:gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold text-slate-900 sm:text-base lg:text-lg">
            {assessmentName}
          </h1>
          <p className="hidden truncate text-xs text-slate-500 sm:block">
            {campaignName}
            {studentName ? ` · ${studentName}` : ""}
            <span className="ml-2 capitalize text-slate-400">· {status.replace(/_/g, " ")}</span>
          </p>
        </div>

        <div
          className={cn(
            "inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg px-2 text-[11px] font-medium sm:text-xs",
            saveState === "error" || saveState === "offline" ? "text-rose-600" : "text-slate-500"
          )}
          title={lastSavedAt ? `Last saved ${new Date(lastSavedAt).toLocaleTimeString()}` : undefined}
        >
          {saveState === "error" || saveState === "offline" ? (
            <CloudOff className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <Cloud className="h-3.5 w-3.5" aria-hidden />
          )}
          <span className="hidden xs:inline sm:inline">{saveLabel}</span>
        </div>

        <div
          className={cn(
            "inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg px-1.5 text-[11px] font-medium sm:text-xs",
            offline ? "text-rose-600" : "text-emerald-700"
          )}
          aria-live="polite"
        >
          {offline ? <WifiOff className="h-3.5 w-3.5" /> : <Wifi className="h-3.5 w-3.5" />}
          <span className="sr-only sm:not-sr-only sm:inline">{offline ? "Offline" : "Online"}</span>
        </div>

        <div
          role="timer"
          aria-live="polite"
          aria-atomic="true"
          aria-label={`Time remaining ${formatTime(timeLeft)}`}
          className={cn(
            "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 font-mono text-sm font-semibold sm:px-3",
            lowTime
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : inWarning
                ? "border-amber-200 bg-amber-50 text-amber-800"
                : "border-slate-200 bg-slate-50 text-slate-800"
          )}
        >
          <Clock className="h-4 w-4" aria-hidden />
          {formatTime(timeLeft)}
        </div>

        {(proctoringActive || requireCamera || requireMic || requireFullscreen) && (
          <button
            type="button"
            onClick={() => setShowMore((v) => !v)}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-200 text-slate-600 sm:hidden"
            aria-expanded={showMore}
            aria-label="More status details"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        )}

        {/* Desktop integrity chips */}
        {proctoringActive && (
          <div
            className="hidden items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 sm:inline-flex"
            title="Integrity monitoring is active"
          >
            <Shield className="h-3.5 w-3.5" />
            Proctoring {integrityScore != null ? integrityScore : ""}
            {requireCamera && (
              <span className={cameraActive ? "text-emerald-600" : "text-rose-600"}>· Cam</span>
            )}
            {requireMic && (
              <span className={micActive ? "text-emerald-600" : "text-rose-600"}>· Mic</span>
            )}
            {requireFullscreen && !fullscreenOk && (
              <span className="text-amber-700">· Fullscreen</span>
            )}
          </div>
        )}
      </div>

      {/* Mobile overflow integrity */}
      {showMore && (
        <div className="mx-auto mt-2 max-w-6xl rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-700 sm:hidden">
          <p className="truncate text-slate-500">
            {campaignName}
            {studentName ? ` · ${studentName}` : ""}
          </p>
          {proctoringActive && (
            <p className="mt-1 inline-flex items-center gap-1.5 font-medium">
              <Shield className="h-3.5 w-3.5" />
              Proctoring {integrityScore != null ? integrityScore : ""}
              {requireCamera && (
                <span className={cameraActive ? "text-emerald-600" : "text-rose-600"}>· Cam</span>
              )}
              {requireMic && (
                <span className={micActive ? "text-emerald-600" : "text-rose-600"}>· Mic</span>
              )}
              {requireFullscreen && !fullscreenOk && (
                <span className="text-amber-700">· Fullscreen</span>
              )}
            </p>
          )}
        </div>
      )}
    </header>
  );
}

export { formatTime };
