// =============================================================================
// License — platform subscription / seat billing view for Administration.
// =============================================================================

import { useEffect, useState } from "react";
import { BadgeCheck, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import analyticsService, { type BillingSummary } from "../../../services/analyticsService";
import settingsService from "../../../services/settingsService";
import { PageHeader, StatTile } from "../features/FeatureUi";

const inr = (n: number | string) => `₹${Number(n).toLocaleString("en-IN")}`;

export default function LicensePage() {
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [planName, setPlanName] = useState("GradLogic Platform");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      analyticsService.getBillingSummary().catch(() => null),
      settingsService.getSettings().catch(() => ({})),
    ])
      .then(([billing, settings]) => {
        setSummary(billing);
        const name = String((settings as Record<string, unknown>)["license.plan_name"] ?? "");
        if (name) setPlanName(name);
      })
      .catch(() => toast.error("Failed to load license details"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <PageHeader
        icon={BadgeCheck}
        title="License"
        description="Platform plan, seats, and collection status for the current academic year."
      />

      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <p className="text-xs uppercase tracking-wide text-gray-400">Active plan</p>
        <p className="mt-1 text-xl font-semibold text-gray-900">{planName}</p>
        <p className="text-sm text-gray-500 mt-1">
          Academic year: {summary?.academic_year || "—"}
        </p>
      </div>

      {!summary ? (
        <p className="text-sm text-gray-500">Billing / seat data is unavailable.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatTile label="Expected" value={inr(summary.expected ?? 0)} />
            <StatTile label="Collected" value={inr(summary.collected ?? 0)} />
            <StatTile label="Pending" value={summary.pending ?? 0} />
            <StatTile label="Students billed" value={summary.total_students ?? 0} />
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-600">
            <p>
              Seat and fee configuration lives under{" "}
              <a href="/app/superadmin/settings" className="text-admin-accent hover:underline">
                Platform Settings
              </a>
              . Detailed college billing remains at{" "}
              <a href="/app/superadmin/billing" className="text-admin-accent hover:underline">
                Billing
              </a>
              .
            </p>
          </div>
        </>
      )}
    </div>
  );
}
