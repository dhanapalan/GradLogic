import type { CourseStatus } from "../../services/lmsCourseService";

interface CourseCardProps {
  id: string;
  title: string;
  category: string;
  difficulty: string;
  status: CourseStatus;
  totalModules?: number;
  enrollments?: number;
  description?: string | null;
  onOpen: (id: string) => void;
}

const STATUS_STYLES: Record<CourseStatus, string> = {
  draft: "bg-gray-100 text-gray-600",
  published: "bg-green-50 text-green-700",
  archived: "bg-red-50 text-red-600",
};

export default function CourseCard({
  id,
  title,
  category,
  difficulty,
  status,
  totalModules = 0,
  enrollments = 0,
  description,
  onOpen,
}: CourseCardProps) {
  return (
    <button
      type="button"
      onClick={() => onOpen(id)}
      className="w-full text-left rounded-xl border border-gray-200/70 bg-white p-5 shadow-admin-card hover:border-admin-accent/40 hover:shadow-md transition-all"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">{title}</h3>
          <p className="mt-1 text-xs text-gray-500 capitalize">
            {category.replace(/_/g, " ")} · {difficulty}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[status]}`}>
          {status}
        </span>
      </div>
      {description ? (
        <p className="mt-2 text-sm text-gray-500 line-clamp-2">{description}</p>
      ) : null}
      <div className="mt-3 flex gap-4 text-xs text-gray-400">
        <span>{totalModules} modules</span>
        <span>{enrollments} enrolled</span>
      </div>
    </button>
  );
}
