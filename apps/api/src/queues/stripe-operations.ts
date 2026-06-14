import type { Env } from "@/env";
import type { StripeBalanceTopUpMessage, TransferFromStripeToWiseMessage, StripeEventMessage } from "./types";

/**
 * Stripe Operations Queue Handler
 * Migrated from: stripe_balance_top_up_job.rb, transfer_from_stripe_to_wise_job.rb,
 *   Stripe::EventHandler service
 *
 * Handles:
 * - Weekly Stripe balance top-up to maintain minimum balance
 * - Transferring funds from Stripe to Wise for payment processing
 * - Processing Stripe webhook events
 */

const TOPUP_TARGET = 500_000; // $5,000 in cents
const USD_CURRENCY = "USD";

export async function handleStripeBalanceTopUp(message: StripeBalanceTopUpMessage, env: Env): Promise<void> {
  console.info("[stripe-operations] Checking Stripe balance for top-up");

  // Business logic from StripeBalanceTopUpJob:
  // 1. Retrieve Stripe balance, filter for USD
  // 2. Calculate: topup_amount = max(TOPUP_TARGET - (available + pending), 0)
  // 3. If topup needed:
  //    - Find Gumroad company and fetch its Stripe setup intent
  //    - Create PaymentIntent for the topup amount using ACH
  // 4. Send Slack notification with balance info:
  //    - Available balance, pending balance, top-up amount
  //    - Link to Stripe dashboard
}

export async function handleTransferFromStripeToWise(
  message: TransferFromStripeToWiseMessage,
  env: Env,
): Promise<void> {
  console.info("[stripe-operations] Processing eligible Stripe-to-Wise transfers");

  // Business logic from TransferFromStripeToWiseJob:
  // 1. Find ConsolidatedPayments where:
  //    - stripe_payout_id is null
  //    - trigger_payout_after < now
  // 2. For each eligible payment:
  //    - Call CreatePayoutForConsolidatedPayment service
  //    - Service creates a Stripe payout with metadata
  //    - Updates the record with stripe_payout_id
  //    - Errors are caught and logged (non-fatal)
}

export async function handleStripeEvent(message: StripeEventMessage, env: Env): Promise<void> {
  const { eventType, eventData, eventId } = message.payload;
  console.info(`[stripe-operations] Processing Stripe event: ${eventType} (${eventId})`);

  // Business logic from Stripe::EventHandler:
  switch (eventType) {
    case "setup_intent.succeeded":
      // Find CompanyStripeAccount by setup_intent_id
      // Update status to READY, fetch and store bank_account_last_four
      break;

    case "setup_intent.canceled":
      // Find CompanyStripeAccount by setup_intent_id
      // Update status to CANCELLED, set deleted_at
      break;

    case "setup_intent.setup_failed":
      // Find CompanyStripeAccount by setup_intent_id
      // Update status to FAILED
      // If error code is "setup_intent_setup_attempt_expired":
      //   mark deleted, send microdeposit_verification_expired email to admins
      break;

    case "setup_intent.requires_action":
      // Find CompanyStripeAccount by setup_intent_id
      // Update status to ACTION_REQUIRED, fetch bank_account_last_four
      // If next_action.type == "verify_with_microdeposits" and company completed onboarding:
      //   Send verify_stripe_microdeposits email to admins
      break;

    case "charge.refunded":
      // Find ConsolidatedPayment by stripe_payment_intent_id
      // Mark as refunded
      break;

    case "payment_intent.succeeded":
    case "payment_intent.payment_failed":
    case "payment_intent.canceled":
      // Find ConsolidatedPayment by stripe_payment_intent_id
      // Enqueue ProcessPaymentIntentMessage
      break;

    case "payout.paid":
      // Only process non-automatic payouts with consolidated_invoice metadata
      // Find ConsolidatedPayment by stripe_payout_id
      // Enqueue ProcessPayoutMessage
      break;

    case "issuing_transaction.created":
      // Find ExpenseCard by card ID
      // Create ExpenseCardCharge with merchant data, amount, and transaction reference
      break;

    case "issuing_transaction.updated":
      // Find ExpenseCardCharge by processor_transaction_reference
      // Update processor_transaction_data
      break;

    default:
      console.info(`[stripe-operations] Unhandled event type: ${eventType}`);
  }
}
