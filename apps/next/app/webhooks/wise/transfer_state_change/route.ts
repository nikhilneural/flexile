import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { invoices, payments } from "@/db/schema";
import { verifyWiseSignature } from "@/lib/webhooks/wise";

const webhookPayloadSchema = z.object({
  data: z.object({
    resource: z.object({
      id: z.union([z.number(), z.string()]),
      profile_id: z.union([z.number(), z.string()]).optional(),
    }),
    current_state: z.string(),
    occurred_at: z.string().optional(),
  }),
});

export async function POST(req: Request) {
  const isTest = req.headers.get("x-test-notification") === "true";
  const rawBody = await req.text();
  const signature = req.headers.get("x-signature-sha256");

  if (!isTest && !verifyWiseSignature(signature, rawBody)) {
    return NextResponse.json({ success: false }, { status: 400 });
  }

  if (isTest) {
    return NextResponse.json({ success: true, message: "Good check!" });
  }

  let bodyJson: unknown;
  try {
    bodyJson = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ success: false }, { status: 400 });
  }

  const parseResult = webhookPayloadSchema.safeParse(bodyJson);
  if (!parseResult.success) {
    return NextResponse.json({ success: true });
  }

  const { data } = parseResult.data;
  const transferId = String(data.resource.id);
  const currentState = data.current_state;

  const payment = await db.query.payments.findFirst({
    where: eq(payments.wiseTransferId, transferId),
  });

  if (!payment) {
    return NextResponse.json({ success: true });
  }

  await db.update(payments).set({ wiseTransferStatus: currentState }).where(eq(payments.id, payment.id));

  if (currentState === "outgoing_payment_sent") {
    const occurredAt = data.occurred_at ? new Date(data.occurred_at) : new Date();
    await db.update(payments).set({ status: "succeeded" }).where(eq(payments.id, payment.id));

    await db
      .update(invoices)
      .set({
        status: "paid",
        paidAt: occurredAt,
      })
      .where(eq(invoices.id, payment.invoiceId));
  } else if (currentState === "processing") {
    await db.update(invoices).set({ status: "processing" }).where(eq(invoices.id, payment.invoiceId));
  } else if (currentState === "funds_refunded" || currentState === "cancelled") {
    await db.update(payments).set({ status: "failed" }).where(eq(payments.id, payment.id));

    await db.update(invoices).set({ status: "failed" }).where(eq(invoices.id, payment.invoiceId));
  }

  return NextResponse.json({ success: true });
}
