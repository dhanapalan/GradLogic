/**
 * Stripe Payment Gateway Integration
 *
 * Replaces mockPaymentGateway.service.ts for production payment processing.
 * Handles:
 * - Subscription creation and management
 * - Invoice generation and payment
 * - Webhook signature verification
 * - Payment confirmation
 */

import Stripe from "stripe";
import { query, queryOne } from "../config/database.js";
import { logger } from "../config/logger.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2023-10-16",
});

export interface PaymentOrder {
  order_id: string;
  amount: number; // in rupees
  currency: "INR";
  key: string; // Stripe publishable key
  receipt: string;
  created_at: string;
  client_secret?: string;
}

export interface PaymentVerification {
  verified: boolean;
  payment_id: string;
  order_id: string;
  amount: number;
  status: string;
}

/**
 * Create a payment order (uses Stripe Payment Intent)
 * Amount is converted from rupees to paise (smallest unit)
 */
export async function createOrder(params: {
  amount: number;
  receipt: string;
  collegeId: string;
  description?: string;
}): Promise<PaymentOrder> {
  try {
    const intent = await stripe.paymentIntents.create({
      amount: params.amount * 100, // Convert to paise
      currency: "inr",
      receipt_email: `college-${params.collegeId}@gradlogic.in`,
      description: params.description || `Invoice: ${params.receipt}`,
      metadata: {
        collegeId: params.collegeId,
        receipt: params.receipt,
      },
    });

    logger.info("Stripe payment intent created", {
      intentId: intent.id,
      amount: params.amount,
    });

    return {
      order_id: intent.id,
      amount: params.amount,
      currency: "INR",
      key: process.env.STRIPE_PUBLISHABLE_KEY || "",
      receipt: params.receipt,
      created_at: new Date().toISOString(),
      client_secret: intent.client_secret || undefined,
    };
  } catch (err) {
    logger.error("Failed to create Stripe payment intent", { error: err });
    throw err;
  }
}

/**
 * Verify payment completion
 * Called after client receives webhook or on manual verification
 */
export async function verifyPayment(params: {
  order_id: string;
  payment_id: string;
}): Promise<PaymentVerification> {
  try {
    const intent = await stripe.paymentIntents.retrieve(params.order_id);

    const verified =
      intent.status === "succeeded" &&
      intent.charges.data.length > 0 &&
      intent.charges.data[0].id === params.payment_id;

    logger.info("Stripe payment verified", {
      intentId: params.order_id,
      verified,
      status: intent.status,
    });

    return {
      verified,
      payment_id: params.payment_id,
      order_id: params.order_id,
      amount: (intent.amount || 0) / 100,
      status: intent.status,
    };
  } catch (err) {
    logger.error("Failed to verify Stripe payment", { error: err });
    return {
      verified: false,
      payment_id: params.payment_id,
      order_id: params.order_id,
      amount: 0,
      status: "error",
    };
  }
}

/**
 * Handle Stripe webhook events
 * Processes payment confirmations, disputes, etc.
 */
export async function handleWebhook(
  body: Buffer | string,
  signature: string,
): Promise<{ processed: boolean; eventId?: string }> {
  try {
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET || "",
    );

    logger.info("Stripe webhook received", { type: event.type });

    switch (event.type) {
      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;
      case "payment_intent.payment_failed":
        await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
        break;
      case "charge.dispute.created":
        await handleDisputeCreated(event.data.object as Stripe.Dispute);
        break;
      default:
        logger.info("Unhandled webhook type", { type: event.type });
    }

    return { processed: true, eventId: event.id };
  } catch (err) {
    logger.error("Webhook processing failed", { error: err });
    return { processed: false };
  }
}

/**
 * Handle successful payment
 * Update invoice and subscription status
 */
async function handlePaymentIntentSucceeded(intent: Stripe.PaymentIntent) {
  const receipt = intent.metadata?.receipt;
  const collegeId = intent.metadata?.collegeId;

  if (!receipt || !collegeId) {
    logger.warn("Webhook: missing metadata", { metadata: intent.metadata });
    return;
  }

  try {
    // Find and update invoice
    await queryOne(
      `UPDATE invoices
       SET status = 'paid', amount_paid = $1, paid_date = NOW()
       WHERE college_id = $2 AND invoice_number = $3`,
      [intent.amount / 100, collegeId, receipt],
    );

    // Update subscription if needed
    const subscription = await queryOne(
      `SELECT s.id FROM subscriptions s
       WHERE s.college_id = $1 AND s.status = 'pending_payment'
       LIMIT 1`,
      [collegeId],
    );

    if (subscription) {
      await queryOne(
        `UPDATE subscriptions
         SET status = 'active'
         WHERE id = $1`,
        [subscription.id],
      );
    }

    logger.info("Payment processed successfully", { receipt, collegeId });
  } catch (err) {
    logger.error("Failed to update invoice after payment", { error: err });
  }
}

/**
 * Handle failed payment
 * Mark invoice as failed, notify college admin
 */
async function handlePaymentIntentFailed(intent: Stripe.PaymentIntent) {
  const receipt = intent.metadata?.receipt;
  const collegeId = intent.metadata?.collegeId;

  if (!receipt || !collegeId) {
    logger.warn("Webhook: missing metadata in failed payment", {
      metadata: intent.metadata,
    });
    return;
  }

  try {
    await queryOne(
      `UPDATE invoices
       SET status = 'failed'
       WHERE college_id = $1 AND invoice_number = $2`,
      [collegeId, receipt],
    );

    logger.info("Payment failed", {
      receipt,
      collegeId,
      reason: intent.last_payment_error?.message,
    });
  } catch (err) {
    logger.error("Failed to mark invoice as failed", { error: err });
  }
}

/**
 * Handle chargeback/dispute
 * Mark invoice and update subscription status
 */
async function handleDisputeCreated(dispute: Stripe.Dispute) {
  const chargeId = typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id;

  if (!chargeId) {
    logger.warn("Dispute without charge ID", { dispute });
    return;
  }

  try {
    await queryOne(
      `UPDATE invoices
       SET status = 'disputed'
       WHERE stripe_charge_id = $1`,
      [chargeId],
    );

    logger.info("Dispute created", { chargeId, disputeId: dispute.id });
  } catch (err) {
    logger.error("Failed to update invoice after dispute", { error: err });
  }
}

/**
 * Create a Stripe subscription for recurring billing
 */
export async function createSubscription(params: {
  customerId: string;
  priceId: string;
  collegeId: string;
  trialDays?: number;
}): Promise<Stripe.Subscription> {
  try {
    const subscription = await stripe.subscriptions.create({
      customer: params.customerId,
      items: [{ price: params.priceId }],
      trial_period_days: params.trialDays || 14,
      metadata: { collegeId: params.collegeId },
    });

    logger.info("Stripe subscription created", {
      subscriptionId: subscription.id,
      collegeId: params.collegeId,
    });

    return subscription;
  } catch (err) {
    logger.error("Failed to create Stripe subscription", { error: err });
    throw err;
  }
}

/**
 * Create Stripe customer for a college
 */
export async function createCustomer(params: {
  collegeId: string;
  name: string;
  email: string;
}): Promise<Stripe.Customer> {
  try {
    const customer = await stripe.customers.create({
      name: params.name,
      email: params.email,
      metadata: { collegeId: params.collegeId },
      description: `College: ${params.name}`,
    });

    logger.info("Stripe customer created", {
      customerId: customer.id,
      collegeId: params.collegeId,
    });

    return customer;
  } catch (err) {
    logger.error("Failed to create Stripe customer", { error: err });
    throw err;
  }
}
