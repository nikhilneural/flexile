import type { Env } from "@/env";
import { handleDailyVestingCheck } from "./vesting";
import { handleWeeklyRecap } from "./weekly-recap";
import { handleMonthlyFinancialSync } from "./monthly-financial-sync";
import { handleMonthlyDividendReminder } from "./dividend-reminders";
import { handleAnnualTaxDeadlines } from "./tax-deadlines";

/**
 * Scheduled handler for Cloudflare Cron Triggers.
 * Dispatches based on the cron pattern that triggered the event.
 *
 * Cron patterns (from wrangler.toml):
 *   "0 2 * * *"   - Daily at 2:00 AM UTC: vesting checks, balance updates
 *   "0 9 * * 1"   - Weekly on Monday at 9:00 AM UTC: weekly recap
 *   "0 3 1 * *"   - Monthly on 1st at 3:00 AM UTC: financial report sync
 *   "0 8 1 * *"   - Monthly on 1st at 8:00 AM UTC: dividend payment reminders
 *   "0 6 15 1 *"  - January 15th at 6:00 AM UTC: tax form deadlines
 *
 * Replaces:
 *   - Rails sidekiq-cron scheduled jobs
 *   - Recurring Sidekiq job definitions
 */
export async function handleScheduled(event: ScheduledEvent, env: Env): Promise<void> {
  const cron = event.cron;
  console.info(`[scheduled] Cron triggered: ${cron} at ${new Date(event.scheduledTime).toISOString()}`);

  switch (cron) {
    // Daily at 2:00 AM UTC - Equity vesting checks and balance updates
    case "0 2 * * *":
      await handleDailyVestingCheck(env);
      break;

    // Weekly on Monday at 9:00 AM UTC - Slack/email weekly recap
    case "0 9 * * 1":
      await handleWeeklyRecap(env);
      break;

    // Monthly on 1st at 3:00 AM UTC - QuickBooks financial report sync
    case "0 3 1 * *":
      await handleMonthlyFinancialSync(env);
      break;

    // Monthly on 1st at 8:00 AM UTC - Dividend payment reminders
    case "0 8 1 * *":
      await handleMonthlyDividendReminder(env);
      break;

    // January 15th at 6:00 AM UTC - Tax form deadline processing
    case "0 6 15 1 *":
      await handleAnnualTaxDeadlines(env);
      break;

    default:
      console.warn(`[scheduled] Unknown cron pattern: ${cron}`);
  }
}
