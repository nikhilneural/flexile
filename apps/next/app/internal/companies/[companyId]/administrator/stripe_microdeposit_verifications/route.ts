import { and, desc, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { companyAdministrators, companyStripeAccounts } from "@/db/schema";
import { stripe } from "@/lib/stripe";
import { resolveClerkUserId } from "@/trpc/auth";
import { findCompany } from "../../invoices/helpers";

const verifySchema = z.object({
  code: z.string().optional(),
  amounts: z.array(z.number()).optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ companyId: string }> }) {
  const ipAddress = req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0] ?? "";
  const userId = await resolveClerkUserId(ipAddress);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { companyId } = await params;
  const company = await findCompany(companyId);
  if (!company) return NextResponse.json({ success: false, error: "Company not found" }, { status: 404 });

  const admin = await db.query.companyAdministrators.findFirst({
    where: and(eq(companyAdministrators.companyId, company.id), eq(companyAdministrators.userId, BigInt(userId))),
  });
  if (!admin) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

  const stripeAccount = await db.query.companyStripeAccounts.findFirst({
    where: and(eq(companyStripeAccounts.companyId, company.id), isNull(companyStripeAccounts.deletedAt)),
    orderBy: desc(companyStripeAccounts.id),
  });

  if (!stripeAccount?.setupIntentId) {
    return NextResponse.json({ error: "No bank account setup intent found" }, { status: 422 });
  }

  const rawBody: unknown = await req.json().catch(() => ({}));
  const parseResult = verifySchema.safeParse(rawBody);
  if (!parseResult.success) {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 422 });
  }

  const data = parseResult.data;

  try {
    const verificationParams = data.code
      ? { descriptor_code: data.code }
      : data.amounts
        ? { amounts: data.amounts }
        : {};

    const setupIntent = await stripe.setupIntents.verifyMicrodeposits(stripeAccount.setupIntentId, verificationParams);

    if (setupIntent.status === "succeeded") {
      await db
        .update(companyStripeAccounts)
        .set({ status: "verified" })
        .where(eq(companyStripeAccounts.id, stripeAccount.id));

      return NextResponse.json({ success: true }, { status: 200 });
    }

    return NextResponse.json({ error: "" }, { status: 422 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Verification failed";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
