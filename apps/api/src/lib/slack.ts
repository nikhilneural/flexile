import { WebClient } from "@slack/web-api";
import type { Env } from "@/env";

/**
 * Creates a Slack WebClient instance from environment variables.
 * Must be called per-request since Cloudflare Workers don't share state between requests.
 */
export const createSlackClient = (env: Env) => new WebClient(env.SLACK_TOKEN);

/**
 * Posts a message to the configured Slack channel.
 */
export const postSlackMessage = async (env: Env, text: string, options?: { channel?: string }) => {
  const client = createSlackClient(env);
  return client.chat.postMessage({
    channel: options?.channel ?? env.SLACK_CHANNEL_ID,
    text,
  });
};
