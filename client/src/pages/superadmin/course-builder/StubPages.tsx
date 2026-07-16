import { Link } from "react-router-dom";
import { COURSE_BUILDER_BASE as BASE } from "../../../services/courseBuilderService";

export default function ComingSoonStubPage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="max-w-xl rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center">
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      <p className="mt-2 text-sm text-gray-500">{description}</p>
      <Link to={BASE} className="mt-4 inline-block text-sm text-admin-accent hover:underline">
        ← Back to dashboard
      </Link>
    </div>
  );
}
