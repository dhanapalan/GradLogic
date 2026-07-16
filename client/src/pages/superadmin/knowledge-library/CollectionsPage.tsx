// Knowledge Collections — curated packs (reuses Assessment Hub question_collections)
import { Link } from "react-router-dom";
import QuestionCollectionsPage from "../question-collections/QuestionCollectionsPage";

export default function CollectionsPage() {
  return (
    <div className="space-y-3">
      <div>
        <Link
          to="/app/superadmin/knowledge-library/organization"
          className="text-xs text-admin-accent hover:underline"
        >
          ← Organization
        </Link>
        <p className="text-sm text-gray-500 mt-2">
          Knowledge Library view of Assessment Hub collections — same reusable groups for practice,
          mocks, and assessments.
        </p>
      </div>
      <QuestionCollectionsPage embedded />
    </div>
  );
}
