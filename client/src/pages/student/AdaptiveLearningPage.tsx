// =============================================================================
// Adaptive Learning (Phase 8)
//
// Track: attempts / time / accuracy per skill (real practice_attempts data).
// Recommend: next lesson, next question, difficulty, estimated time.
// Learning Path: auto-generated, weakest skills first, computed live.
// =============================================================================

import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Zap, TrendingDown, Clock, Target, BookOpen, ChevronRight, Loader2,
  CheckCircle2, AlertCircle,
} from "lucide-react";
import adaptiveLearning, {
  type SkillAccuracy,
  type LearningPathStep,
} from "../../services/adaptiveLearningService";

const DIFFICULTY_COLOR: Record<string, string> = {
  easy: "text-green-600 bg-green-50",
  medium: "text-amber-600 bg-amber-50",
  hard: "text-red-600 bg-red-50",
};

function categoryLabel(category: string) {
  return category.replace(/_/g, " ");
}

function AccuracyBar({ accuracy, hasEnoughData }: { accuracy: number; hasEnoughData: boolean }) {
  const pct = Math.round(accuracy * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${pct < 50 ? "bg-red-400" : pct < 80 ? "bg-amber-400" : "bg-green-400"}`}
          style={{ width: `${hasEnoughData ? pct : 0}%` }}
        />
      </div>
      <span className="text-xs font-medium text-slate-500 w-16 text-right">
        {hasEnoughData ? `${pct}%` : "no data"}
      </span>
    </div>
  );
}

export default function AdaptiveLearningPage() {
  const navigate = useNavigate();

  const { data: track, isLoading: loadingTrack } = useQuery({
    queryKey: ["adaptive-learning-track"],
    queryFn: () => adaptiveLearning.getTrack(),
  });

  const { data: recommendation, isLoading: loadingRec } = useQuery({
    queryKey: ["adaptive-learning-recommend"],
    queryFn: () => adaptiveLearning.getRecommendation(),
  });

  const { data: path, isLoading: loadingPath } = useQuery({
    queryKey: ["adaptive-learning-path"],
    queryFn: () => adaptiveLearning.getLearningPath(5),
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-indigo-50 rounded-lg">
          <Zap className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Adaptive Learning</h1>
          <p className="text-sm text-slate-500">Your practice history, weak spots, and a path to close them.</p>
        </div>
      </div>

      {/* Recommend next */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <Target className="w-4 h-4 text-indigo-500" /> Recommended next
        </h2>
        {loadingRec ? (
          <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
        ) : recommendation ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 rounded-xl">
              <p className="text-xs text-slate-400 mb-1">Focus skill</p>
              <p className="font-medium text-slate-800 capitalize">{categoryLabel(recommendation.weakestSkill.category)}</p>
              <div className="mt-2">
                <AccuracyBar
                  accuracy={recommendation.weakestSkill.accuracy}
                  hasEnoughData={recommendation.weakestSkill.hasEnoughData}
                />
              </div>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl">
              <p className="text-xs text-slate-400 mb-1">Recommended difficulty</p>
              <span
                className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium capitalize ${DIFFICULTY_COLOR[recommendation.recommendedDifficulty]}`}
              >
                {recommendation.recommendedDifficulty}
              </span>
              <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> ~{recommendation.estimatedLearningTimeMinutes} min estimated
              </p>
            </div>
            {recommendation.nextLesson && (
              <div className="p-4 bg-indigo-50/50 rounded-xl sm:col-span-2 flex items-center justify-between">
                <div>
                  <p className="text-xs text-indigo-500 mb-1 flex items-center gap-1">
                    <BookOpen className="w-3.5 h-3.5" /> Next lesson
                  </p>
                  <p className="font-medium text-slate-800">{recommendation.nextLesson.title}</p>
                </div>
                {recommendation.nextLesson.durationMinutes && (
                  <span className="text-xs text-slate-400">{recommendation.nextLesson.durationMinutes} min</span>
                )}
              </div>
            )}
            {recommendation.nextQuestion && (
              <button
                onClick={() =>
                  navigate(`/app/student-portal/practice?topic=${recommendation.weakestSkill.category}`)
                }
                className="p-4 border border-indigo-200 rounded-xl sm:col-span-2 flex items-center justify-between text-left hover:bg-indigo-50/30 transition-colors"
              >
                <div>
                  <p className="text-xs text-indigo-500 mb-1">Next question</p>
                  <p className="text-sm text-slate-700 line-clamp-2">{recommendation.nextQuestion.question_text}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-indigo-400 shrink-0 ml-2" />
              </button>
            )}
          </div>
        ) : null}
      </div>

      {/* Track: accuracy per skill */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <TrendingDown className="w-4 h-4 text-indigo-500" /> Skill accuracy
        </h2>
        {loadingTrack ? (
          <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
        ) : (
          <div className="space-y-3">
            {(track || []).map((s: SkillAccuracy) => (
              <div key={s.category} className="flex items-center gap-4">
                <span className="text-sm text-slate-600 capitalize w-36 shrink-0">{categoryLabel(s.category)}</span>
                <div className="flex-1">
                  <AccuracyBar accuracy={s.accuracy} hasEnoughData={s.hasEnoughData} />
                </div>
                <span className="text-xs text-slate-400 w-24 text-right shrink-0">
                  {s.attempts} attempt{s.attempts === 1 ? "" : "s"}
                </span>
                {s.avgTimeSeconds > 0 && (
                  <span className="text-xs text-slate-400 w-16 text-right shrink-0">{Math.round(s.avgTimeSeconds)}s avg</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Learning path */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Zap className="w-4 h-4 text-indigo-500" /> Your learning path
          </h2>
          {path && <span className="text-xs text-slate-400">~{path.totalEstimatedMinutes} min total</span>}
        </div>
        {loadingPath ? (
          <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
        ) : (
          <div className="space-y-4">
            {(path?.steps || []).map((step: LearningPathStep) => (
              <div key={step.order} className="flex gap-4 pb-4 border-b border-slate-100 last:border-0 last:pb-0">
                <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold flex items-center justify-center shrink-0">
                  {step.order}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-slate-800 capitalize">{categoryLabel(step.category)}</span>
                    <span
                      className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium capitalize ${DIFFICULTY_COLOR[step.difficulty]}`}
                    >
                      {step.difficulty}
                    </span>
                    {!step.hasEnoughData && (
                      <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> not yet practiced
                      </span>
                    )}
                  </div>
                  {step.lesson && (
                    <p className="text-xs text-slate-500 flex items-center gap-1 mb-1">
                      <BookOpen className="w-3 h-3" /> {step.lesson.title}
                      {step.lesson.durationMinutes ? ` · ${step.lesson.durationMinutes} min` : ""}
                    </p>
                  )}
                  <p className="text-xs text-slate-400">
                    {step.practiceQuestions.length} practice question{step.practiceQuestions.length === 1 ? "" : "s"} queued
                    · ~{step.estimatedMinutes} min
                  </p>
                </div>
                <button
                  onClick={() => navigate(`/app/student-portal/practice?topic=${step.category}&difficulty=${step.difficulty}`)}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-800 shrink-0 self-start flex items-center gap-1"
                >
                  Practice <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {path && path.steps.length === 0 && (
              <p className="text-sm text-slate-400 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-400" /> No weak spots detected yet — keep practicing to build up data.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
