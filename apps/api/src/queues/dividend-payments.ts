import type { Env } from "@/env";
import type {
  PayAllDividendsMessage,
  InvestorDividendsPaymentMessage,
  UpdateUpcomingDividendsMessage,
  UpdateUpcomingDividendValuesMessage,
} from "./types";

/**
 * Dividend Payment Queue Handler
 * Migrated from: pay_all_dividends_job.rb, investor_dividends_payment_job.rb,
 *   update_upcoming_dividends_job.rb, update_upcoming_dividend_values_job.rb
 *
 * Handles the full dividend payment lifecycle:
 * - Scheduling payments for all eligible investors
 * - Processing individual investor dividend payments
 * - Sending retention notification emails
 * - Calculating and updating upcoming dividend values
 */

export async function handlePayAllDividends(message: PayAllDividendsMessage, env: Env): Promise<void> {
  console.info("[dividend-payments] Scheduling dividend payments for all eligible investors");

  // Business logic from PayAllDividendsJob:
  // 1. Find CompanyInvestors with issued/retained dividends from ready_for_payment rounds
  // 2. For each eligible investor (verified tax ID, not restricted country, completed onboarding):
  //    - Enqueue InvestorDividendsPaymentMessage with staggered delay (2s between each)
  // 3. For retained dividends, send appropriate emails:
  //    - Sanctioned country: send sanctioned_country_email
  //    - Below threshold: send payout_below_threshold_email
}

export async function handleInvestorDividendsPayment(
  message: InvestorDividendsPaymentMessage,
  env: Env,
): Promise<void> {
  const { companyInvestorId } = message.payload;
  console.info(`[dividend-payments] Processing dividend payment for investor: ${companyInvestorId}`);

  // Business logic from InvestorDividendsPaymentJob:
  // 1. Find CompanyInvestor
  // 2. Validate: user has verified tax ID and confirmed tax information
  // 3. Update dividend tax info for each dividend:
  //    - Calculate net_amount, withheld_tax, withholding_percentage using DividendTaxWithholdingCalculator
  // 4. Find dividends eligible for payment (status: issued or retained)
  // 5. Call PayInvestorDividends service to process via Wise
}

export async function handleUpdateUpcomingDividends(
  message: UpdateUpcomingDividendsMessage,
  env: Env,
): Promise<void> {
  console.info("[dividend-payments] Updating upcoming dividends for all enabled companies");

  // Business logic from UpdateUpcomingDividendsJob:
  // 1. Get all companies with the upcoming_dividend feature flag enabled
  // 2. For each company with upcoming_dividend_cents set:
  //    - Enqueue UpdateUpcomingDividendValuesMessage
}

export async function handleUpdateUpcomingDividendValues(
  message: UpdateUpcomingDividendValuesMessage,
  env: Env,
): Promise<void> {
  const { companyId } = message.payload;
  console.info(`[dividend-payments] Updating upcoming dividend values for company: ${companyId}`);

  // Business logic from UpdateUpcomingDividendValuesJob:
  // 1. Find Company
  // 2. Call UpcomingDividendCalculator with amount = upcoming_dividend_cents / 100
  //    - Distributes dividend amount across share classes
  //    - Updates investor dividend records
}
