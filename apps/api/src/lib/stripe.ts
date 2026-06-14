import Stripe from "stripe";
import type { Env } from "@/env";

// The NPM package `stripe` should match the API version we use.
export const STRIPE_API_VERSION = "2024-04-10";

/**
 * Creates a Stripe client instance using the environment's secret key.
 * Must be called per-request since Cloudflare Workers don't share state between requests.
 */
export const createStripeClient = (env: Env) =>
  // @ts-expect-error stripe-version-2024-04-10
  new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: STRIPE_API_VERSION });
