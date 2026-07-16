/**
 * AI Learning Journey — admin surface for personalized placement roadmaps.
 * Does not assemble courses (Course Builder) or publish them (Course Catalog).
 * Differentiation: AI Companion generates and adapts the student journey.
 */
import api from "../lib/api";
import {
  PHASE1_PLACEMENT_DOMAINS,
} from "../lib/phase1PlacementDomains";

export const LEARNING_JOURNEY_BASE = "/app/superadmin/learning-journey";

/** Placement Preparation Phase 1 only — no ML Basics / engineering tracks. */
export const PHASE1_JOURNEY_DOMAINS = PHASE1_PLACEMENT_DOMAINS.map((d) => ({
  value: d.journeyDomain,
  label: d.label,
}));

export interface JourneyDashboard {
  activeJourneys: number;
  completedJourneys: number;
  studentsInProgress: number;
  averageCompletion: number | null;
  averagePlacementReadiness: number | null;
  todaysTasks: number;
  upcomingMockTests: number;
  pendingReviews: number;
  templatesTotal: number;
  templatesPublished: number;
  phase1Domains: number;
  charts: {
    journeyProgress: Array<{ domain: string; label: string; avg_progress: number; count: number }>;
    placementReadiness: Array<{ bucket: string; avg_readiness: number; count: number }>;
    skillMastery: Array<{ domain: string; label: string; avg_readiness: number }>;
    dailyLearningCompletion: Array<{ day: string; completed: number }>;
  };
}

export interface JourneyTemplate {
  id: string;
  title: string;
  description: string | null;
  domain: string | null;
  difficulty: string | null;
  status: string;
  duration_days: number | null;
  estimated_hours: number | null;
  objectives: string[] | unknown;
  target_role: string | null;
  course_count: number;
  student_count: number;
  updated_at: string;
  created_by_name: string | null;
}

const learningJourneyService = {
  async getDashboard(): Promise<JourneyDashboard> {
    const res = await api.get("/learning-journey/dashboard");
    return res.data?.data;
  },

  async listTemplates(params?: {
    domain?: string;
    status?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ templates: JourneyTemplate[]; total: number }> {
    const res = await api.get("/learning-journey/templates", { params });
    return res.data?.data || { templates: [], total: 0 };
  },

  async seedPhase1() {
    const res = await api.post("/learning-journey/templates/seed-phase1");
    return res.data?.data as { created_count: number };
  },
};

export default learningJourneyService;
