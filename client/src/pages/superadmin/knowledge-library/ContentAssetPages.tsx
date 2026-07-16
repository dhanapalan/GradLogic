import { Boxes, ClipboardList, FileText } from "lucide-react";
import { ContentLibraryAssetPage } from "./ContentLibraryAssetPage";

export function CaseStudiesAssetPage() {
  return (
    <ContentLibraryAssetPage
      meta={{
        title: "Case Studies",
        description: "Scenario-based cases for domain and interview practice.",
        icon: Boxes,
        contentType: "case_study",
        placeholder: "Case brief, context, and discussion prompts…",
      }}
    />
  );
}

export function InterviewQuestionsAssetPage() {
  return (
    <ContentLibraryAssetPage
      meta={{
        title: "Interview Questions",
        description: "Curated interview prompts and model answers.",
        icon: ClipboardList,
        contentType: "interview_question",
        placeholder: "Model answer / guidance…",
      }}
    />
  );
}

export function DocumentsAssetPage() {
  return (
    <ContentLibraryAssetPage
      meta={{
        title: "Documents",
        description: "Reading lists, cheat sheets, PDFs notes, and reference material.",
        icon: FileText,
        contentType: "learning_resource",
        placeholder: "Document outline, link notes, or body text…",
      }}
    />
  );
}
