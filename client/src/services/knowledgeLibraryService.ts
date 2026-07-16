/**
 * Knowledge Library — Sprint 1 aggregator.
 * Uses existing question-bank / superadmin-features APIs (no schema changes).
 */
import questionBankService from "./questionBankService";
import superadminFeaturesService from "./superadminFeaturesService";

export interface KnowledgeLibraryStats {
  lessons: number;
  questions: number;
  codingChallenges: number;
  flashcards: number;
  voiceLessons: number;
  videos: number;
  interviews: number;
  caseStudies: number;
  documents: number;
  pendingReview: number;
  published: number;
  draft: number;
  byCategory: { name: string; count: number }[];
  bySource: { ai: number; manual: number };
  topTopics: { name: string; count: number }[];
}

function isVideoLesson(l: { content_type: string; content_url: string | null }) {
  const type = (l.content_type || "").toLowerCase();
  if (type === "video" || type.includes("video")) return true;
  const url = (l.content_url || "").toLowerCase();
  return /\.(mp4|webm|mov|m4v)(\?|$)/.test(url) || url.includes("youtube") || url.includes("vimeo");
}

export async function getKnowledgeLibraryStats(): Promise<KnowledgeLibraryStats> {
  const [
    allQ,
    coding,
    published,
    pending,
    draft,
    aiTagged,
    lessons,
    flashcards,
    voiceLessons,
    interviews,
    cases,
    docs,
    facets,
    subjects,
  ] = await Promise.all([
    questionBankService.searchQuestions({ limit: 1 }).catch(() => ({ total: 0, questions: [] })),
    questionBankService.searchQuestions({ type: "coding_challenge", limit: 1 }).catch(() => ({ total: 0, questions: [] })),
    questionBankService.searchQuestions({ status: "published", limit: 1 }).catch(() => ({ total: 0, questions: [] })),
    questionBankService.getReviewQueue(1, 1).catch(() => ({ total: 0 })),
    questionBankService.searchQuestions({ status: "draft", limit: 1 }).catch(() => ({ total: 0, questions: [] })),
    questionBankService.searchQuestions({ source: "ai-generated", limit: 1 }).catch(() => ({ total: 0, questions: [] })),
    superadminFeaturesService.listLessons().catch(() => []),
    superadminFeaturesService.listFlashcards().catch(() => []),
    superadminFeaturesService.listLessons({ voice: true }).catch(() => []),
    superadminFeaturesService.listContentLibrary({ content_type: "interview_question" }).catch(() => []),
    superadminFeaturesService.listContentLibrary({ content_type: "case_study" }).catch(() => []),
    superadminFeaturesService.listContentLibrary({ content_type: "learning_resource" }).catch(() => []),
    questionBankService.getFacets().catch(() => ({ topics: [], skills: [], sample: [] })),
    questionBankService.getSubjectCounts().catch(() => [] as Array<{ category: string; count: number }>),
  ]);

  const lessonList = Array.isArray(lessons) ? lessons : [];
  const videoCount = lessonList.filter(isVideoLesson).length;
  const questions = allQ.total || 0;
  const ai = aiTagged.total || 0;

  return {
    lessons: lessonList.length,
    questions,
    codingChallenges: coding.total || 0,
    flashcards: Array.isArray(flashcards) ? flashcards.length : 0,
    voiceLessons: Array.isArray(voiceLessons) ? voiceLessons.length : 0,
    videos: videoCount,
    interviews: Array.isArray(interviews) ? interviews.length : 0,
    caseStudies: Array.isArray(cases) ? cases.length : 0,
    documents: Array.isArray(docs) ? docs.length : 0,
    pendingReview: pending.total || 0,
    published: published.total || 0,
    draft: draft.total || 0,
    byCategory: subjects.slice(0, 8).map((c) => ({
      name: c.category.replace(/_/g, " "),
      count: c.count,
    })),
    bySource: {
      ai,
      manual: Math.max(0, questions - ai),
    },
    topTopics: facets.topics.slice(0, 10).map((t) => ({
      name: t.tag,
      count: t.count,
    })),
  };
}

export const ASSET_TYPE_META = [
  { key: "lesson", label: "Lessons", href: "/app/superadmin/knowledge-library/assets/lessons" },
  { key: "question", label: "Questions", href: "/app/superadmin/knowledge-library/assets/questions" },
  { key: "coding", label: "Coding Challenges", href: "/app/superadmin/knowledge-library/assets/coding" },
  { key: "flashcard", label: "Flashcards", href: "/app/superadmin/knowledge-library/assets/flashcards" },
  { key: "voice", label: "Voice Lessons", href: "/app/superadmin/knowledge-library/assets/voice-lessons" },
  { key: "video", label: "Videos", href: "/app/superadmin/knowledge-library/assets/videos" },
  { key: "interview", label: "Interview Questions", href: "/app/superadmin/knowledge-library/assets/interview-questions" },
  { key: "case", label: "Case Studies", href: "/app/superadmin/knowledge-library/assets/case-studies" },
  { key: "document", label: "Documents", href: "/app/superadmin/knowledge-library/assets/documents" },
] as const;

export const CATEGORY_OPTIONS = [
  "aptitude",
  "reasoning",
  "maths",
  "data_structures",
  "programming",
  "python_coding",
  "java_coding",
  "data_science",
];

export const DIFFICULTY_OPTIONS = ["easy", "medium", "hard"] as const;
