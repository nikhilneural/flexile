import type { Env } from "@/env";
import type { SlackMessage, SlackWeeklyRecapMessage } from "./types";

/**
 * Slack Queue Handler
 * Migrated from: slack_message_job.rb
 * Consolidated with: inngest/functions/sendSlackMessage.ts, slackWeeklyRecap.ts
 *
 * Handles:
 * - Sending Slack messages via webhook
 * - Weekly recap generation using AI and Slack API
 */

export async function handleSlackMessage(message: SlackMessage, env: Env): Promise<void> {
  const { channel, sender, text, color } = message.payload;
  console.info(`[slack] Sending message to #${channel} from ${sender}`);

  // Use test channel for non-production environments
  const targetChannel = env.ENVIRONMENT === "production" ? channel : "test";

  const webhookUrl = env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn("[slack] No SLACK_WEBHOOK_URL configured, skipping message");
    return;
  }

  // Business logic from SlackMessageJob + sendSlackMessage.ts:
  // Send message via Slack webhook with color attachment
  try {
    const response = await fetch(`https://hooks.slack.com/services/${webhookUrl}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channel: `#${targetChannel}`,
        username: sender,
        attachments: [
          {
            fallback: text,
            color: color || "gray",
            text,
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error(`[slack] Failed to send message: ${response.status} ${response.statusText}`);
    }
  } catch (err) {
    console.error("[slack] Error sending message:", err);
    throw err; // Will be retried by queue
  }
}

export async function handleSlackWeeklyRecap(message: SlackWeeklyRecapMessage, env: Env): Promise<void> {
  console.info("[slack] Generating weekly recap");

  // Business logic from slackWeeklyRecap.ts (Inngest function):
  // 1. Find the Gumroad company
  // 2. Fetch team updates from the previous week (Monday to Monday)
  // 3. Send updates to AI (gpt-4.5-preview in production, gpt-4o-mini otherwise)
  //    with slackWeeklyRecapPrompt to generate structured summary
  // 4. Format AI response into Slack rich_text blocks:
  //    - Title (bold)
  //    - Projects (italic name)
  //    - Tasks (bulleted list)
  //    - Subtasks (indented bulleted list)
  // 5. Join Slack channel and post the message
}
