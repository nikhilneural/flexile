import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import Stripe from "stripe";
import type { Env } from "@/env";

const adminStripeMicrodepositRouter = new Hono<{ Bindings: Env }>();

const createSchema = z.object({
  code: z.string().optional(),
  amounts: z.array(z.number()).optional(),
});

/** POST /internal/companies/:companyId/administrator/stripe-microdeposit-verifications */
adminStripeMicrodepositRouter.post("/", zValidator("json", createSchema), async (c) => {
  const { code, amounts } = c.req.valid("json");

  try {
    const stripe = new Stripe(c.env.STRIPE_SECRET_KEY);
    const verificationParams = code ? { descriptor_code: code } : { amounts: amounts || [] };
    // Business logic: retrieve setup intent ID from company, then verify
    const setupIntentId = ""; // would be fetched from company
    const setupIntent = await stripe.setupIntents.verifyMicrodeposits(setupIntentId, verificationParams);

    if (setupIntent.status === "succeeded") {
      return c.body(null, 200);
    }
    return c.json({ error: "" }, 422);
  } catch (err) {
    const message = err instanceof Stripe.errors.StripeInvalidRequestError ? (err as Error).message : "Verification failed";
    return c.json({ error: message }, 422);
  }
});

export { adminStripeMicrodepositRouter };
