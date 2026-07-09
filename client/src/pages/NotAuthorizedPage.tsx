import { Link, useLocation } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import { getLandingPath } from "../components/ProtectedRoute";
import { featureLabel } from "../constants/platformFeatures";

interface FeatureDisabledState {
  reason?: string;
  feature?: string;
  portal?: string;
}

export default function NotAuthorizedPage() {
  const user = useAuthStore((s) => s.user);
  const location = useLocation();
  const state = (location.state ?? {}) as FeatureDisabledState;
  const isFeatureDisabled = state.reason === "feature_disabled" && state.feature;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="text-center max-w-md">
        <div
          className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full ${
            isFeatureDisabled ? "bg-amber-100" : "bg-red-100"
          }`}
        >
          <svg
            className={`h-10 w-10 ${isFeatureDisabled ? "text-amber-600" : "text-red-600"}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            {isFeatureDisabled ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m0 0v2m0-2h2m-2 0H10m4-6V7a4 4 0 00-8 0v4m12 0a2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2v-6a2 2 0 012-2h14z"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
              />
            )}
          </svg>
        </div>

        <h1 className="mt-6 text-3xl font-bold text-gray-900">
          {isFeatureDisabled ? "Feature Not Enabled" : "Access Denied"}
        </h1>
        <p className="mt-2 text-gray-500">
          {isFeatureDisabled
            ? `${featureLabel(state.feature!)} is not included in your campus subscription. Contact your administrator or GradLogic support.`
            : "You don't have permission to view this page."}
        </p>
        {!isFeatureDisabled && (
          <p className="mt-1 text-sm text-gray-400">
            Your role:{" "}
            <span className="font-medium text-gray-600">{user?.role ?? "unknown"}</span>
          </p>
        )}

        <Link to={getLandingPath(user)} className="btn-primary mt-8 inline-block">
          Go to your Dashboard
        </Link>
      </div>
    </div>
  );
}
