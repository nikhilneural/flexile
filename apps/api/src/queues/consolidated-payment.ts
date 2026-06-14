import type { Env } from "@/env";
import type {
  ChargeConsolidatedInvoiceMessage,
  CreatePayoutMessage,
  ProcessPaymentIntentMessage,
  ProcessPayoutMessage,
} from "./types";

/**
 * Consolidated Payment Queue Handler
 * Migrated from: process_consolidated_payment_job.rb, charge_consolidated_invoice_job.rb,
 *   process_payment_intent_for_consolidated_payment_job.rb,
 *   process_payout_for_consolidated_payment_job.rb
 *
 * Handles the full payment lifecycle:
 * - Charging consolidated invoices via Stripe
 * - Processing payment intent status changes (succeeded/failed/canceled)
 * - Creating Stripe payouts
 * - Processing payout completion and triggering individual payments
 */

export async function handleChargeConsolidatedInvoice(
  message: ChargeConsolidatedInvoiceMessage,
  env: Env,
): Promise<void> {
  const { consolidatedInvoiceId } = message.payload;
  console.info(`[consolidated-payment] Charging consolidated invoice: ${consolidatedInvoiceId}`);

  // Business logic from ChargeConsolidatedInvoice service:
  // 1. Find ConsolidatedInvoice
  // 2. Retrieve Stripe setup intent for the company
  // 3. Create Stripe PaymentIntent with ACH debit
  // 4. Create ConsolidatedPayment record with stripe_payment_intent_id
  // 5. Create balance transaction
}

export async function handleProcessPaymentIntent(message: ProcessPaymentIntentMessage, env: Env): Promise<void> {
  const { consolidatedPaymentId } = message.payload;
  console.info(`[consolidated-payment] Processing payment intent for: ${consolidatedPaymentId}`);

  // Business logic from ProcessPaymentIntentForConsolidatedPaymentJob:
  // 1. Find ConsolidatedPayment
  // 2. Return if already processed
  // 3. Retrieve PaymentIntent from Stripe
  // 4. Lock the record to prevent concurrent processing
  // 5. Based on payment_intent.status:
  //    - "succeeded": mark SUCCEEDED, record stripe fee, set trigger_payout_after
  //      (available_on + 2 day dispute window for non-trusted companies)
  //      Also create consolidated invoice receipt
  //    - "requires_payment_method": mark FAILED, create negative balance transaction, mark invoice FAILED
  //    - "canceled": mark CANCELLED, create negative balance transaction
}

export async function handleCreatePayout(message: CreatePayoutMessage, env: Env): Promise<void> {
  const { consolidatedPaymentId } = message.payload;
  console.info(`[consolidated-payment] Creating payout for: ${consolidatedPaymentId}`);

  // Business logic from CreatePayoutForConsolidatedPayment service:
  // 1. Find ConsolidatedPayment where stripe_payout_id is null and trigger_payout_after < now
  // 2. Create a Stripe Payout for the amount
  // 3. Update ConsolidatedPayment with stripe_payout_id
}

export async function handleProcessPayout(message: ProcessPayoutMessage, env: Env): Promise<void> {
  const { consolidatedPaymentId } = message.payload;
  console.info(`[consolidated-payment] Processing payout for: ${consolidatedPaymentId}`);

  // Business logic from ProcessPayoutForConsolidatedPaymentJob:
  // 1. Find ConsolidatedPayment
  // 2. Return if already processed (succeeded_at present)
  // 3. Retrieve Payout from Stripe
  // 4. Lock and verify not processed
  // 5. If payout.status == "paid":
  //    - Update succeeded_at = now
  //    - Mark consolidated_invoice as paid
  //    - Trigger individual payments (consolidated_invoice.trigger_payments)
}
