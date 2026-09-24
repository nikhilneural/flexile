import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { companyAdministrators, companyUpdates } from "@/db/schema";
import { resolveClerkUserId } from "@/trpc/auth";
import { findCompany } from "../../../invoices/helpers";
import { getFinancialPeriods, getRecipientCounts, presentCompanyUpdate } from "../../helpers";

export async function GET(req: Request, { params }: { params: Promise<{ companyId: string; id: string }> }) {
  const ipAddress = req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0] ?? "";
  const userId = await resolveClerkUserId(ipAddress);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { companyId, id } = await params;
  const company = await findCompany(companyId);
  if (!company) return NextResponse.json({ success: false, error: "Company not found" }, { status: 404 });

  const admin = await db.query.companyAdministrators.findFirst({
    where: and(eq(companyAdministrators.companyId, company.id), eq(companyAdministrators.userId, BigInt(userId))),
  });
  if (!admin) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

  const update = await db.query.companyUpdates.findFirst({
    where: and(eq(companyUpdates.companyId, company.id), eq(companyUpdates.externalId, id)),
  });
  if (!update) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

  const recipientCount = await getRecipientCounts(company.id);
  const financialPeriods = getFinancialPeriods();

  const primaryAdmin = await db.query.companyAdministrators.findFirst({
    where: eq(companyAdministrators.companyId, company.id),
    orderBy: asc(companyAdministrators.id),
    with: { user: true },
  });
  const adminName = primaryAdmin?.user.legalName || primaryAdmin?.user.preferredName || "Administrator";

  return NextResponse.json({
    financial_periods: financialPeriods,
    recipient_count: recipientCount,
    company_update: presentCompanyUpdate(update, adminName),
  });
}
