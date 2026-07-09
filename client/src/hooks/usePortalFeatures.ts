import { useQuery } from "@tanstack/react-query";
import platformModulesService from "../services/platformModulesService";
import { ALL_FEATURE_KEYS, type PlatformFeatureKey } from "../constants/platformFeatures";
import type { EnabledLmsModule } from "../constants/lmsModules";

type PortalKind = "college" | "student";

/**
 * Fetches enabled platform features and LMS module groups for the current user's college.
 */
export function usePortalFeatures(portal: PortalKind) {
  const query = useQuery({
    queryKey: ["portal-features", portal],
    queryFn: () =>
      portal === "college"
        ? platformModulesService.getCollegePortalFeatures()
        : platformModulesService.getStudentPortalFeatures(),
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const features: PlatformFeatureKey[] = query.data?.features ?? ALL_FEATURE_KEYS;
  const modules: EnabledLmsModule[] = query.data?.modules ?? [];
  const enabledModuleKeys = modules.map((m) => m.key);

  const hasFeature = (key: PlatformFeatureKey | null | undefined): boolean => {
    if (!key) return true;
    return features.includes(key);
  };

  const hasModule = (moduleKey: string | null | undefined): boolean => {
    if (!moduleKey) return true;
    return enabledModuleKeys.includes(moduleKey);
  };

  return {
    features,
    modules,
    enabledModuleKeys,
    hasFeature,
    hasModule,
    isLoading: query.isLoading,
    error: query.error,
  };
}
