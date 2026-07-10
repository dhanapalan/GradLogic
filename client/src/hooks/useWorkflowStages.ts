import { useQuery } from "@tanstack/react-query";
import { BookOpenCheck, Dumbbell, ClipboardCheck, Award } from "lucide-react";
import api from "../lib/api";

/**
 * Derives the student's Learn → Practice → Test → Certify pipeline from real
 * data the platform already stores (program enrollments, practice sessions,
 * drive results, certificates). Shared by the full Workflow page and the
 * compact "Current Stage" dashboard card so both stay consistent.
 */

interface Enrollment {
  status: string;
  total_modules: number;
  completed_modules: number;
}
interface PracticeStats {
  sessions: { total_sessions: number; completed_sessions: number; avg_score: number };
}
interface Drive {
  session_status: string;
  score: number | null;
}

export interface WorkflowStage {
  key: "learn" | "practice" | "test" | "certify";
  title: string;
  icon: typeof BookOpenCheck;
  accent: "indigo" | "violet" | "amber" | "emerald";
  criterion: string;
  metric: string;
  pct: number;
  done: boolean;
  cta: { label: string; to: string };
}

export const ACCENT_CLASSES: Record<
  WorkflowStage["accent"],
  { bar: string; icon: string; ring: string }
> = {
  indigo: { bar: "bg-indigo-500", icon: "bg-indigo-50 text-indigo-500 border-indigo-100", ring: "ring-indigo-400" },
  violet: { bar: "bg-violet-500", icon: "bg-violet-50 text-violet-500 border-violet-100", ring: "ring-violet-400" },
  amber: { bar: "bg-amber-500", icon: "bg-amber-50 text-amber-600 border-amber-100", ring: "ring-amber-400" },
  emerald: { bar: "bg-emerald-500", icon: "bg-emerald-50 text-emerald-600 border-emerald-100", ring: "ring-emerald-400" },
};

export function useWorkflowStages() {
  const enrollmentsQ = useQuery({
    queryKey: ["wf-enrollments"],
    queryFn: async () => (await api.get("/student-learning/my-enrollments")).data.data as Enrollment[],
    staleTime: 60_000,
  });
  const practiceQ = useQuery({
    queryKey: ["wf-practice"],
    queryFn: async () => (await api.get("/practice/stats")).data.data as PracticeStats,
    staleTime: 60_000,
  });
  const drivesQ = useQuery({
    queryKey: ["wf-drives"],
    queryFn: async () => (await api.get("/exam-sessions/my-drives")).data.data as Drive[],
    staleTime: 60_000,
  });
  const certsQ = useQuery({
    queryKey: ["wf-certs"],
    queryFn: async () => (await api.get("/lms/certificates/my")).data.data as unknown[],
    staleTime: 60_000,
  });

  const loading =
    enrollmentsQ.isLoading || practiceQ.isLoading || drivesQ.isLoading || certsQ.isLoading;

  const enrollments = enrollmentsQ.data ?? [];
  const totalModules = enrollments.reduce((s, e) => s + (e.total_modules || 0), 0);
  const doneModules = enrollments.reduce((s, e) => s + (e.completed_modules || 0), 0);
  const learnPct = totalModules > 0 ? Math.round((doneModules / totalModules) * 100) : 0;
  const learnDone = enrollments.length > 0 && enrollments.every((e) => e.status === "completed");

  const practice = practiceQ.data?.sessions;
  const practiceDoneCount = practice?.completed_sessions ?? 0;
  const practiceAccuracy = Math.round(Number(practice?.avg_score ?? 0));
  const practicePct = Math.min(100, Math.round((practiceDoneCount / 3) * 100));
  const practiceDone = practiceDoneCount >= 3;

  const drives = drivesQ.data ?? [];
  const completedDrives = drives.filter((d) => d.session_status === "completed");
  const driveScores = completedDrives.map((d) => Number(d.score) || 0);
  const avgDriveScore = driveScores.length
    ? Math.round(driveScores.reduce((a, b) => a + b, 0) / driveScores.length)
    : 0;
  const testDone = completedDrives.length >= 1;
  const testPct = testDone ? 100 : 0;

  const certCount = (certsQ.data ?? []).length;
  const certifyDone = certCount >= 1;
  const certifyPct = certifyDone ? 100 : 0;

  const stages: WorkflowStage[] = [
    {
      key: "learn",
      title: "Learn",
      icon: BookOpenCheck,
      accent: "indigo",
      criterion: "Complete every enrolled program",
      metric:
        enrollments.length === 0
          ? "No programs enrolled yet"
          : `${doneModules}/${totalModules} modules · ${enrollments.length} program${enrollments.length !== 1 ? "s" : ""}`,
      pct: learnPct,
      done: learnDone,
      cta: { label: "Open Learning Portal", to: "/app/learn" },
    },
    {
      key: "practice",
      title: "Practice",
      icon: Dumbbell,
      accent: "violet",
      criterion: "Complete 3+ practice sets",
      metric:
        practiceDoneCount === 0
          ? "No practice sets completed yet"
          : `${practiceDoneCount} ${practiceDoneCount === 1 ? "set" : "sets"} done · ${practiceAccuracy}% accuracy`,
      pct: practicePct,
      done: practiceDone,
      cta: { label: "Go to Practice Arena", to: "/app/student-portal/practice" },
    },
    {
      key: "test",
      title: "Test",
      icon: ClipboardCheck,
      accent: "amber",
      criterion: "Complete at least one proctored drive",
      metric:
        completedDrives.length === 0
          ? "No drives completed yet"
          : `${completedDrives.length} completed · ${avgDriveScore} avg score`,
      pct: testPct,
      done: testDone,
      cta: { label: "View Exams", to: "/app/student-portal?tab=exams" },
    },
    {
      key: "certify",
      title: "Certify",
      icon: Award,
      accent: "emerald",
      criterion: "Earn at least one certificate",
      metric: certCount === 0 ? "No certificates yet" : `${certCount} certificate${certCount !== 1 ? "s" : ""} earned`,
      pct: certifyPct,
      done: certifyDone,
      cta: { label: "Course Catalog", to: "/app/lms/catalog" },
    },
  ];

  const currentIdx = stages.findIndex((s) => !s.done);
  const overallPct = Math.round(stages.reduce((s, st) => s + st.pct, 0) / stages.length);

  return { stages, currentIdx, overallPct, loading };
}
