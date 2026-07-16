import { Navigate, useSearchParams } from "react-router-dom";

/** Maps legacy `/learning-companion/library` and `/library/*` tabs into Knowledge Library. */
export default function LegacyLibraryRedirect() {
  const [params] = useSearchParams();
  const tab = params.get("tab");
  const type = params.get("type");
  const status = params.get("status");
  const category = params.get("category");
  const tag = params.get("tag");
  const bloom = params.get("bloom");

  const qs = new URLSearchParams();
  if (type) qs.set("type", type);
  if (status) qs.set("status", status);
  if (category) qs.set("category", category);
  if (tag) qs.set("tag", tag);
  if (bloom) qs.set("bloom", bloom);
  const q = qs.toString() ? `?${qs}` : "";

  if (tab === "lessons") {
    return <Navigate to={`/app/superadmin/knowledge-library/assets/lessons${q}`} replace />;
  }
  if (tab === "flashcards") {
    return <Navigate to={`/app/superadmin/knowledge-library/assets/flashcards${q}`} replace />;
  }
  if (type === "coding_challenge") {
    return <Navigate to={`/app/superadmin/knowledge-library/assets/coding${q}`} replace />;
  }
  if (tab === "questions" || type || status || category || tag || bloom) {
    return <Navigate to={`/app/superadmin/knowledge-library/assets/questions${q}`} replace />;
  }
  return <Navigate to="/app/superadmin/knowledge-library" replace />;
}
