import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { companies, companyStripeAccounts } from "@/db/schema";
import { resolveClerkUserId } from "@/trpc/auth";

export async function PATCH(req: Request, { params }: { params: Promise<{ companyId: string }> }) {
  const ipAddress = req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0] ?? "";
  const userId = await resolveClerkUserId(ipAddress);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { companyId } = await params;
  const company = await db.query.companies.findFirst({
    where: eq(companies.externalId, companyId),
  });

  if (!company) {
    return NextResponse.json({ success: false, error: "Not Found" }, { status: 404 });
  }

  const bankAccount = await db.query.companyStripeAccounts.findFirst({
    where: and(eq(companyStripeAccounts.companyId, company.id), isNull(companyStripeAccounts.deletedAt)),
  });

  if (bankAccount) {
    await db
      .update(companyStripeAccounts)
      .set({ status: "processing" })
      .where(eq(companyStripeAccounts.id, bankAccount.id));
  }

  return NextResponse.json({ success: true });
}
