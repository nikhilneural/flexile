import { and, desc, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { companyStripeAccounts } from "@/db/schema";
import { stripe } from "@/lib/stripe";
import { resolveClerkUserId } from "@/trpc/auth";
import { findCompany } from "../helpers";

export async function GET(req: Request, { params }: { params: Promise<{ companyId: string }> }) {
  const ipAddress = req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0] ?? "";
  const userId = await resolveClerkUserId(ipAddress);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { companyId } = await params;
  const company = await findCompany(companyId);
  if (!company) return NextResponse.json({ success: false, error: "Company not found" }, { status: 404 });

  const stripeAccount = await db.query.companyStripeAccounts.findFirst({
    where: and(eq(companyStripeAccounts.companyId, company.id), isNull(companyStripeAccounts.deletedAt)),
    orderBy: desc(companyStripeAccounts.createdAt),
  });

  if (!stripeAccount || stripeAccount.status === "ready") {
    return NextResponse.json({ details: null });
  }

  try {
    const setupIntent = await stripe.setupIntents.retrieve(stripeAccount.setupIntentId);
    if (setupIntent.status === "requires_action" && setupIntent.next_action?.type === "verify_with_microdeposits") {
      const microdeposits = setupIntent.next_action.verify_with_microdeposits;
      return NextResponse.json({
        details: {
          arrival_timestamp: microdeposits?.arrival_date ?? null,
          microdeposit_type: microdeposits?.microdeposit_type ?? null,
          bank_account_number: stripeAccount.bankAccountLastFour ? `****${stripeAccount.bankAccountLastFour}` : null,
        },
      });
    }
  } catch {
    // If Stripe call fails, return null details gracefully
  }

  return NextResponse.json({ details: null });
}
