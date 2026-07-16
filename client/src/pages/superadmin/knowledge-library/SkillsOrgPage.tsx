// Skills = Bloom levels for Knowledge Library (distinct from career skills module)
import { Link } from "react-router-dom";
import SkillsPage from "../learning-companion/SkillsPage";

export default function SkillsOrgPage() {
  return (
    <div className="space-y-3">
      <div>
        <Link to="/app/superadmin/knowledge-library/organization" className="text-xs text-admin-accent hover:underline">
          ← Organization
        </Link>
        <p className="text-sm text-gray-500 mt-2">
          Bloom cognitive levels mapped on questions. Career skill taxonomy lives under Skills elsewhere.
        </p>
      </div>
      <SkillsPage />
    </div>
  );
}
