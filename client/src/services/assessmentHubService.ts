/**
 * Assessment Hub — admin overview + Results & Evaluation.
 */
import api from "../lib/api";

export const ASSESSMENT_HUB_BASE = "/app/superadmin/assessment-hub";

export interface KpiTrend {
  direction: "up" | "down" | "flat";
  percent: number | null;
  label: string;
}

export interface DashboardKpi {
  value: number | null;
  trend: KpiTrend;
}

export interface AssessmentHubDashboardFilters {
  domain?: string;
  status?: string;
  drive_type?: string;
  created_by?: string;
  from?: string;
  to?: string;
}

export interface AssessmentHubDashboard {
  generatedAt: string;
  assessments: number;
  practiceTests: number;
  mockTests: number;
  codingAssessments: number;
  publishedAssessments: number;
  draftAssessments: number;
  studentsAttempted: number;
  averageScore: number | null;
  passPercent: number | null;
  placementReadiness: number | null;
  kpis: {
    assessments: DashboardKpi;
    practiceSets: DashboardKpi;
    mockTests: DashboardKpi;
    codingAssessments: DashboardKpi;
    publishedAssessments: DashboardKpi;
    draftAssessments: DashboardKpi;
    activeStudents: DashboardKpi;
    averageScore: DashboardKpi;
    placementReadiness: DashboardKpi;
  };
  charts: {
    assessmentAttempts: Array<{ day: string; label: string; count: number }>;
    averageScoreTrend: Array<{ day: string; label: string; avg_score: number }>;
    difficultyDistribution: Array<{ difficulty: string; count: number }>;
    assessmentCompletion: Array<{
      day: string;
      label: string;
      started: number;
      completed: number;
      value: number;
    }>;
    topPerformingDomains: Array<{
      domain: string;
      label: string;
      avg_score: number;
      samples: number;
    }>;
    weakDomains: Array<{
      domain: string;
      label: string;
      avg_score: number;
      samples: number;
    }>;
  };
  recentActivity: Array<{
    type: string;
    title: string;
    at: string;
    meta: string | null;
  }>;
  pending: Array<{
    type: string;
    title: string;
    meta: string | null;
    href: string | null;
  }>;
  filterOptions: {
    domains: Array<{ value: string; label: string }>;
    statuses: Array<{ value: string; label: string }>;
    assessmentTypes: Array<{ value: string; label: string }>;
    createdBy: Array<{ id: string; name: string }>;
  };
}

export interface SectionScore {
  section: string;
  attempted: number;
  correct: number;
  marks_earned: number;
  marks_available: number;
  accuracy: number;
}

export interface TimeAnalysis {
  allotted_seconds: number | null;
  spent_seconds: number | null;
  unused_seconds: number | null;
  percent_used: number | null;
  avg_seconds_per_question: number | null;
  pace_label: string | null;
  spent_label: string | null;
  allotted_label: string | null;
}

export interface AttemptEvaluation {
  session_id: string;
  drive_id: string;
  drive_name: string;
  drive_type: string | null;
  student_id: string;
  student_name: string | null;
  student_email: string | null;
  status: string;
  overall_score: number | null;
  total_marks: number | null;
  score_percent: number | null;
  accuracy: number | null;
  questions_attempted: number;
  questions_correct: number;
  questions_total: number;
  time_spent_seconds: number | null;
  time_spent_label: string | null;
  duration_minutes: number | null;
  time_analysis?: TimeAnalysis;
  section_scores: SectionScore[];
  weak_topics: string[];
  strong_topics: string[];
  recommendations: string[];
  ai_recommendations_enriched?: boolean;
  next_practice: {
    topic: string | null;
    difficulty: string | null;
    question_id: string | null;
    question_preview: string | null;
    estimated_minutes: number | null;
    practice_href: string;
  };
  recommended_lesson?: {
    id: string | null;
    title: string | null;
    source: string | null;
    href: string | null;
  } | null;
  learning_loop?: {
    evaluated: boolean;
    weak_skills_detected: boolean;
    lesson_recommended: boolean;
    practice_assigned: boolean;
    journey_updated: boolean;
    readiness_recalculated: boolean;
  } | null;
  learning_journey: {
    updated: boolean;
    journeys_touched: number;
    avg_readiness: number | null;
  };
  completed_at: string | null;
  started_at: string | null;
}

export interface EvaluationOverview {
  completedAttempts: number;
  studentsEvaluated: number;
  averageScore: number | null;
}

