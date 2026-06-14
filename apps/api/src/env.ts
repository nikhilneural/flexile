import type { Context } from "hono";

/**
 * Cloudflare Workers environment bindings.
 * All secrets are configured via wrangler secret put or the Cloudflare dashboard.
 */
export interface Env {
  // Hyperdrive binding for PostgreSQL connection
  HYPERDRIVE: Hyperdrive;

  // R2 buckets (replacing S3)
  R2_PRIVATE: R2Bucket;
  R2_PUBLIC: R2Bucket;

  // KV namespaces
  KV_CACHE: KVNamespace;
  KV_SESSIONS: KVNamespace;

  // Queues (replacing Inngest/Sidekiq)
  QUEUE_JOBS: Queue;
  QUEUE_EMAILS: Queue;

  // Environment
  ENVIRONMENT: string;

  // Database (used as fallback when Hyperdrive is not available)
  DATABASE_URL: string;

  // Clerk auth
  CLERK_SECRET_KEY: string;
  CLERK_PUBLISHABLE_KEY: string;

  // Email (Resend)
  RESEND_API_KEY: string;
  EMAIL_DOMAIN: string;

  // Storage (legacy S3 credentials, for migration period)
  AWS_ACCESS_KEY_ID: string;
  AWS_SECRET_ACCESS_KEY: string;
  AWS_REGION: string;
  S3_PRIVATE_BUCKET: string;
  S3_PUBLIC_BUCKET: string;

  // Stripe
  STRIPE_SECRET_KEY: string;
  STRIPE_ENDPOINT_SECRET: string;
  STRIPE_PUBLISHABLE_KEY: string;

  // QuickBooks
  QUICKBOOKS_CLIENT_ID: string;
  QUICKBOOKS_CLIENT_SECRET: string;
  QUICKBOOKS_REDIRECT_URL: string;
  QUICKBOOKS_WEBHOOK_SECRET: string;

  // GitHub
  GH_CLIENT_ID: string;
  GH_CLIENT_SECRET: string;
  GH_WEBHOOK_SECRET: string;

  // Encryption keys (for ActiveRecord-compatible encrypted fields)
  ACTIVERECORD_DETERMINISTIC_DERIVED_KEY: string;
  ACTIVERECORD_DERIVED_KEY: string;

  // DocuSeal
  DOCUSEAL_TOKEN: string;
  DOCUSEAL_USER_EMAIL: string;

  // Wise
  WISE_PROFILE_ID: string;
  WISE_API_KEY: string;

  // Slack
  SLACK_WEBHOOK_URL: string;
  SLACK_WEBHOOK_CHANNEL: string;
  SLACK_TOKEN: string;
  SLACK_CHANNEL_ID: string;

  // Google
  GOOGLE_CLIENT_ID: string;

  // DocuSeal form IDs
  EQUITY_EXERCISE_DOCUSEAL_ID: string;
}

export type AppContext = Context<{ Bindings: Env }>;
