import type { Env } from "@/env";
import { publish } from "@/queues/publisher";

/**
 * Weekly recap - runs every Monday at 9:00 AM UTC.
 *
 * Triggers Slack weekly recap and company admin digest emails.
 * Replaces: SlackWeeklyRecapJob, CompanyAdministratorDigestEmailJob (Sidekiq cron)
 */
export async function handleWeeklyRecap(env: Env): Promise<void> {
  console.info("[scheduled:weekly-recap] Running weekly recap");

  // Send Slack weekly recap to all connected workspaces
  await publish(env, "slack.weekly-recap", {});

  // Send company administrator digest emails
  await publish(env, "email.company-admin-digest", {});

  console.info("[scheduled:weekly-recap] Weekly recap tasks enqueued");
}
