import api from "../lib/api";

export type FeeStatus = "pending" | "paid" | "overdue" | "waived";

export interface StudentFeeRecord {
  id: string;
  academic_year: string;
  department: string | null;
  amount: number;
  status: FeeStatus;
  paid_at: string | null;
  payment_method: string | null;
  payment_ref: string | null;
  college_name: string | null;
}

export interface MyFees {
  fee_per_student: number;
  current_academic_year: string;
  current: StudentFeeRecord | null;
  total_paid: number;
  history: StudentFeeRecord[];
}

export interface MockOrder {
  order_id: string;
  amount: number;
  currency: "INR";
  key: string;
  receipt: string;
  created_at: string;
}

export interface PaymentResult {
  id: string;
  student_id: string;
  amount: number;
  status: FeeStatus;
  paid_at: string | null;
  payment_method: string | null;
  payment_ref: string | null;
}

const studentPaymentsService = {
  /** The logged-in student's own fee records + summary. */
  async getMyFees(): Promise<MyFees> {
    const { data } = await api.get("/billing/my-fees");
    return data.data;
  },

  /**
   * Start paying a pending fee. Backed by a mock gateway for now (see
   * server/src/services/mockPaymentGateway.service.ts) — swap for a real
   * checkout widget (Razorpay/Stripe) once a merchant account exists.
   */
  async createOrder(feeId: string): Promise<MockOrder> {
    const { data } = await api.post(`/billing/student-fees/${feeId}/create-order`);
    return data.data;
  },

  /** Confirm the (mock) payment and mark the fee paid. */
  async verifyPayment(
    feeId: string,
    payload: { order_id: string; payment_id: string; signature?: string }
  ): Promise<PaymentResult> {
    const { data } = await api.post(`/billing/student-fees/${feeId}/verify-payment`, payload);
    return data.data;
  },
};

export default studentPaymentsService;
