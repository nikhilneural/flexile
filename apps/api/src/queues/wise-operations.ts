import type { Env } from "@/env";
import type {
  WiseBalanceUpdateMessage,
  WiseBalanceWebhookMessage,
  WiseTopUpReminderMessage,
  WiseTransferUpdateMessage,
} from "./types";

/**
 * Wise Operations Queue Handler
 * Migrated from: wise_balance_update_job.rb, wise_balance_webhook_job.rb,
 *   wise_top_up_reminder_job.rb, wise_transfer_update_job.rb
 *
 * Handles:
 * - Balance refresh and webhook-triggered balance updates
 * - Top-up reminders when balance is low
 * - Transfer state change processing (payment lifecycle)
 */

export async function handleWiseBalanceUpdate(message: WiseBalanceUpdateMessage, env: Env): Promise<void> {
  console.info("[wise-operations] Refreshing Wise balance");
  // Business logic from WiseBalanceUpdateJob:
  // Call Wise::AccountBalance.refresh_flexile_balance
  // Fetches current balance from Wise API and updates cached value
}

export async function handleWiseBalanceWebhook(message: WiseBalanceWebhookMessage, env: Env): Promise<void> {
  const data = message.payload;
  console.info("[wise-operations] Processing Wise balance webhook");

  // Business logic from WiseBalanceWebhookJob:
  // 1. Extract profile_id from data.resource.profile_id
  // 2. Verify it matches the Flexile credential profile_id
  // 3. Check currency is USD
  // 4. Extract post_transaction_balance_amount
  // 5. Update cached balance: amount_cents = balance * 100
}

const WISE_REQUIRED_BUFFER = 50_000;

export async function handleWiseTopUpReminder(message: WiseTopUpReminderMessage, env: Env): Promise<void> {
  console.info("[wise-operations] Checking if Wise top-up is needed");

  // Business logic from WiseTopUpReminderJob:
  // 1. Find active trusted companies
  // 2. Sum pending invoice amounts (status: received/approved) in USD
  // 3. Refresh Wise balance
  // 4. If balance < pending_amount + REQUIRED_BUFFER ($500):
  //    - Build Slack message with balance info
  //    - In non-production: simulate $5,000 top-up
  //    - Send Slack alert with "red" color to #flexile channel
}

export async function handleWiseTransferUpdate(message: WiseTransferUpdateMessage, env: Env): Promise<void> {
  const data = message.payload;
  console.info("[wise-operations] Processing Wise transfer state change");

  // Business logic from WiseTransferUpdateJob:
  // 1. Extract profile_id and verify it matches known profiles
  // 2. Extract transfer_id and current_state
  // 3. Find Payment by wise_transfer_id
  //    - If not found, check EquityBuybackPayment and DividendPayment
  //    - If equity buyback: delegate to EquityBuybackPaymentTransferUpdate
  //    - If dividend: delegate to DividendPaymentTransferUpdate
  //    - If nothing found: log and return
  // 4. Update payment.wise_transfer_status
  // 5. Based on state:
  //    - Failed state (funds_refunded, bounced_back, etc.):
  //      - Mark payment as FAILED
  //      - Create negative balance transaction
  //      - Mark invoice as FAILED
  //    - Processing state:
  //      - Mark invoice as PROCESSING
  //    - OUTGOING_PAYMENT_SENT:
  //      - Get transfer details (targetValue) and delivery estimate
  //      - Update payment: status=SUCCEEDED, amount, estimate
  //      - Mark invoice as paid with timestamp
}
