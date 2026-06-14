import { OAuthApp } from "octokit";
import type { Env } from "@/env";

/**
 * Creates a GitHub OAuth app instance from environment variables.
 * Must be called per-request since Cloudflare Workers don't share state between requests.
 */
export const createGitHubApp = (env: Env) =>
  new OAuthApp({
    clientId: env.GH_CLIENT_ID,
    clientSecret: env.GH_CLIENT_SECRET,
  });
