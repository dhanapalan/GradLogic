// Categories under Knowledge Library — reuses existing categories API
import { Link } from "react-router-dom";
import CategoriesPage from "../learning-companion/CategoriesPage";

export default function CategoriesOrgPage() {
  return (
    <div className="space-y-3">
      <Link to="/app/superadmin/knowledge-library/organization" className="text-xs text-admin-accent hover:underline">
        ← Organization
      </Link>
      <CategoriesPage />
    </div>
  );
}
