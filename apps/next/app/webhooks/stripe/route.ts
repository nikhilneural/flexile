import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { db } from "@/db";
import { companyStripeAccounts, consolidatedPayments } from "@/db/schema";
import { stripe } from "@/lib/stripe";

export async function POST(req: Request) {
  const payload = await req.text();
  const signature = req.headers.get("stripe-signature");
  const endpointSecret = process.env.STRIPE_ENDPOINT_SECRET ?? "";

  if (!signature || !endpointSecret) {
    return NextResponse.json({ error: "Missing signature or endpoint secret" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(payload, signature, endpointSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature or payload" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "setup_intent.succeeded": {
        const setupIntent = event.data.object;
        const stripeAccount = await db.query.companyStripeAccounts.findFirst({
          where: eq(companyStripeAccounts.setupIntentId, setupIntent.id),
        });
        if (stripeAccount) {
          let last4: string | null = null;
          if (setupIntent.payment_method) {
            try {
              const pm = await stripe.paymentMethods.retrieve(
                typeof setupIntent.payment_method === "string"
                  ? setupIntent.payment_method
                  : setupIntent.payment_method.id,
              );
              last4 = pm.us_bank_account?.last4 ?? pm.card?.last4 ?? null;
            } catch {
              // Ignore payment method fetch error
            }
          }
          await db
            .update(companyStripeAccounts)
            .set({
              status: "ready",
              ...(last4 ? { bankAccountLastFour: last4 } : {}),
            })
            .where(eq(companyStripeAccounts.id, stripeAccount.id));
        }
        break;
      }

      case "setup_intent.canceled": {
        const setupIntent = event.data.object;
        const stripeAccount = await db.query.companyStripeAccounts.findFirst({
          where: eq(companyStripeAccounts.setupIntentId, setupIntent.id),
        });
        if (stripeAccount) {
          await db
            .update(companyStripeAccounts)
            .set({
              status: "cancelled",
              deletedAt: new Date(),
            })
            .where(eq(companyStripeAccounts.id, stripeAccount.id));
        }
        break;
      }

      case "setup_intent.setup_failed": {
        const setupIntent = event.data.object;
        const stripeAccount = await db.query.companyStripeAccounts.findFirst({
          where: eq(companyStripeAccounts.setupIntentId, setupIntent.id),
        });
        if (stripeAccount) {
          await db
            .update(companyStripeAccounts)
            .set({ status: "failed" })
            .where(eq(companyStripeAccounts.id, stripeAccount.id));
        }
        break;
      }

      case "setup_intent.requires_action": {
        const setupIntent = event.data.object;
        const stripeAccount = await db.query.companyStripeAccounts.findFirst({
          where: eq(companyStripeAccounts.setupIntentId, setupIntent.id),
        });
        if (stripeAccount) {
          await db
            .update(companyStripeAccounts)
            .set({ status: "action_required" })
            .where(eq(companyStripeAccounts.id, stripeAccount.id));
        }
        break;
      }

      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object;
        const payment = await db.query.consolidatedPayments.findFirst({
          where: eq(consolidatedPayments.stripePaymentIntentId, paymentIntent.id),
        });
        if (payment) {
          await db
            .update(consolidatedPayments)
            .set({
              status: "succeeded",
              succeededAt: new Date(),
            })
            .where(eq(consolidatedPayments.id, payment.id));
        }
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object;
        const payment = await db.query.consolidatedPayments.findFirst({
          where: eq(consolidatedPayments.stripePaymentIntentId, paymentIntent.id),
        });
        if (payment) {
          await db
            .update(consolidatedPayments)
            .set({ status: "failed" })
            .where(eq(consolidatedPayments.id, payment.id));
        }
        break;
      }

      case "payment_intent.canceled": {
        const paymentIntent = event.data.object;
        const payment = await db.query.consolidatedPayments.findFirst({
          where: eq(consolidatedPayments.stripePaymentIntentId, paymentIntent.id),
        });
        if (payment) {
          await db
            .update(consolidatedPayments)
            .set({ status: "cancelled" })
            .where(eq(consolidatedPayments.id, payment.id));
        }
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object;
        const paymentIntentId =
          typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
        if (paymentIntentId) {
          const payment = await db.query.consolidatedPayments.findFirst({
            where: eq(consolidatedPayments.stripePaymentIntentId, paymentIntentId),
          });
          if (payment) {
            await db
              .update(consolidatedPayments)
              .set({ status: "refunded" })
              .where(eq(consolidatedPayments.id, payment.id));
          }
        }
        break;
      }

      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error processing webhook";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
