import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { companyContractors, expenseCards } from "@/db/schema";
import { stripe, STRIPE_API_VERSION } from "@/lib/stripe";
import { resolveClerkUserId } from "@/trpc/auth";
import { findCompany } from "../invoices/helpers";

const keySchema = z.object({
  nonce: z.string(),
  processor_reference: z.string(),
});

export async function POST(req: Request, { params }: { params: Promise<{ companyId: string }> }) {
  const ipAddress = req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0] ?? "";
  const userId = await resolveClerkUserId(ipAddress);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { companyId } = await params;
  const company = await findCompany(companyId);
  if (!company) return NextResponse.json({ success: false, error: "Company not found" }, { status: 404 });

  const contractor = await db.query.companyContractors.findFirst({
    where: and(eq(companyContractors.companyId, company.id), eq(companyContractors.userId, BigInt(userId))),
  });
  if (!contractor) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

  const rawBody: unknown = await req.json().catch(() => ({}));
  const parseResult = keySchema.safeParse(rawBody);
  if (!parseResult.success) {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 422 });
  }

  const { nonce, processor_reference } = parseResult.data;

  const card = await db.query.expenseCards.findFirst({
    where: and(
      eq(expenseCards.companyContractorId, contractor.id),
      eq(expenseCards.processorReference, processor_reference),
    ),
  });
  if (!card) return NextResponse.json({ error: "Card not found" }, { status: 404 });

  try {
    const ephemeralKey = await stripe.ephemeralKeys.create(
      {
        nonce,
        issuing_card: card.processorReference,
      },
      { apiVersion: STRIPE_API_VERSION },
    );

    return NextResponse.json({ secret: ephemeralKey.secret });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to create ephemeral key";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
