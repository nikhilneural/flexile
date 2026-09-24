import { formatISO } from "date-fns";
import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { PayRateType } from "@/db/enums";
import { companyContractors, equityAllocations, expenseCategories, users } from "@/db/schema";
import { resolveClerkUserId } from "@/trpc/auth";
import { latestUserComplianceInfo } from "@/trpc/routes/users/helpers";
import { findCompany, formatAddress, getRecommendedInvoiceNumber } from "../helpers";

export async function GET(req: Request, { params }: { params: Promise<{ companyId: string }> }) {
  const ipAddress = req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0] ?? "";
  const userId = await resolveClerkUserId(ipAddress);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { companyId } = await params;
  const company = await findCompany(companyId);
  if (!company) return NextResponse.json({ success: false, error: "Company not found" }, { status: 404 });

  const user = await db.query.users.findFirst({
    where: eq(users.id, BigInt(userId)),
    with: {
      userComplianceInfos: latestUserComplianceInfo,
    },
  });
  if (!user) return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });

  const contractor = await db.query.companyContractors.findFirst({
    where: and(
      eq(companyContractors.companyId, company.id),
      eq(companyContractors.userId, user.id),
      isNull(companyContractors.endedAt),
    ),
  });
  if (!contractor) {
    return NextResponse.json({ success: false, error: "Contractor not found" }, { status: 403 });
  }

  const compliance = user.userComplianceInfos[0];
  const isBusiness = Boolean(compliance?.businessEntity ?? false);
  const billingEntityName = isBusiness
    ? (compliance?.businessName ?? compliance?.legalName ?? user.legalName ?? "")
    : (compliance?.legalName ?? user.legalName ?? "");

  const categories = await db.query.expenseCategories.findMany({
    where: eq(expenseCategories.companyId, company.id),
  });

  const today = new Date();
  const todayDateString = formatISO(today, { representation: "date" });
  const recommendedNumber = await getRecommendedInvoiceNumber(company.id, user.id);

  let equityAllocation: { percentage: number | null; is_locked: boolean | null } | undefined;
  if (company.equityCompensationEnabled) {
    const allocation = await db.query.equityAllocations.findFirst({
      where: and(
        eq(equityAllocations.companyContractorId, contractor.id),
        eq(equityAllocations.year, today.getFullYear()),
      ),
    });
    equityAllocation = {
      percentage: allocation?.equityPercentage ?? null,
      is_locked: allocation?.locked ?? false,
    };
  }

  return NextResponse.json({
    user: {
      legal_name: compliance?.legalName ?? user.legalName ?? "",
      business_entity: isBusiness,
      billing_entity_name: billingEntityName,
      pay_rate_in_subunits: contractor.payRateInSubunits,
      project_based: contractor.payRateType === PayRateType.ProjectBased,
    },
    company: {
      id: company.externalId,
      name: company.name ?? "",
      address: formatAddress({
        streetAddress: company.streetAddress,
        city: company.city,
        state: company.state,
        zipCode: company.zipCode,
        countryCode: company.countryCode,
      }),
      expenses: {
        enabled: Boolean(company.expenseCardsEnabled || categories.length > 0),
        categories: categories.map((c) => ({
          id: Number(c.id),
          name: c.name,
        })),
      },
    },
    invoice: {
      bill_address: formatAddress({
        streetAddress: compliance?.streetAddress ?? user.streetAddress,
        city: compliance?.city ?? user.city,
        state: compliance?.state ?? user.state,
        zipCode: compliance?.zipCode ?? user.zipCode,
        countryCode: compliance?.countryCode ?? user.countryCode,
      }),
      invoice_date: todayDateString,
      description: "",
      total_minutes: 0,
      invoice_number: recommendedNumber,
      notes: null,
      status: null,
      max_minutes: 9600,
      line_items: [],
      equity_amount_in_cents: 0,
      expenses: [],
    },
    ...(equityAllocation ? { equity_allocation: equityAllocation } : {}),
  });
}
