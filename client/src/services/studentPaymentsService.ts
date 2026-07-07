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

const studentPaymentsService = {
  /** The logged-in student's own fee records + summary. */
  async getMyFees(): Promise<MyFees> {
    const { data } = await api.get("/billing/my-fees");
    return data.data;
  },
};

export default studentPaymentsService;
