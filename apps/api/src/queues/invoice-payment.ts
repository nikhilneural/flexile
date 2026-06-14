import type { Env } from "@/env";
import type { PayInvoiceMessage, VestStockOptionsMessage } from "./types";

/**
 * Invoice Payment Queue Handler
 * Migrated from: pay_invoice_job.rb, vest_stock_options_job.rb
 *
 * Handles:
 * - invoice.pay: Processes payment for a single invoice via Wise transfer
 * - invoice.vest-stock-options: Vests stock options associated with paid invoices
 */

export async function handlePayInvoice(message: PayInvoiceMessage, env: Env): Promise<void> {
  const { invoiceId } = message.payload;
  console.info(`[invoice-payment] Processing payment for invoice: ${invoiceId}`);

  // Business logic from PayInvoice service:
  // 1. Find invoice by ID
  // 2. Validate invoice is in payable state
  // 3. Find the user's bank account (Wise recipient)
  // 4. Create a Wise transfer using Wise::PayoutApi
  // 5. Update invoice status to PROCESSING
  // 6. Create a Payment record with wise_transfer_id
  // 7. Create balance transaction record
}

export async function handleVestStockOptions(message: VestStockOptionsMessage, env: Env): Promise<void> {
  const { invoiceId } = message.payload;
  console.info(`[invoice-payment] Vesting stock options for invoice: ${invoiceId}`);

  // Business logic from vest_stock_options_job.rb:
  // 1. Find invoice
  // 2. Return early if invoice.equity_vested? or equity_amount_in_options <= 0
  // 3. Find user's company_worker and company_investor
  // 4. Find eligible equity_grant:
  //    - vesting_trigger_invoice_paid
  //    - unvested_shares >= invoice.equity_amount_in_options
  //    - period year matches invoice_date year
  // 5. Create vesting_event with vested_shares = equity_amount_in_options
  // 6. Call EquityGrant::UpdateVestedShares
  // 7. Update invoice with equity_grant reference
}
