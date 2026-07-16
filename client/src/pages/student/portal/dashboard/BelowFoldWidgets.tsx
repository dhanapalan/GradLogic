import {
  AchievementsWidget,
  CalendarWidget,
  CampusDrivesWidget,
  RecommendationsWidget,
  SkillProgressWidget,
} from "./widgets";

type Vis = Record<string, boolean>;

/** Below-the-fold widgets — lazy-loaded from DashboardPage. */
export default function BelowFoldWidgets({ visibility }: { visibility: Vis }) {
  return (
    <>
      {visibility.skill_progress !== false && <SkillProgressWidget />}
      {visibility.ai_recommendations !== false && <RecommendationsWidget />}
      {visibility.campus_drives !== false && <CampusDrivesWidget />}
      {visibility.achievements !== false && <AchievementsWidget />}
      {visibility.calendar !== false && <CalendarWidget />}
    </>
  );
}
