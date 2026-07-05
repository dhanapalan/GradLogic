import api from "../lib/api";

export interface PlatformMetrics {
  totalColleges: number;
  totalStudents: number;
  activeUsers: number;
  totalQuestions: number;
  totalTests: number;
  certifications: number;
  pendingApprovals: number;
  avgPlacementReadiness?: number;
  aiGeneratedQuestions?: number;
}

export interface GrowthData {
  label: string;
  value: number;
}

export interface GrowthSeries {
  collegeGrowth: GrowthData[];
  studentGrowth: GrowthData[];
}

export interface SystemAlert {
  id: string;
  type: "info" | "warning" | "error";
  title: string;
  message: string;
  timestamp: string;
}

export interface RecentActivity {
  id: string;
  action: string;
  user: string;
  entity: string;
  timestamp: string;
  details?: string;
}

export interface PendingApproval {
  id: string;
  name: string;
  email: string;
  type: string;
  date: string;
  link?: string;
}

export interface MostActiveCollege {
  id: string;
  name: string;
  studentCount: number;
  activityScore: number;
}

export interface LiveDayStats {
  newStudents: number;
  newColleges: number;
  examAttempts: number;
  completedExams: number;
  logins: number;
}

export interface LiveActionItem {
  id: string;
  entityId: string;
  type: "college" | "question" | "payment";
  title: string;
  subtitle: string;
  createdAt: string;
  href: string;
}

export interface LiveDashboard {
  updatedAt: string;
  today: LiveDayStats;
  yesterday: LiveDayStats;
  activeNow: number;
  examsInProgress: number;
  examTrend: GrowthData[];
  actionItems: LiveActionItem[];
  counts: {
    pendingColleges: number;
    pendingQuestions: number;
    pendingPayments: number;
    failedLoginsLastHour: number;
    suspendedColleges: number;
    aiGenerated30d: number;
  };
}

export interface DashboardBilling {
  academic_year: string;
  fee_per_student: number;
  total_students: number;
  paid: number;
  pending: number;
  collected: number;
  expected: number;
}

export interface DashboardBundle {
  metrics: PlatformMetrics;
  growth: GrowthSeries;
  live: LiveDashboard;
  alerts: SystemAlert[];
  activities: RecentActivity[];
  colleges: MostActiveCollege[];
  billing: DashboardBilling;
}

const CACHE_DURATION = 30000; // 30 seconds
const LIVE_CACHE_DURATION = 10000; // 10 seconds for live feed

class SuperAdminMetricsService {
  private cache: Map<string, { data: any; timestamp: number }> = new Map();

  private isCacheValid(key: string, duration = CACHE_DURATION): boolean {
    const cached = this.cache.get(key);
    if (!cached) return false;
    return Date.now() - cached.timestamp < duration;
  }

