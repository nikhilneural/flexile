import type { Env } from "@/env";
import { publish } from "@/queues/publisher";

/**
 * Monthly dividend reminders - runs on the 1st of each month at 8:00 AM UTC.
 *
 * Updates upcoming dividend calculations and sends reminders.
 * Replaces: UpdateUpcomingDividendsJob (Sidekiq cron)
 */
export async function handleMonthlyDividendReminder(env: Env): Promise<void> {
  console.info("[scheduled:dividend-reminders] Running monthly dividend reminders");

  // Update upcoming dividend calculations
  await publish(env, "dividends.update-upcoming", {});

  // Send Wise top-up reminder if balance is low
  await publish(env, "wise.top-up-reminder", {});

  console.info("[scheduled:dividend-reminders] Monthly dividend reminder tasks enqueued");
}
