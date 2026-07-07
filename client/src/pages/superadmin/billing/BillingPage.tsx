import { useEffect, useState } from "react";
import {
  BanknotesIcon,
  CheckCircleIcon,
  ClockIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";
import toast from "react-hot-toast";
import analyticsService, { BillingSummary } from "../../../services/analyticsService";
import StatusBadge from "../../../components/superadmin/StatusBadge";

const inr = (n: number | string) => `₹${Number(n).toLocaleString("en-IN")}`;

export default function BillingPage() {
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        setSummary(await analyticsService.getBillingSummary());
      } catch (error) {
        toast.error("Failed to load billing summary");
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8">
        <h2 className="text-2xl font-semibold tracking-tight text-gray-900 mb-2">Billing</h2>
        <div className="p-12 text-center text-gray-600">Loading billing summary...</div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8">
        <h2 className="text-2xl font-semibold tracking-tight text-gray-900 mb-2">Billing</h2>
        <p className="text-gray-600">Billing data is unavailable.</p>
      </div>
    );
  }

  const collectionRate =
    summary.expected > 0 ? Math.round((summary.collected / summary.expected) * 100) : 0;

  const cards = [
    {
      title: `Expected (${summary.academic_year})`,
      value: inr(summary.expected),
      note: `${summary.total_students} students × ${inr(summary.fee_per_student)}`,
      icon: UserGroupIcon,
      color: "text-admin-accent bg-navy-900/[0.06]",
    },
    {
      title: "Collected",
      value: inr(summary.collected),
      note: `${collectionRate}% of expected`,
      icon: BanknotesIcon,
      color: "text-green-600 bg-green-50",
    },
    {
      title: "Paid Students",
      value: `${summary.paid} / ${summary.total_students}`,
      note: "payments recorded",
      icon: CheckCircleIcon,
      color: "text-purple-600 bg-purple-50",
    },
    {
      title: "Pending Payments",
      value: String(summary.pending),
      note: "awaiting collection",
      icon: ClockIcon,
      color: "text-orange-600 bg-orange-50",
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h2 className="text-2xl font-semibold tracking-tight text-gray-900">Billing</h2>
        <p className="text-gray-600 mt-1">
          Per-student fees — {inr(summary.fee_per_student)} per student for academic year{" "}
          {summary.academic_year}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.title} className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-600">{card.title}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{card.value}</p>
                  <p className="text-xs text-gray-500 mt-1">{card.note}</p>
                </div>
                <div className={`rounded-lg p-2 ${card.color}`}>
                  <Icon className="w-6 h-6" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Per-college collection */}
        <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card overflow-hidden">
          <div className="bg-gray-50/70 border-b border-gray-200 px-6 py-3">
            <h3 className="font-semibold text-gray-900">Collection by College</h3>
          </div>
          {summary.by_college.length === 0 ? (
            <div className="p-8 text-center text-gray-600">No colleges found</div>
          ) : (
            <table className="w-full">
              <thead className="border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">College</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Students</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Paid</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Collected</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {summary.by_college.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{c.name}</td>
                    <td className="px-6 py-4 text-sm text-right text-gray-600">{c.students}</td>
                    <td className="px-6 py-4 text-sm text-right text-gray-600">{c.paid}</td>
                    <td className="px-6 py-4 text-sm text-right font-medium text-gray-900">
                      {inr(c.collected)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Recent payments */}
        <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card overflow-hidden">
          <div className="bg-gray-50/70 border-b border-gray-200 px-6 py-3">
            <h3 className="font-semibold text-gray-900">Recent Payments</h3>
          </div>
          {summary.recent_payments.length === 0 ? (
            <div className="p-8 text-center text-gray-600">No payments recorded yet</div>
          ) : (
            <table className="w-full">
              <thead className="border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Student</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">College</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {summary.recent_payments.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {p.student_name || "—"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{p.college_name || "—"}</td>
                    <td className="px-6 py-4 text-sm text-right text-gray-900">{inr(p.amount)}</td>
                    <td className="px-6 py-4 text-sm">
                      <StatusBadge
                        status={p.status === "paid" ? "success" : "pending"}
                        label={p.status}
                        size="sm"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
