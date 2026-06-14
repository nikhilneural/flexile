import type { Env } from "@/env";
import { publish } from "@/queues/publisher";

/**
 * Monthly financial report sync - runs on the 1st of each month at 3:00 AM UTC.
 *
 * Triggers QuickBooks financial report synchronization for all connected companies.
 * Replaces: QuickbooksMonthlyFinancialReportSyncJob (Sidekiq cron)
 */
export async function handleMonthlyFinancialSync(env: Env): Promise<void> {
  console.info("[scheduled:monthly-financial-sync] Running monthly financial report sync");

  // Trigger QuickBooks monthly sync for all companies
  await publish(env, "quickbooks.monthly-financial-report-sync", {});

  // Transfer accumulated Stripe balance to Wise
  await publish(env, "stripe.transfer-to-wise", {});

  console.info("[scheduled:monthly-financial-sync] Monthly financial sync tasks enqueued");
}
