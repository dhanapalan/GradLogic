import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  CreditCard,
  CheckCircle2,
  Clock,
  AlertCircle,
  ShieldCheck,
  ArrowLeft,
  Wallet,
  Info,
} from "lucide-react";
import studentPaymentsService, {
  FeeStatus,
  StudentFeeRecord,
} from "../../services/studentPaymentsService";

function formatINR(n: number) {
  return `₹${Number(n || 0).toLocaleString("en-IN")}`;
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const STATUS_STYLES: Record<FeeStatus, { badge: string; label: string; icon: typeof CheckCircle2 }> = {
  paid: { badge: "bg-emerald-50 text-emerald-600 border-emerald-100", label: "Paid", icon: CheckCircle2 },
  pending: { badge: "bg-amber-50 text-amber-600 border-amber-100", label: "Pending", icon: Clock },
  overdue: { badge: "bg-rose-50 text-rose-600 border-rose-100", label: "Overdue", icon: AlertCircle },
  waived: { badge: "bg-slate-100 text-slate-500 border-slate-200", label: "Waived", icon: ShieldCheck },
};

function StatusBadge({ status }: { status: FeeStatus }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.pending;
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${s.badge}`}>
      <Icon className="h-3 w-3" />
      {s.label}
    </span>
  );
}

export default function PaymentsPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["student-my-fees"],
    queryFn: () => studentPaymentsService.getMyFees(),
    staleTime: 60_000,
  });

  const current = data?.current;
  const history = data?.history ?? [];

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500 pb-20 px-2">
      {/* Header */}
      <div className="flex items-center justify-between bg-white rounded-2xl px-6 py-4 border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
            <Wallet className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900 tracking-tight leading-tight">Payments</h1>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              Your annual placement-prep fee and payment history
            </p>
          </div>
        </div>
        <Link
          to="/app/student-portal"
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-50 hover:bg-indigo-50 text-sm font-bold text-slate-600 hover:text-indigo-600 border border-slate-100 hover:border-indigo-100 transition-all"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      </div>

      {isError && (
        <div className="rounded-2xl border border-rose-100 bg-rose-50 px-5 py-4 text-sm font-bold text-rose-600">
          Could not load your payment details. Please refresh or try again later.
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-slate-50 border border-slate-100" />
          ))}
        </div>
      ) : (
        <>
          {/* Fee status cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Current Fee — {data?.current_academic_year}
              </p>
              <div className="mt-3 flex items-center gap-3">
                <span className="text-3xl font-black text-slate-900 tabular-nums">
                  {formatINR(current?.amount ?? data?.fee_per_student ?? 500)}
                </span>
                {current ? (
                  <StatusBadge status={current.status} />
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <Info className="h-3 w-3" /> Not generated
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 font-medium mt-2">
                {current?.status === "paid"
                  ? <>Paid on {formatDate(current.paid_at)}{current.payment_method ? ` · ${current.payment_method}` : ""}</>
                  : current
                    ? "Payment is collected by your college placement office."
                    : "No fee record has been generated for you yet."}
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Paid</p>
              <div className="mt-3 text-3xl font-black text-slate-900 tabular-nums">
                {formatINR(data?.total_paid ?? 0)}
              </div>
              <p className="text-xs text-slate-400 font-medium mt-2">
                Across {history.filter((p) => p.status === "paid").length} payment
                {history.filter((p) => p.status === "paid").length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          {/* Offline-collection notice */}
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 px-5 py-4 flex items-start gap-3">
            <CreditCard className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />
            <p className="text-xs font-semibold text-indigo-900 leading-relaxed">
              The annual placement-preparation fee ({formatINR(data?.fee_per_student ?? 500)} per academic year)
              is collected by your college's placement office (cash, UPI, card, or bank transfer). This page reflects
              what they have recorded — reach out to them to make or confirm a payment.
            </p>
          </div>

          {/* History */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-50">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Payment History</h3>
            </div>
            {history.length === 0 ? (
              <div className="p-10 text-center">
                <Wallet className="h-8 w-8 text-slate-200 mx-auto mb-3" />
                <p className="text-sm font-bold text-slate-400">No payment records yet</p>
                <p className="text-xs text-slate-300 mt-1">
                  Records appear here once your college generates fees for the year.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Academic Year</th>
                      <th className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Paid On</th>
                      <th className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Method</th>
                      <th className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                      <th className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {history.map((p: StudentFeeRecord) => (
                      <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-3.5">
                          <p className="text-sm font-bold text-slate-900">{p.academic_year}</p>
                          {p.department && <p className="text-[11px] text-slate-400">{p.department}</p>}
                        </td>
                        <td className="px-5 py-3.5 text-xs font-medium text-slate-500">{formatDate(p.paid_at)}</td>
                        <td className="px-5 py-3.5 text-xs font-medium text-slate-500 capitalize">
                          {p.payment_method?.replace("_", " ") ?? "—"}
                        </td>
                        <td className="px-5 py-3.5"><StatusBadge status={p.status} /></td>
                        <td className="px-5 py-3.5 text-right text-sm font-black text-slate-900 tabular-nums">
                          {formatINR(p.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
