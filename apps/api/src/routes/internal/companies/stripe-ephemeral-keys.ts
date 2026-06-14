import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import Stripe from "stripe";
import type { Env } from "@/env";

const stripeEphemeralKeysRouter = new Hono<{ Bindings: Env }>();

const createSchema = z.object({
  nonce: z.string(),
  processor_reference: z.string(),
});

/** POST /internal/companies/:companyId/stripe-ephemeral-keys - Create Stripe ephemeral key */
stripeEphemeralKeysRouter.post("/", zValidator("json", createSchema), async (c) => {
  const { nonce, processor_reference } = c.req.valid("json");

  try {
    const stripe = new Stripe(c.env.STRIPE_SECRET_KEY);
    const ephemeralKey = await stripe.ephemeralKeys.create(
      { nonce, issuing_card: processor_reference },
      { apiVersion: "2024-12-18.acacia" },
    );
    return c.json({ secret: (ephemeralKey as unknown as { secret: string }).secret });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return c.json({ error: message }, 422);
  }
});

export { stripeEphemeralKeysRouter };
