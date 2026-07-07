import api from "../lib/api";

export interface DailyTarget {
  target: number;
  completed_today: number;
  remaining: number;
  met: boolean;
  current_streak: number;
  longest_streak: number;
  last_practice_date: string | null;
}

const studentPracticeService = {
  /** The student's daily practice goal (set by their college) + today's progress. */
  async getDailyTarget(): Promise<DailyTarget> {
    const { data } = await api.get("/practice/daily-target");
    return data.data;
  },
};

export default studentPracticeService;
