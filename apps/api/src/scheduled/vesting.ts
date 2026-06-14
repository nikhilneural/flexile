import type { Env } from "@/env";
import { publish } from "@/queues/publisher";

/**
 * Daily vesting check - runs at 2:00 AM UTC.
 *
 * Enqueues equity vesting processing and balance-related tasks.
 * Replaces: ProcessScheduledVestingJob (Sidekiq cron)
 */
export async function handleDailyVestingCheck(env: Env): Promise<void> {
  console.info("[scheduled:vesting] Running daily vesting check");

  // Process scheduled equity grant vesting
  await publish(env, "equity.process-scheduled-vesting", {});

  // Update Wise balance information
  await publish(env, "wise.balance-update", {});

  // Check if Stripe balance needs top-up
  await publish(env, "stripe.balance-top-up", {});

  // Delete old version records (maintenance)
  await publish(env, "maintenance.delete-old-versions", {});

  console.info("[scheduled:vesting] Daily vesting check tasks enqueued");
}
