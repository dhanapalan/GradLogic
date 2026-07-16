// =============================================================================
// Generic Coming Soon for Super Admin nav leaves that do not have a real page
// yet. Swap an entry out (and drop its key here) once the feature ships.
// =============================================================================

import { useParams } from "react-router-dom";
import {
  BookOpen,
  Boxes,
  ClipboardList,
  Code2,
  FileStack,
  GraduationCap,
  Library,
  Mic,
  Palette,
  Route as RouteIcon,
  Plug,
  BarChart3,
  type LucideIcon,
} from "lucide-react";
import ComingSoonPage from "./organization/ComingSoonPage";

const FEATURES: Record<string, { icon: LucideIcon; title: string; description: string }> = {
  lessons: {
    icon: BookOpen,
    title: "Lessons",
    description: "Published lesson library from the AI Learning Companion pipeline.",
  },
  flashcards: {
    icon: FileStack,
    title: "Flashcards",
    description: "Published flashcards for spaced practice and revision.",
  },
  "voice-lessons": {
    icon: Mic,
    title: "Voice Lessons",
    description: "Voice-ready lesson scripts students can study with the voice tutor.",
  },
  "interview-questions": {
    icon: ClipboardList,
    title: "Interview Questions",
    description: "Curated interview prompts and model answers by role and company.",
  },
  "case-studies": {
    icon: Boxes,
    title: "Case Studies",
    description: "Scenario-based case studies for domain and consulting practice.",
  },
  "learning-resources": {
    icon: Library,
    title: "Learning Resources",
    description: "Reading lists, cheat sheets, and reference material.",
  },
  "journey-templates": {
    icon: RouteIcon,
    title: "AI Learning Journey Templates",
    description: "Reusable AI-powered placement roadmaps personalized by the Learning Companion.",
  },
  "resource-library": {
    icon: Library,
    title: "Resource Library",
    description: "Shared assets, packs, and downloads for faculty and students.",
  },
  "ai-assistant": {
    icon: GraduationCap,
    title: "AI Assistant",
    description: "Admin co-pilot for content ops, taxonomy, and assessment design.",
  },
  "mock-tests": {
    icon: ClipboardList,
    title: "Mock Tests",
    description: "Timed mock assessments filtered from Assessment Builder (mock_test drives).",
  },
  "coding-assessments": {
    icon: Code2,
    title: "Coding Assessments",
    description: "Coding-focused assessments with auto-grading and proctoring options.",
  },
  "assessment-templates": {
    icon: FileStack,
    title: "Assessment Templates",
    description: "Reusable section blueprints for aptitude, coding, and soft-skills tests.",
  },
  certificates: {
    icon: GraduationCap,
    title: "Certificates",
    description: "Issue and manage completion certificates for courses and journeys.",
  },
  "learning-analytics": {
    icon: BarChart3,
    title: "Learning Analytics",
    description: "Engagement, completion, and knowledge-object coverage across the companion.",
  },
  "student-analytics": {
    icon: BarChart3,
    title: "Student Analytics",
    description: "Per-student skill growth, attempt history, and intervention signals.",
  },
  "course-analytics": {
    icon: BarChart3,
    title: "Course Analytics",
    description: "Course/module completion, drop-off, and outcome metrics.",
  },
  "assessment-analytics": {
    icon: BarChart3,
    title: "Assessment Analytics",
    description: "Item analysis, score distributions, and integrity signals for drives.",
  },
  "voice-analytics": {
    icon: Mic,
    title: "Voice Analytics",
    description: "Voice tutor and mock-interview session quality and usage metrics.",
  },
  branding: {
    icon: Palette,
    title: "Branding",
    description: "Platform logos, colors, and white-label college themes.",
  },
  integrations: {
    icon: Plug,
    title: "Integrations",
    description: "LMS, SSO, webhooks, and third-party placement tools.",
  },
};

export default function FeatureComingSoonRoute() {
  const { feature } = useParams<{ feature: string }>();
  const meta = (feature && FEATURES[feature]) || {
    icon: Boxes,
    title: "Coming soon",
    description: "This Super Admin feature is not built yet.",
  };

  return <ComingSoonPage icon={meta.icon} title={meta.title} description={meta.description} />;
}
