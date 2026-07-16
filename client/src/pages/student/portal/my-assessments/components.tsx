import { Link } from "react-router-dom";
import {
  Clock,
  Play,
  RotateCcw,
  Eye,
  CalendarPlus,
  AlertTriangle,
  Loader2,
  ClipboardList,
} from "lucide-react";
import type { AssessmentHubRow } from "../../../../services/studentAssessmentsHubService";

export const BASE = "/app/student-portal/my-assessments";

export function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  const styles: Record<string, string> = {
    upcoming: "bg-sky-50 text-sky-700 border-sky-100",
    live: "bg-emerald-50 text-emerald-700 border-emerald-100",
    available: "bg-emerald-50 text-emerald-700 border-emerald-100",
    in_progress: "bg-amber-50 text-amber-800 border-amber-100",
    completed: "bg-slate-100 text-slate-700 border-slate-200",
    submitted: "bg-slate-100 text-slate-700 border-slate-200",
    missed: "bg-rose-50 text-rose-700 border-rose-100",
    expired: "bg-rose-50 text-rose-700 border-rose-100",
  };
  const label = (status || "").replace(/_/g, " ");
  return (
    <span
      className={`inline-flex rounded-lg border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
        styles[s] || "bg-slate-50 text-slate-600 border-slate-200"
      }`}
    >
      {label}
    </span>
  );
}

export function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-black text-slate-900">{value}</p>
    </div>
  );
}

export function TimelineCard({ row }: { row: AssessmentHubRow }) {
  return (
    <Link
      to={`${BASE}/${row.campaign_id}`}
      className="min-w-[200px] shrink-0 rounded-2xl border border-sky-100 bg-gradient-to-b from-sky-50 to-white p-3 shadow-sm hover:border-sky-200"
    >
      <p className="truncate text-xs font-black text-slate-900">{row.assessment_name}</p>
      <p className="truncate text-[11px] text-slate-500">{row.campaign_name}</p>
      <p className="mt-2 text-[10px] font-bold text-slate-400">{formatWhen(row.available_from)}</p>
      <div className="mt-1">
        <Countdown until={row.available_from} />
      </div>
    </Link>
  );
}

