/**
 * Mock payment gateway.
 *
 * Stands in for a real processor (Razorpay/Stripe/PayU/Cashfree) so the
 * "student pays directly" flow can be built and tested end-to-end before a
 * real merchant account exists. The API shape intentionally mirrors
 * Razorpay's order-create → checkout → verify pattern so swapping this out
 * later is a service-level change, not a route/schema rewrite:
 *
 *   1. createOrder()   ~= razorpay.orders.create()
 *   2. (client would normally open a checkout widget here)
 *   3. verifyPayment() ~= verifying the checkout's payment_id/signature
 *
 * TODO(payments): replace this file with a real gateway SDK before
 * production. In particular:
 *   - createOrder() should call the real gateway and persist the order id.
 *   - verifyPayment() must validate a real signature/webhook, not just
 *     check that the caller supplied a payment_id.
 *   - Add a webhook endpoint for async/delayed payment confirmation
 *     (UPI intents, bank transfers, etc. don't always confirm synchronously).
 */

import { randomBytes } from "crypto";

export interface MockOrder {
  order_id: string;
  amount: number; // in rupees (not paise) to match student_payments.amount
  currency: "INR";
  key: string; // stand-in for a gateway's public/checkout key
  receipt: string;
  created_at: string;
}

export interface MockVerifyInput {
  order_id: string;
  payment_id: string;
  signature?: string; // accepted but not cryptographically checked — mock only
}

export interface MockVerifyResult {
  verified: boolean;
  payment_id: string;
  order_id: string;
}

function randomId(prefix: string): string {
  return `${prefix}_${randomBytes(9).toString("hex")}`;
}

/**
 * Create a mock order for a given fee record. Real gateways require the
 * amount up front (usually in the smallest currency unit) and return an
 * order id the client uses to open the checkout widget.
 */
export function createOrder(params: { amount: number; receipt: string }): MockOrder {
  return {
    order_id: randomId("mock_order"),
    amount: params.amount,
    currency: "INR",
    key: "mock_key_id",
    receipt: params.receipt,
    created_at: new Date().toISOString(),
  };
}

/**
 * "Verify" a completed mock payment. Always succeeds as long as a
 * payment_id is present — there is no real money movement or signature to
 * check yet. This is the single function to replace when a real gateway is
 * wired in.
 */
export function verifyPayment(input: MockVerifyInput): MockVerifyResult {
  const verified = Boolean(input.order_id && input.payment_id);
  return {
    verified,
    payment_id: input.payment_id,
    order_id: input.order_id,
  };
}
