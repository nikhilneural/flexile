import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { PayRateType } from "@/db/enums";
import { companyContractors, equityAllocations, expenseCategories, invoices, users } from "@/db/schema";
import { resolveClerkUserId } from "@/trpc/auth";
import { latestUserComplianceInfo } from "@/trpc/routes/users/helpers";
import { findCompany, formatAddress } from "../../helpers";

export async function GET(req: Request, { params }: { params: Promise<{ companyId: string; id: string }> }) {
  const ipAddress = req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0] ?? "";
  const userId = await resolveClerkUserId(ipAddress);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { companyId, id } = await params;
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

  const invoice = await db.query.invoices.findFirst({
    where: and(eq(invoices.companyId, company.id), eq(invoices.userId, user.id), eq(invoices.externalId, id)),
    with: {
      lineItems: true,
      expenses: {
        with: { expenseCategory: true },
      },
    },
  });
  if (!invoice) return NextResponse.json({ success: false, error: "Invoice not found" }, { status: 404 });

  const compliance = user.userComplianceInfos[0];
  const isBusiness = Boolean(compliance?.businessEntity ?? false);
  const billingEntityName = isBusiness
    ? (compliance?.businessName ?? compliance?.legalName ?? user.legalName ?? "")
    : (compliance?.legalName ?? user.legalName ?? "");

  const categories = await db.query.expenseCategories.findMany({
    where: eq(expenseCategories.companyId, company.id),
  });

  const invoiceDateObj = new Date(invoice.invoiceDate);
  let equityAllocation: { percentage: number | null; is_locked: boolean | null } | undefined;
  if (company.equityCompensationEnabled) {
    const allocation = await db.query.equityAllocations.findFirst({
      where: and(
        eq(equityAllocations.companyContractorId, contractor.id),
        eq(equityAllocations.year, invoiceDateObj.getFullYear()),
      ),
    });
    equityAllocation = {
      percentage: allocation?.equityPercentage ?? null,
      is_locked: allocation?.locked ?? false,
    };
  }

  const lineItems = invoice.lineItems.map((item) => ({
    id: Number(item.id),
    description: item.description,
    minutes: item.minutes,
    pay_rate_in_subunits: item.payRateInSubunits ?? contractor.payRateInSubunits,
    total_amount_cents: Number(item.totalAmountCents),
  }));

  const invoiceExpenses = invoice.expenses.map((expense) => ({
    id: String(expense.id),
    description: expense.description,
    category_id: Number(expense.expenseCategoryId),
    total_amount_in_cents: Number(expense.totalAmountInCents),
    attachment: { name: "receipt", url: "" },
  }));

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
      id: invoice.externalId,
      bill_address: formatAddress({
        streetAddress: invoice.streetAddress ?? compliance?.streetAddress ?? user.streetAddress,
        city: invoice.city ?? compliance?.city ?? user.city,
        state: invoice.state ?? compliance?.state ?? user.state,
        zipCode: invoice.zipCode ?? compliance?.zipCode ?? user.zipCode,
        countryCode: invoice.countryCode ?? compliance?.countryCode ?? user.countryCode,
      }),
      invoice_date: invoice.invoiceDate,
      description: null,
      total_minutes: invoice.totalMinutes,
      invoice_number: invoice.invoiceNumber,
      notes: invoice.notes,
      status: invoice.status,
      max_minutes: 9600,
      line_items: lineItems,
      equity_amount_in_cents: Number(invoice.equityAmountInCents ?? 0n),
      expenses: invoiceExpenses,
    },
    ...(equityAllocation ? { equity_allocation: equityAllocation } : {}),
  });
}
