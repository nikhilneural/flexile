import type { Env } from "@/env";
import type { PayAllEquityBuybacksMessage, InvestorEquityBuybacksPaymentMessage } from "./types";

/**
 * Equity Buybacks Queue Handler
 * Migrated from: pay_all_equity_buybacks_job.rb, investor_equity_buybacks_payment_job.rb
 *
 * Handles:
 * - Scheduling buyback payments for all eligible investors
 * - Processing individual investor buyback payments
 */

export async function handlePayAllEquityBuybacks(message: PayAllEquityBuybacksMessage, env: Env): Promise<void> {
  console.info("[equity-buybacks] Scheduling equity buyback payments for all eligible investors");

  // Business logic from PayAllEquityBuybacksJob:
  // 1. Find EquityBuybacks with status issued/retained
  //    that belong to ready_for_payment EquityBuybackRounds
  // 2. Get distinct company_investor_ids
  // 3. For each, enqueue InvestorEquityBuybacksPaymentMessage with staggered delay
}

export async function handleInvestorEquityBuybacksPayment(
  message: InvestorEquityBuybacksPaymentMessage,
  env: Env,
): Promise<void> {
  const { companyInvestorId } = message.payload;
  console.info(`[equity-buybacks] Processing buyback payment for investor: ${companyInvestorId}`);

  // Business logic from InvestorEquityBuybacksPaymentJob:
  // 1. Find CompanyInvestor
  // 2. Find eligible equity_buybacks (status: issued or retained)
  // 3. Call PayInvestorEquityBuybacks service:
  //    - Creates Wise transfer for the total amount
  //    - Updates buyback statuses
  //    - Creates payment records
}