  private getFromCache<T>(key: string, duration = CACHE_DURATION): T | null {
    if (this.isCacheValid(key, duration)) {
      return this.cache.get(key)?.data || null;
    }
    this.cache.delete(key);
    return null;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  async getPlatformMetrics(): Promise<PlatformMetrics> {
    const cacheKey = "platform_metrics";
    const cached = this.getFromCache<PlatformMetrics>(cacheKey);
    if (cached) return cached;

    try {
      const response = await api.get("/superadmin/metrics/platform");
      const data = response.data?.data || response.data || {
        totalColleges: 0,
        totalStudents: 0,
        activeUsers: 0,
        totalQuestions: 0,
        totalTests: 0,
        certifications: 0,
        pendingApprovals: 0,
      };
      this.setCache(cacheKey, data);
      return data;
    } catch (error) {
      console.error("Failed to fetch platform metrics:", error);
      return {
        totalColleges: 0,
        totalStudents: 0,
        activeUsers: 0,
        totalQuestions: 0,
        totalTests: 0,
        certifications: 0,
        pendingApprovals: 0,
      };
    }
  }

  async getGrowthData(): Promise<GrowthSeries> {
    const cacheKey = "growth_data";
    const cached = this.getFromCache<GrowthSeries>(cacheKey);
    if (cached) return cached;

    try {
      const response = await api.get("/superadmin/metrics/growth");
      const raw = response.data?.data || response.data || {};
      const data: GrowthSeries = {
        collegeGrowth: raw.collegeGrowth || [],
        studentGrowth: raw.studentGrowth || [],
      };
      this.setCache(cacheKey, data);
      return data;
    } catch (error) {
      console.error("Failed to fetch growth data:", error);
      return { collegeGrowth: [], studentGrowth: [] };
    }
  }

  async getSystemAlerts(): Promise<SystemAlert[]> {
    const cacheKey = "system_alerts";
    const cached = this.getFromCache<SystemAlert[]>(cacheKey);
    if (cached) return cached;

    try {
      const response = await api.get("/superadmin/metrics/alerts");
      const data = response.data?.data || response.data || [];
      this.setCache(cacheKey, data);
      return data;
    } catch (error) {
      console.error("Failed to fetch system alerts:", error);
      return [];
    }
  }

  async getRecentActivities(limit: number = 10): Promise<RecentActivity[]> {
    const cacheKey = "recent_activities";
    const cached = this.getFromCache<RecentActivity[]>(cacheKey);
    if (cached) return cached;

    try {
      const response = await api.get("/superadmin/audit-trail", { params: { limit } });
      const logs = response.data?.data || [];
      const activities: RecentActivity[] = logs.slice(0, limit).map((log: any) => ({
        id: log.id,
        action: log.action,
        user: log.user_name || log.user_email || "System",
        entity: log.resource_type || "Unknown",
        timestamp: log.created_at,
        details:
          log.changes == null
            ? undefined
            : typeof log.changes === "string"
              ? log.changes
              : JSON.stringify(log.changes),
      }));
      this.setCache(cacheKey, activities);
      return activities;
    } catch (error) {
      console.error("Failed to fetch recent activities:", error);
      return [];
    }
  }

  async getPendingApprovals(): Promise<PendingApproval[]> {
    const cacheKey = "pending_approvals";
    const cached = this.getFromCache<PendingApproval[]>(cacheKey);
    if (cached) return cached;

    try {
      const response = await api.get("/superadmin/colleges/requests");
      const colleges = response.data?.data || [];
      const approvals: PendingApproval[] = colleges.map((college: any) => ({
        id: college.id,
        name: college.name,
        email: college.email,
        type: "College",
        date: college.created_at,
        link: `/app/superadmin/colleges/${college.id}`,
      }));
      this.setCache(cacheKey, approvals);
      return approvals;
    } catch (error) {
      console.error("Failed to fetch pending approvals:", error);
      return [];
    }
  }

  async getMostActiveColleges(limit: number = 5): Promise<MostActiveCollege[]> {
    const cacheKey = "most_active_colleges";
    const cached = this.getFromCache<MostActiveCollege[]>(cacheKey);
    if (cached) return cached;

    try {
      const response = await api.get("/superadmin/analytics/colleges");
      const colleges = response.data?.data || [];
      const active: MostActiveCollege[] = colleges
        .map((college: any) => {
          const studentCount = parseInt(college.student_count || 0, 10);
          const attempts = parseInt(college.attempts || 0, 10);
          // Real, derived signal: test attempts per student, capped at 100%.
          const activityScore = studentCount > 0 ? Math.min(attempts / studentCount, 1) : 0;
          return {
            id: college.id,
            name: college.name,
            studentCount,
            activityScore,
          };
        })
        .sort((a: MostActiveCollege, b: MostActiveCollege) => b.studentCount - a.studentCount)
        .slice(0, limit);
      this.setCache(cacheKey, active);
      return active;
    } catch (error) {
      console.error("Failed to fetch most active colleges:", error);
      return [];
    }
  }

  async getLiveDashboard(force = false): Promise<LiveDashboard> {
    const cacheKey = "live_dashboard";
    if (!force) {
      const cached = this.getFromCache<LiveDashboard>(cacheKey, LIVE_CACHE_DURATION);
      if (cached) return cached;
    }

    try {
      const response = await api.get("/superadmin/metrics/live");
      const raw = response.data?.data || {};
      const data: LiveDashboard = {
        updatedAt: raw.updatedAt || new Date().toISOString(),
        today: raw.today || {
          newStudents: 0,
          newColleges: 0,
          examAttempts: 0,
          completedExams: 0,
          logins: 0,
        },
        yesterday: raw.yesterday || {
          newStudents: 0,
          newColleges: 0,
          examAttempts: 0,
          completedExams: 0,
          logins: 0,
        },
        activeNow: raw.activeNow ?? 0,
        examsInProgress: raw.examsInProgress ?? 0,
        examTrend: raw.examTrend || [],
        actionItems: raw.actionItems || [],
        counts: raw.counts || {
          pendingColleges: 0,
          pendingQuestions: 0,
          pendingPayments: 0,
          failedLoginsLastHour: 0,
          suspendedColleges: 0,
          aiGenerated30d: 0,
        },
      };
      this.setCache(cacheKey, data);
      return data;
    } catch (error) {
      console.error("Failed to fetch live dashboard:", error);
      return {
        updatedAt: new Date().toISOString(),
        today: { newStudents: 0, newColleges: 0, examAttempts: 0, completedExams: 0, logins: 0 },
        yesterday: { newStudents: 0, newColleges: 0, examAttempts: 0, completedExams: 0, logins: 0 },
        activeNow: 0,
        examsInProgress: 0,
        examTrend: [],
        actionItems: [],
        counts: {
          pendingColleges: 0,
          pendingQuestions: 0,
          pendingPayments: 0,
          failedLoginsLastHour: 0,
          suspendedColleges: 0,
          aiGenerated30d: 0,
        },
      };
    }
  }

  async getDashboard(force = false): Promise<DashboardBundle> {
    const cacheKey = "dashboard_bundle";
    if (!force) {
      const cached = this.getFromCache<DashboardBundle>(cacheKey, CACHE_DURATION);
      if (cached) return cached;
    }

    try {
      const response = await api.get("/superadmin/metrics/dashboard");
      const raw = response.data?.data || {};
      const data: DashboardBundle = {
        metrics: raw.metrics || {},
        growth: raw.growth || { collegeGrowth: [], studentGrowth: [] },
        live: raw.live || {
          updatedAt: new Date().toISOString(),
          today: { newStudents: 0, newColleges: 0, examAttempts: 0, completedExams: 0, logins: 0 },
          yesterday: { newStudents: 0, newColleges: 0, examAttempts: 0, completedExams: 0, logins: 0 },
          activeNow: 0,
          examsInProgress: 0,
          examTrend: [],
          actionItems: [],
          counts: { pendingColleges: 0, pendingQuestions: 0, pendingPayments: 0, failedLoginsLastHour: 0, suspendedColleges: 0, aiGenerated30d: 0 },
        },
        alerts: raw.alerts || [],
        activities: raw.activities || [],
        colleges: raw.colleges || [],
        billing: raw.billing || { academic_year: "", fee_per_student: 0, total_students: 0, paid: 0, pending: 0, collected: 0, expected: 0 },
      };
      this.setCache(cacheKey, data);
      return data;
    } catch (error) {
      console.error("Failed to fetch dashboard bundle:", error);
      throw error;
    }
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export default new SuperAdminMetricsService();
