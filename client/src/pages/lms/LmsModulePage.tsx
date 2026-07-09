import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  CheckCircle2,
  Clock,
  GraduationCap,
  Layers,
  PlayCircle,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import platformModulesService, {
  type LmsModuleContent,
  type ModuleCourse,
  type ModulePracticeTopic,
} from "../../services/platformModulesService";
import { featureLabel } from "../../constants/platformFeatures";
import { moduleIcon } from "../../constants/lmsModules";
import { Badge } from "../../components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";

interface LmsModulePageProps {
  portal: "college" | "student";
}

const DIFFICULTY_STYLES: Record<string, string> = {
  beginner: "bg-emerald-50 text-emerald-700",
  intermediate: "bg-amber-50 text-amber-700",
  advanced: "bg-rose-50 text-rose-700",
};

function topicLabel(topic: string): string {
  return topic
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function CourseCard({ course, portal }: { course: ModuleCourse; portal: "college" | "student" }) {
  const navigate = useNavigate();
  const enrolled = course.enrollment_status != null;
  const completed = course.enrollment_status === "completed";
  const progress = Math.round(course.progress_percent ?? 0);
  const diffCls = DIFFICULTY_STYLES[course.difficulty] ?? "bg-slate-100 text-slate-600";

  const cta = portal === "student" ? (completed ? "Review" : enrolled ? "Continue" : "Start course") : "View course";

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${diffCls}`}>
            {course.difficulty}
          </span>
          {completed && (
            <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
              <CheckCircle2 className="h-3.5 w-3.5" /> Completed
            </span>
          )}
        </div>
        <CardTitle className="text-base leading-snug">{course.title}</CardTitle>
        {course.description && (
          <CardDescription className="line-clamp-2">{course.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="mt-auto space-y-3">
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <Layers className="h-3.5 w-3.5" /> {course.total_modules} modules
          </span>
          {course.duration_hours != null && (
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" /> {course.duration_hours}h
            </span>
          )}
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" /> {course.enrollment_count}
          </span>
        </div>

        {portal === "student" && enrolled && !completed && (
          <div>
            <div className="mb-1 flex justify-between text-xs text-gray-500">
              <span>Progress</span>
              <span>{progress}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-gray-100">
              <div
                className="h-1.5 rounded-full bg-admin-accent"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        <button
          onClick={() => navigate(`/app/lms/courses/${course.id}`)}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-admin-accent px-3 py-2 text-sm font-medium text-white transition hover:opacity-90"
        >
          <PlayCircle className="h-4 w-4" />
          {cta}
        </button>
      </CardContent>
    </Card>
  );
}

function PracticeTopicCard({
  topic,
  portal,
}: {
  topic: ModulePracticeTopic;
  portal: "college" | "student";
}) {
  const navigate = useNavigate();
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium text-gray-900">{topicLabel(topic.topic)}</p>
          <p className="mt-0.5 text-xs text-gray-500">{topic.total_questions} questions</p>
        </div>
        <Target className="h-5 w-5 text-admin-accent" />
      </div>
      <div className="mt-3 flex gap-2 text-xs">
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">
          {topic.easy} easy
        </span>
        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">
          {topic.medium} medium
        </span>
        <span className="rounded-full bg-rose-50 px-2 py-0.5 text-rose-700">
          {topic.hard} hard
        </span>
      </div>
      {portal === "student" && (
        <>
          {topic.sessions_completed != null && topic.sessions_completed > 0 && (
            <p className="mt-2 text-xs text-gray-500">
              {topic.sessions_completed} session{topic.sessions_completed === 1 ? "" : "s"} completed
              {topic.avg_score != null && <> · avg {topic.avg_score}%</>}
            </p>
          )}
          <button
            onClick={() => navigate("/app/student-portal/practice")}
            className="mt-3 w-full rounded-lg border border-admin-accent/30 px-3 py-1.5 text-sm font-medium text-admin-accent transition hover:bg-admin-accent/5"
          >
            Practice now
          </button>
        </>
      )}
    </div>
  );
}

function StatTile({ icon: Icon, label, value }: { icon: typeof BookOpen; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-admin-accent/10 text-admin-accent">
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div>
        <p className="text-lg font-semibold leading-tight text-gray-900">{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  );
}

/** Landing page for an enabled LMS module group (college or student portal). */
export default function LmsModulePage({ portal }: LmsModulePageProps) {
  const { moduleKey } = useParams<{ moduleKey: string }>();

  const { data, isLoading, error } = useQuery<LmsModuleContent>({
    queryKey: ["lms-module-content", moduleKey],
    queryFn: () => platformModulesService.getLmsModuleContent(moduleKey!),
    enabled: !!moduleKey,
    staleTime: 60_000,
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 px-4 py-8 sm:px-6">
        <div className="h-16 animate-pulse rounded-2xl bg-gray-100" />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="h-48 animate-pulse rounded-2xl bg-gray-100" />
          <div className="h-48 animate-pulse rounded-2xl bg-gray-100" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center text-gray-500">
        Module not found or not enabled for your campus.
      </div>
    );
  }

  const { module: mod, courses, practice_topics: practiceTopics, student } = data;
  const Icon = moduleIcon(mod.icon);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <div className="flex items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-admin-accent/10 text-admin-accent">
          <Icon className="h-7 w-7" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">{mod.name}</h1>
          <p className="mt-1 text-gray-500">
            {mod.description ?? "Learning module group assigned to your campus."}
          </p>
        </div>
      </div>

      {portal === "student" && student && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            icon={GraduationCap}
            label="Courses enrolled"
            value={`${student.enrolled_courses}${student.completed_courses > 0 ? ` (${student.completed_courses} done)` : ""}`}
          />
          <StatTile icon={BookOpen} label="Lessons completed" value={String(student.lessons_completed)} />
          <StatTile icon={Target} label="Practice sessions" value={String(student.practice_sessions)} />
          <StatTile
            icon={TrendingUp}
            label="Avg practice score"
            value={student.avg_practice_score != null ? `${student.avg_practice_score}%` : "—"}
          />
        </div>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Courses</h2>
        {courses.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
            No published courses in this module yet.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((c) => (
              <CourseCard key={c.id} course={c} portal={portal} />
            ))}
          </div>
        )}
      </section>

      {practiceTopics.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            {portal === "student" ? "Practice Arena" : "Question Bank Coverage"}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {practiceTopics.map((t) => (
              <PracticeTopicCard key={t.topic} topic={t} portal={portal} />
            ))}
          </div>
        </section>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-4 w-4 text-admin-accent" />
            Included capabilities
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {mod.features.map((f) => (
              <Badge key={f} variant="info">
                {featureLabel(f)}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
