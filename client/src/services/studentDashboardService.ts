/**
 * Student Portal Module 02 — Dashboard API integrations.
 * Presentation-only client; all scoring/eligibility stays on the server.
 */
import api from "../lib/api";

export type DashboardShell = {
  student: {
    id: string;
    name: string;
    first_name?: string | null;
    email: string;
    profile_photo_url: string | null;
    degree: string | null;
    specialization: string | null;
    class_name: string | null;
    section: string | null;
    passing_year: number | null;
    college_name: string | null;
    student_identifier: string | null;
  };
  profile_completion: {
    percentage: number;
    is_profile_complete: boolean;
    missing: string[];
  };
  widgets: Array<{ id: string; visible: boolean }>;
};

export type UpcomingAssessment = {
  campaign_id: string;
  assessment_id: string;
  assessment_name: string;
  campaign_name: string;
  subject: string;
  scheduled_at: string;
  available_until: string;
  duration_minutes: number | null;
  attempts_remaining: number;
  max_attempts: number;
  status: "Upcoming" | "Live" | "Missed" | "In Progress" | "Completed";
  raw_status: string;
  can_start: boolean;
  can_resume: boolean;
  action: string;
  start_blocked_reason?: string | null;
};

export type RecentResult = {
  campaign_id: string;
  assessment_id: string;
  assessment_name: string;
  campaign_name: string;
  score: number;
  total_marks: number;
  percentage: number;
  rank: number | null;
  passed: boolean | null;
  completed_at: string | null;
};

export type AssignedLearning = {
  enrollment_id: string;
  program_id: string;
  program_name: string;
  program_description: string | null;
  status: string;
  total_modules: number;
  completed_modules: number;
  completion_percentage: number;
  due_at: string | null;
  in_progress: boolean;
};

export type Readiness = {
  score: number;
  level: "Excellent" | "Good" | "Average" | "Needs Improvement";
  trend: number | null;
  previous_score: number | null;
  stages: { learn: number; practice: number; test: number; certify: number };
};

export type SkillsPayload = {
  top_skills: Array<{ name: string; proficiency: number; source?: string | null }>;
  weak_skills: Array<{ name: string; proficiency: number }>;
  recommended_improvements: Array<{ skill: string; message: string }>;
};

export type Recommendation = {
  id: string;
  type: "course" | "assessment" | "resume" | "interview" | "profile" | "practice";
  title: string;
  description: string;
  href: string;
  priority: number;
};

export type CampusDrive = {
  drive_id: string;
  company: string;
  role: string;
  registration_deadline: string | null;
  drive_date: string | null;
  status: string;
  can_apply: boolean;
  can_start: boolean;
  source: "assigned" | "eligible";
};

export type AchievementsPayload = {
  badges: Array<{
    slug: string;
    name: string;
    description: string;
    icon: string;
    category: string;
    awarded_at: string;
  }>;
  certificates_count: number;
  assessment_milestones: number;
  streaks: { current: number; longest: number };
};

export type CalendarEvent = {
  id: string;
  title: string;
  type: "assessment" | "learning" | "placement" | "holiday";
  starts_at: string;
  ends_at?: string | null;
  href?: string;
};

export type DashboardNotification = {
  id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  is_read: boolean;
  created_at: string;
};

const studentDashboardService = {
  getShell: async () => {
    const { data } = await api.get("/dashboard/student");
    return data.data as DashboardShell;
  },

  getUpcomingAssessments: async (limit = 8) => {
    const { data } = await api.get("/assessments/upcoming", { params: { limit } });
    return data.data as UpcomingAssessment[];
  },

  getRecentResults: async (limit = 8) => {
    const { data } = await api.get("/assessments/recent-results", { params: { limit } });
    return data.data as RecentResult[];
  },

  getAssignedLearning: async () => {
    const { data } = await api.get("/learning/assigned");
    return data.data as AssignedLearning[];
  },

  getReadiness: async () => {
    const { data } = await api.get("/analytics/readiness");
    return data.data as Readiness;
  },

  getSkills: async () => {
    const { data } = await api.get("/analytics/skills");
    return data.data as SkillsPayload;
  },

  getRecommendations: async () => {
    const { data } = await api.get("/recommendations");
    return data.data as Recommendation[];
  },

  getEligibleDrives: async () => {
    const { data } = await api.get("/campus-drives/eligible");
    return data.data as CampusDrive[];
  },

  applyDrive: async (driveId: string) => {
    const { data } = await api.post(`/campus-drives/${driveId}/apply`);
    return data;
  },

  getAchievements: async () => {
    const { data } = await api.get("/achievements");
    return data.data as AchievementsPayload;
  },

  getCalendarEvents: async (days = 30) => {
    const { data } = await api.get("/calendar/events", { params: { days } });
    return data.data as CalendarEvent[];
  },

  getNotifications: async (limit = 8) => {
    const { data } = await api.get("/notifications", { params: { limit } });
    return data.data as DashboardNotification[];
  },

  markNotificationRead: async (id: string) => {
    await api.put(`/notifications/${id}/read`);
  },

  markAllNotificationsRead: async () => {
    await api.put("/notifications/read-all");
  },
};

export default studentDashboardService;
