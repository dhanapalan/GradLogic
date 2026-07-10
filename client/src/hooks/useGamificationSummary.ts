import { useQuery } from "@tanstack/react-query";
import api from "../lib/api";

export interface DayActivity {
  day: string;
  active: boolean;
}

interface GamificationMeResponse {
  xp: { total: number; level: number; next_level_at: number; progress_percent: number };
  streak: { current_streak: number; longest_streak: number; last_practice_date: string | null };
  badges: unknown[];
  recent_xp: { points: number; source: string; description: string; earned_at: string }[];
  weekly_xp: number;
  activity_last_7_days: DayActivity[];
}

interface LeaderboardResponse {
  my_rank: number | null;
  total_participants: number;
}

/** Shared real-data source for the dashboard's motivational widgets (readiness
 * uses useWorkflowStages separately; this covers XP/streak/rank). */
export function useGamificationSummary() {
  const meQuery = useQuery({
    queryKey: ["gamification-me"],
    queryFn: async () => (await api.get("/gamification/me")).data.data as GamificationMeResponse,
    staleTime: 60_000,
  });
  const leaderboardQuery = useQuery({
    queryKey: ["gamification-leaderboard", "rank-only"],
    queryFn: async () => (await api.get("/gamification/leaderboard?period=all_time&limit=1")).data.data as LeaderboardResponse,
    staleTime: 60_000,
  });

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayXp = (meQuery.data?.recent_xp ?? [])
    .filter((t) => t.earned_at.slice(0, 10) === todayStr)
    .reduce((sum, t) => sum + t.points, 0);

  return {
    profile: meQuery.data,
    myRank: leaderboardQuery.data?.my_rank ?? null,
    totalParticipants: leaderboardQuery.data?.total_participants ?? null,
    todayXp,
    isLoading: meQuery.isLoading || leaderboardQuery.isLoading,
  };
}
