// =============================================================================
// Placeholder for Super Admin nav leaves that do not have a real page yet.
// Swapped out once the backing UI (+ data model, if needed) lands.
// =============================================================================

import { LucideIcon, Construction } from "lucide-react";

interface Props {
  icon: LucideIcon;
  title: string;
  description: string;
}

export default function ComingSoonPage({ icon: Icon, title, description }: Props) {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-navy-900/[0.06] rounded-lg">
          <Icon className="w-5 h-5 text-navy-900" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
          <p className="text-sm text-gray-500">{description}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-10 text-center">
        <Construction className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-sm font-medium text-gray-700">Coming soon</p>
        <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
          This area is planned but not built yet. The sidebar entry is in place so the
          information architecture stays complete while the feature is implemented.
        </p>
      </div>
    </div>
  );
}