function formatDuration(seconds?: number) {
  if (seconds == null || seconds <= 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function LoadingBlock({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex h-40 items-center justify-center rounded-2xl border border-slate-100 bg-white" role="status">
      <Loader2 className="h-6 w-6 animate-spin text-indigo-500" aria-label={label} />
    </div>
  );
}

export function EmptyBlock({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center">
      <ClipboardList className="mx-auto mb-2 h-8 w-8 text-slate-300" aria-hidden />
      <p className="text-sm font-bold text-slate-500">{title}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-2xl border border-rose-100 bg-rose-50 p-5 text-sm text-rose-700" role="alert">
      <div className="flex gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="font-bold">{message}</p>
          {onRetry && (
            <button type="button" onClick={onRetry} className="mt-2 font-bold underline">
              Retry
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function Countdown({ until }: { until?: string | null }) {
  if (!until) return <span className="text-xs text-slate-400">—</span>;
  const end = new Date(until).getTime();
  const ms = end - Date.now();
  if (ms <= 0) return <span className="text-xs font-bold text-rose-600">Ended</span>;
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const d = Math.floor(h / 24);
  const label = d > 0 ? `${d}d ${h % 24}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600">
      <Clock className="h-3 w-3" aria-hidden /> {label}
    </span>
  );
}

export function formatWhen(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

type ActionHandlers = {
  onLaunch?: (row: AssessmentHubRow) => void;
  onResume?: (row: AssessmentHubRow) => void;
  busyId?: string | null;
};

export function AssessmentCard({
  row,
  onLaunch,
  onResume,
  busyId,
}: { row: AssessmentHubRow } & ActionHandlers) {
  const busy = busyId === row.campaign_id;
  return (
    <article className="flex flex-col rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-black text-slate-900">{row.assessment_name}</h3>
          <p className="truncate text-xs text-slate-500">{row.campaign_name}</p>
        </div>
        <StatusBadge status={row.display_status || row.status} />
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-slate-500">
        <div>
          <dt className="font-bold uppercase text-slate-400">Type</dt>
          <dd className="capitalize">{row.assessment_type?.replace(/_/g, " ")}</dd>
        </div>
        <div>
          <dt className="font-bold uppercase text-slate-400">Duration</dt>
          <dd>{row.duration_minutes != null ? `${row.duration_minutes} min` : "—"}</dd>
        </div>
        <div>
          <dt className="font-bold uppercase text-slate-400">Window</dt>
          <dd className="truncate">{formatWhen(row.available_from)}</dd>
        </div>
        <div>
          <dt className="font-bold uppercase text-slate-400">Attempts</dt>
          <dd>
            {row.attempts_used}/{row.max_attempts}
            {row.attempts_remaining != null ? ` (${row.attempts_remaining} left)` : ""}
          </dd>
        </div>
      </dl>
      <div className="mt-2">
        <Countdown until={row.available_until} />
      </div>
      {(row.status === "in_progress" || row.display_status === "in_progress") && (
        <dl className="mt-2 grid grid-cols-2 gap-1 text-[11px] text-slate-600">
          {row.progress_percent != null && (
            <div>
              <dt className="font-bold text-slate-400">Progress</dt>
              <dd>{row.progress_percent}%</dd>
            </div>
          )}
          {row.time_remaining_seconds != null && (
            <div>
              <dt className="font-bold text-slate-400">Time left</dt>
              <dd>{formatDuration(row.time_remaining_seconds)}</dd>
            </div>
          )}
          {row.questions_attempted != null && (
            <div>
              <dt className="font-bold text-slate-400">Answered</dt>
              <dd>{row.questions_attempted}</dd>
            </div>
          )}
          {row.auto_save_status && (
            <div>
              <dt className="font-bold text-slate-400">Auto-save</dt>
              <dd>{row.auto_save_status}</dd>
            </div>
          )}
        </dl>
      )}
      {row.start_blocked_reason && !row.can_start && !row.can_resume && (
        <p className="mt-2 text-[11px] text-amber-700">{row.start_blocked_reason}</p>
      )}
      {row.reason && (
        <p className="mt-2 text-[11px] text-rose-700">{row.reason}</p>
      )}
      {row.percentage != null && (
        <p className="mt-2 text-xs font-bold text-slate-700">
          Score {row.percentage}%
          {row.passed != null ? (row.passed ? " · Pass" : " · Fail") : ""}
        </p>
      )}
      <div className="mt-auto flex flex-wrap gap-2 pt-3">
        <Link
          to={`${BASE}/${row.campaign_id}`}
          className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
        >
          View Details
        </Link>
        {row.can_resume && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onResume?.(row)}
            className="inline-flex items-center gap-1 rounded-xl bg-amber-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Resume
          </button>
        )}
        {row.can_start && !row.can_resume && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onLaunch?.(row)}
            className="inline-flex items-center gap-1 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
          >
            <Play className="h-3.5 w-3.5" /> Start
          </button>
        )}
        {(row.status === "submitted" || row.display_status === "completed") && (
          <Link
            to={row.result_href || `${BASE}/${row.campaign_id}/result`}
            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold"
          >
            <Eye className="h-3.5 w-3.5" /> View Result
          </Link>
        )}
        {row.status === "upcoming" && (
          <a
            href={icsHref(row)}
            download={`${row.assessment_name}.ics`}
            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold"
          >
            <CalendarPlus className="h-3.5 w-3.5" /> Add to Calendar
          </a>
        )}
      </div>
    </article>
  );
}

function icsHref(row: AssessmentHubRow) {
  const start = new Date(row.available_from);
  const end = new Date(row.available_until || row.available_from);
  const fmt = (d: Date) =>
    d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "BEGIN:VEVENT",
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${row.assessment_name.replace(/\n/g, " ")}`,
    `DESCRIPTION:${row.campaign_name.replace(/\n/g, " ")}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
}

export function AssessmentRow({
  row,
  onLaunch,
  onResume,
  busyId,
}: { row: AssessmentHubRow } & ActionHandlers) {
  const busy = busyId === row.campaign_id;
  return (
    <tr className="border-b border-slate-50 text-sm">
      <td className="px-3 py-3">
        <Link to={`${BASE}/${row.campaign_id}`} className="font-bold text-slate-900 hover:text-indigo-600">
          {row.assessment_name}
        </Link>
        <p className="text-xs text-slate-400">{row.campaign_name}</p>
      </td>
      <td className="px-3 py-3 capitalize text-slate-600">{row.assessment_type?.replace(/_/g, " ")}</td>
      <td className="px-3 py-3 text-xs text-slate-500">{formatWhen(row.available_from)}</td>
      <td className="px-3 py-3">
        <Countdown until={row.available_until} />
      </td>
      <td className="px-3 py-3 text-xs">
        {row.attempts_used}/{row.max_attempts}
      </td>
      <td className="px-3 py-3">
        <StatusBadge status={row.display_status || row.status} />
      </td>
      <td className="px-3 py-3">
        <div className="flex flex-wrap gap-1.5">
          <Link to={`${BASE}/${row.campaign_id}`} className="text-xs font-bold text-indigo-600">
            Details
          </Link>
          {row.can_resume && (
            <button type="button" disabled={busy} onClick={() => onResume?.(row)} className="text-xs font-bold text-amber-700">
              Resume
            </button>
          )}
          {row.can_start && !row.can_resume && (
            <button type="button" disabled={busy} onClick={() => onLaunch?.(row)} className="text-xs font-bold text-indigo-700">
              Start
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
