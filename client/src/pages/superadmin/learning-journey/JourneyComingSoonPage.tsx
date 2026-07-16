// =============================================================================
// Stub pages for AI Learning Journey tabs beyond Inc 1
// =============================================================================

import { Link } from "react-router-dom";
import { LEARNING_JOURNEY_BASE as BASE } from "../../../services/learningJourneyService";

export default function JourneyComingSoonPage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-gray-200 bg-white px-6 py-14 text-center max-w-lg mx-auto">
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      <p className="mt-2 text-sm text-gray-500">{description}</p>
      <p className="mt-4 text-xs text-gray-400">
        Increment 1 delivered the AI Learning Journey shell and templates. This surface ships in a
        later increment along the path: assessment → personalized journey → daily plan →
        placement ready.
      </p>
      <Link
        to={BASE}
        className="inline-block mt-6 text-sm text-admin-accent hover:underline"
      >
        ← Back to Dashboard
      </Link>
    </div>
  );
}
