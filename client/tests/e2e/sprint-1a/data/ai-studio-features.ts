/**
 * AI Studio — per-page feature matrix.
 * Note: several entries are aliases into Learning Companion / shared AI Config.
 */
import type { HubPageFeatures } from "./feature-spec";

export const AI_STUDIO_FEATURE_CATALOG: HubPageFeatures[] = [
  {
    id: "ai-content-generator",
    label: "Content Generator",
    path: "/app/superadmin/learning-companion/studio",
    pageName: "Content Generator",
    expectedHeading: /Studio|Content|Generator|AI|Companion/i,
    aliasOf: "learning-companion/studio",
    features: {
      listOrContent: { required: true, hints: [/Generate|Topic|Asset|Lesson|Question|Flashcard|Prompt/i] },
      create: { required: true, name: /Generate|Create|Run|Start/i },
      search: { required: false },
      pagination: { required: false },
    },
  },
  {
    id: "ai-voice-generator",
    label: "Voice Generator",
    path: "/app/superadmin/learning-companion/studio?kind=voice_lessons",
    pageName: "Voice Generator",
    expectedHeading: /Studio|Voice|Generator|Content|AI/i,
    aliasOf: "learning-companion/studio?kind=voice_lessons",
    features: {
      listOrContent: { required: true, hints: [/Voice|Generate|Lesson|kind|Studio/i] },
      create: { required: true, name: /Generate|Create|Run|Start/i },
      search: { required: false },
      pagination: { required: false },
    },
  },
  {
    id: "ai-review-center",
    label: "AI Review Center",
    path: "/app/superadmin/learning-companion/review",
    pageName: "AI Review Center",
    expectedHeading: /Review/i,
    aliasOf: "learning-companion/review",
    features: {
      listOrContent: { required: true },
      filters: { required: true, hints: [/Status|Pending|Filter|All|Queue/i] },
      rowActions: { required: false, name: /Approve|Reject|Publish|Improve/i, softIfEmpty: true },
      emptyState: { acceptable: true, hints: [/No .+ review|empty|No pending/i] },
      search: { required: false },
      pagination: { required: false },
    },
  },
  {
    id: "ai-content-improver",
    label: "AI Content Improver",
    path: "/app/superadmin/ai-studio/content-improver",
    pageName: "Content Improver",
    expectedHeading: /Improver|Improve|Content|AI/i,
    features: {
      search: { required: true, placeholder: /Search questions/i },
      listOrContent: { required: true },
      create: { required: true, name: /Search|Improve|Apply/i },
      emptyState: { acceptable: true },
      pagination: { required: false },
    },
  },
  {
    id: "ai-translation",
    label: "Translation Studio",
    path: "/app/superadmin/ai-studio/translation",
    pageName: "Translation Studio",
    expectedHeading: /Translation|Translate|Language/i,
    features: {
      search: { required: true, placeholder: /Search questions/i },
      listOrContent: { required: true, hints: [/Language|Translate|Target|Source/i] },
      create: { required: true, name: /Search|Translate|Run/i },
      pagination: { required: false },
    },
  },
  {
    id: "ai-embeddings",
    label: "Embedding Manager",
    path: "/app/superadmin/ai-studio/embeddings",
    pageName: "Embedding Manager",
    expectedHeading: /Embedding/i,
    features: {
      listOrContent: { required: true, hints: [/coverage|embedding|Search|dedup|related/i] },
      create: { required: true, name: /Rebuild|Generate|Run|Reindex|Sync/i },
      search: { required: false },
      pagination: { required: false },
    },
  },
  {
    id: "ai-prompt-manager",
    label: "Prompt Manager",
    path: "/app/superadmin/ai-config?tab=prompts",
    pageName: "Prompt Manager",
    expectedHeading: /AI|Prompt|Config|Service/i,
    aliasOf: "ai-config (shared with Administration)",
    features: {
      listOrContent: { required: true, hints: [/Prompt|Service|Model|API|tab|Provider/i] },
      create: { required: true, name: /Create|Add|Save|New/i },
      search: { required: false },
      secondaryTabs: { required: true, sample: /Prompt|Service|Model|Key/i },
      pagination: { required: false },
    },
  },
  {
    id: "ai-models",
    label: "AI Models",
    path: "/app/superadmin/ai-config",
    pageName: "AI Models",
    expectedHeading: /AI|Config|Service|Model/i,
    aliasOf: "ai-config (shared with Administration)",
    features: {
      listOrContent: { required: true, hints: [/Service|Provider|API|Create service|enable/i] },
      create: { required: true, name: /Create|Add service|New/i },
      search: { required: false },
      pagination: { required: false },
    },
  },
];