export interface AssessmentHubAnalytics {
  generatedAt: string;
  overview?: {
    attempts: number;
    completion_rate: number | null;
    average_score: number | null;
    pass_rate: number | null;
    questions_active: number;
    weak_skills_count: number;
    strong_skills_count: number;
    placement_readiness_avg: number | null;
  };
  reports: {
    assessment_attempts: {
      id: string;
      title: string;
      summary: {
        total: number;
        started: number;
        completed: number;
        in_progress: number;
      };
      by_type: Array<{ drive_type: string; label: string; attempts: number }>;
      daily: Array<{ day: string; label: string; count: number }>;
    };
    completion: {
      id: string;
      title: string;
      summary: {
        started: number;
        completed: number;
        rate_percent: number | null;
      };
      by_type: Array<{
        drive_type: string;
        label: string;
        started: number;
        completed: number;
        rate: number | null;
      }>;
    };
    average_score: {
      id: string;
      title: string;
      summary: { average: number | null; scored_attempts: number };
      by_type: Array<{
        drive_type: string;
        label: string;
        avg_score: number | null;
        attempts: number;
      }>;
      daily?: Array<{ day: string; label: string; avg_score: number }>;
    };
    pass_rate: {
      id: string;
      title: string;
      summary: {
        completed: number;
        passed: number;
        rate_percent: number | null;
        cutoff_default: number;
      };
      by_type: Array<{
        drive_type: string;
        label: string;
        completed: number;
        passed: number;
        rate_percent: number | null;
      }>;
    };
    question_statistics: {
      id: string;
      title: string;
      summary: {
        active: number;
        published: number;
        questions_with_attempts: number;
        avg_practice_pass_rate: number | null;
        missing_explanation: number;
        missing_hint: number;
        flagged_low_pass: number;
      };
      by_type: Array<{ type: string; label: string; count: number }>;
      by_difficulty: Array<{ difficulty: string; label: string; count: number }>;
      by_category: Array<{ category: string; label: string; count: number }>;
      flags: Array<{
        id: string;
        question_text: string;
        category: string;
        reasons: string[];
        pass_rate?: number;
        attempts?: number;
      }>;
    };
    weak_skills: {
      id: string;
      title: string;
      items: Array<{
        skill: string;
        label: string;
        attempts: number;
        accuracy: number;
      }>;
      source: string;
    };
    strong_skills: {
      id: string;
      title: string;
      items: Array<{
        skill: string;
        label: string;
        attempts: number;
        accuracy: number;
      }>;
      source: string;
    };
    placement_readiness: {
      id: string;
      title: string;
      average: number | null;
      journeys: number;
      buckets: Array<{ bucket: string; count: number; avg_readiness: number }>;
      by_domain: Array<{
        domain: string;
        label: string;
        avg_readiness: number;
        count: number;
      }>;
      trend?: Array<{ day: string; label: string; avg_readiness: number }>;
    };
    question_quality?: {
      id: string;
      title: string;
      summary: {
        published: number;
        missing_explanation: number;
        missing_hint: number;
        missing_embedding: number;
        flagged_low_pass: number;
      };
      flags: Array<{
        id: string;
        question_text: string;
        category: string;
        reasons: string[];
        pass_rate?: number;
        attempts?: number;
      }>;
    };
    ai_usage: {
      id: string;
      title: string;
      total_events: number;
      by_feature: Array<{ feature: string; count: number }>;
      last_14_days: Array<{ day: string; label: string; count: number }>;
    };
  };
}

export interface PipelineStep {
  id: string;
  title: string;
  href: string;
  status: "ok" | "warn" | "empty";
  metric_label: string;
  metric_value: number | string;
  next_action: string | null;
}

export interface AssessmentPipelineHealth {
  pipeline: string[];
  continuous_learning_loop?: string[];
  health: {
    linked_steps_ok: number;
    total_steps: number;
    collections: number;
    collections_filled: number;
    loops_completed?: number;
  };
  steps: PipelineStep[];
  loop_steps?: PipelineStep[];
}

const assessmentHubService = {
  async getDashboard(
    filters?: AssessmentHubDashboardFilters
  ): Promise<AssessmentHubDashboard> {
    const res = await api.get("/assessment-hub/dashboard", {
      params: {
        domain: filters?.domain || undefined,
        status: filters?.status || undefined,
        drive_type: filters?.drive_type || undefined,
        created_by: filters?.created_by || undefined,
        from: filters?.from || undefined,
        to: filters?.to || undefined,
      },
    });
    return res.data?.data;
  },

  async getPipeline(): Promise<AssessmentPipelineHealth> {
    const res = await api.get("/assessment-hub/pipeline");
    return res.data?.data;
  },

  async getAnalytics(): Promise<AssessmentHubAnalytics> {
    const res = await api.get("/assessment-hub/analytics");
    return res.data?.data;
  },

  async getEvaluationOverview(): Promise<EvaluationOverview> {
    const res = await api.get("/assessment-hub/evaluation/overview");
    return res.data?.data;
  },

  async listEvaluations(params?: {
    search?: string;
    driveId?: string;
    limit?: number;
  }): Promise<AttemptEvaluation[]> {
    const res = await api.get("/assessment-hub/evaluation/attempts", {
      params: {
        search: params?.search || undefined,
        drive_id: params?.driveId || undefined,
        limit: params?.limit ?? 40,
      },
    });
    return res.data?.data || [];
  },

  async getEvaluation(sessionId: string): Promise<AttemptEvaluation> {
    const res = await api.get(`/assessment-hub/evaluation/attempts/${sessionId}`);
    return res.data?.data;
  },

  /** Student Results & Evaluation for own completed drive attempt */
  async getStudentDriveEvaluation(driveId: string): Promise<AttemptEvaluation> {
    const res = await api.get(`/exam-sessions/${driveId}/evaluation`);
    return res.data?.data;
  },
};

export default assessmentHubService;
