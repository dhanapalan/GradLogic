import { Navigate, useParams } from "react-router-dom";

/** Legacy /courses/:id → Catalog detail */
export default function LegacyCourseCatalogRedirect() {
  const { courseId } = useParams();
  return <Navigate to={`/app/superadmin/course-catalog/courses/${courseId}`} replace />;
}
