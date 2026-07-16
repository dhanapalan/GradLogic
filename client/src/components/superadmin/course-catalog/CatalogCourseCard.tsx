import type { ReactNode } from "react";
import type { CourseStatus } from "../../services/lmsCourseService";

interface CatalogCourseCardProps {
  id: string;
  title: string;
  category: string;
  difficulty: string;
  status: CourseStatus | string;
  durationHours?: number | null;
  modules?: number;
  practice?: number;
  coding?: number;
  assessments?: number;
  enrollments?: number;
  instructorName?: string | null;
  description?: string | null;
  onOpen: (id: string) => void;
  actions?: ReactNode;
}

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  published: "bg-green-50 text-green-700",
  archived: "bg-red-50 text-red-600",
};

export default function CatalogCourseCard({
  id,
  title,
  category,
  difficulty,
  status,
  durationHours,
  modules = 0,
  practice = 0,
  coding = 0,
  assessments = 0,
  enrollments = 0,
  instructorName,
  description,
  onOpen,
  actions,
}: CatalogCourseCardProps) {
  return (
    <article className="rounded-xl border border-gray-200/70 bg-white shadow-admin-card overflow-hidden flex flex-col hover:border-admin-accent/40 hover:shadow-md transition-all">
      <button type="button" onClick={() => onOpen(id)} className="text-left p-5 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wider text-gray-400 truncate">
              {category.replace(/_/g, " ")}
            </p>
            <h3 className="mt-1 font-semibold text-gray-900 line-clamp-2">{title}</h3>
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
              STATUS_STYLES[status] || STATUS_STYLES.draft
            }`}
          >
            {status}
          </span>
        </div>
        {description ? (
          <p className="mt-2 text-sm text-gray-500 line-clamp-2">{description}</p>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-400">
          <span className="capitalize">{difficulty}</span>
          {durationHours != null ? <span>{durationHours}h</span> : null}
          <span>{modules} modules</span>
          <span>{practice} practice</span>
          <span>{coding} coding</span>
          {assessments > 0 ? <span>Mock/assessment</span> : null}
          <span>{enrollments} enrolled</span>
        </div>
        {instructorName ? (
          <p className="mt-2 text-[11px] text-gray-400">By {instructorName}</p>
        ) : null}
      </button>
      {actions ? (
        <div className="border-t border-gray-100 px-3 py-2 flex flex-wrap gap-2">{actions}</div>
      ) : null}
    </article>
  );
}
