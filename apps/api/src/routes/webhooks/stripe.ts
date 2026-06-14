import { Hono } from "hono";
import Stripe from "stripe";
import type { Env } from "@/env";

const stripeWebhookRouter = new Hono<{ Bindings: Env }>();

/**
 * Stripe webhook handler with signature verification.
 * Handles: setup_intent.*, charge.refunded, payment_intent.*, payout.paid, issuing_transaction.*
 */
stripeWebhookRouter.post("/", async (c) => {
  const payload = await c.req.text();
  const sigHeader = c.req.header("stripe-signature");

  if (!sigHeader) {
    return c.json({ error: "Missing stripe-signature header" }, 400);
  }

  const stripe = new Stripe(c.env.STRIPE_SECRET_KEY);
  let event: Stripe.Event;

  try {
    event = await stripe.webhooks.constructEventAsync(payload, sigHeader, c.env.STRIPE_ENDPOINT_SECRET);
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err);
    return c.body(null, 400);
  }

  console.info(`Stripe webhook received: ${event.type}`);

  try {
    await c.env.QUEUE_JOBS.send({
      type: "stripe.event",
      payload: {
        eventType: event.type,
        eventData: event.data.object,
        eventId: event.id,
      },
    });
  } catch (err) {
    console.error("Failed to enqueue Stripe event:", err);
    // Process inline as fallback
    await processStripeEvent(c, event);
  }

  return c.body(null, 200);
});

async function processStripeEvent(c: { env: Env }, event: Stripe.Event) {
  const stripe = new Stripe(c.env.STRIPE_SECRET_KEY);

  switch (event.type) {
    case "setup_intent.succeeded": {
      const setupIntent = event.data.object as Stripe.SetupIntent;
      await c.env.QUEUE_JOBS.send({
        type: "stripe.setup-intent.succeeded",
        payload: { setupIntentId: setupIntent.id },
      });
      break;
    }
    case "setup_intent.canceled": {
      const setupIntent = event.data.object as Stripe.SetupIntent;
      await c.env.QUEUE_JOBS.send({
        type: "stripe.setup-intent.canceled",
        payload: { setupIntentId: setupIntent.id },
      });
      break;
    }
    case "setup_intent.setup_failed": {
      const setupIntent = event.data.object as Stripe.SetupIntent;
      await c.env.QUEUE_JOBS.send({
        type: "stripe.setup-intent.failed",
        payload: { setupIntentId: setupIntent.id, lastSetupError: setupIntent.last_setup_error },
      });
      break;
    }
    case "setup_intent.requires_action": {
      const setupIntent = event.data.object as Stripe.SetupIntent;
      await c.env.QUEUE_JOBS.send({
        type: "stripe.setup-intent.requires-action",
        payload: { setupIntentId: setupIntent.id, nextAction: setupIntent.next_action },
      });
      break;
    }
    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      await c.env.QUEUE_JOBS.send({
        type: "stripe.charge.refunded",
        payload: { paymentIntentId: charge.payment_intent as string },
      });
      break;
    }
    case "payment_intent.succeeded":
    case "payment_intent.payment_failed":
    case "payment_intent.canceled": {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      await c.env.QUEUE_JOBS.send({
        type: "stripe.payment-intent",
        payload: { paymentIntentId: paymentIntent.id, status: paymentIntent.status },
      });
      break;
    }
    case "payout.paid": {
      const payout = event.data.object as Stripe.Payout;
      if (!payout.automatic && payout.metadata?.consolidated_invoice) {
        await c.env.QUEUE_JOBS.send({
          type: "stripe.payout.paid",
          payload: { payoutId: payout.id },
        });
      }
      break;
    }
    case "issuing_transaction.created": {
      const transaction = event.data.object as Stripe.Issuing.Transaction;
      await c.env.QUEUE_JOBS.send({
        type: "stripe.issuing-transaction.created",
        payload: {
          cardId: transaction.card,
          amount: transaction.amount,
          transactionId: transaction.id,
          merchantData: transaction.merchant_data,
        },
      });
      break;
    }
    case "issuing_transaction.updated": {
      const transaction = event.data.object as Stripe.Issuing.Transaction;
      await c.env.QUEUE_JOBS.send({
        type: "stripe.issuing-transaction.updated",
        payload: { transactionId: transaction.id, data: transaction },
      });
      break;
    }
    default:
      console.info(`Unhandled Stripe event type: ${event.type}`);
  }
}

export { stripeWebhookRouter };
