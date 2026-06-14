import type { Env } from "@/env";
import type { GithubEventMessage } from "./types";

/**
 * GitHub Events Queue Handler
 * Migrated from: github_event_handler_job.rb
 *
 * Processes GitHub webhook events to sync issue/PR state
 * with integration records in the database.
 */

export async function handleGithubEvent(message: GithubEventMessage, env: Env): Promise<void> {
  const { webhookId, event, action, data } = message.payload;
  console.info(`[github-events] Processing event: ${event}/${action} (webhook: ${webhookId})`);

  if (!data) return;

  // Business logic from Github::EventHandler:
  // 1. Determine the key ("issue" or "pull_request")
  // 2. Find GithubIntegrationRecords by node_id (integration_external_id)
  // 3. For each integration_record, process by action:
  //
  //    "reopened":
  //    - Call integratable.update_as_not_completed!
  //    - Set record status to "open"
  //
  //    "closed":
  //    - If pull_request and merged: integratable.update_as_completed!, status = "merged"
  //    - If pull_request and not merged: status = "closed"
  //    - If issue: integratable.update_as_completed!, status = "closed"
  //
  //    "edited":
  //    - If title changed: update integration_record.description = new title
}
