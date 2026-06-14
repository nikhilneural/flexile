import type { Env } from "@/env";

export const CLEARANCE_BANK_ACCOUNT_NAME = "Flexile.com Money Out Clearing";

export interface QuickBooksConfig {
  appKey: string;
  appSecret: string;
  redirectUrl: string;
  scope: string[];
  useProduction: boolean;
  autoRefresh: boolean;
  minorversion: number;
}

/**
 * Creates the QuickBooks configuration from environment variables.
 * The actual QuickBooks client instantiation depends on request context
 * since it requires integration-specific tokens.
 */
export const createQuickBooksConfig = (env: Env): QuickBooksConfig => ({
  appKey: env.QUICKBOOKS_CLIENT_ID,
  appSecret: env.QUICKBOOKS_CLIENT_SECRET,
  redirectUrl: env.QUICKBOOKS_REDIRECT_URL,
  scope: ["com.intuit.quickbooks.accounting"],
  useProduction: env.ENVIRONMENT === "production",
  autoRefresh: true,
  minorversion: 75,
});
