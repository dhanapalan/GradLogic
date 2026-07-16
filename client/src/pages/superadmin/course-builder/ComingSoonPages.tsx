import ComingSoonStubPage from "./StubPages";

export function AiCourseBuilderStubPage() {
  return (
    <ComingSoonStubPage
      title="AI Course Builder"
      description="Describe a course (e.g. Beginner Python) and AI will propose modules, practice, and assessments from the Knowledge Library for your review — coming in a later increment."
    />
  );
}

export function TemplatesStubPage() {
  return (
    <ComingSoonStubPage
      title="Course Templates"
      description="Phase-1 skeletons for Aptitude, Reasoning, Python, Java, and AI/ML will live here."
    />
  );
}

export function ReviewStubPage() {
  // Replaced by ReviewPublishPage — keep export name for App.tsx if still referenced
  return null;
}
