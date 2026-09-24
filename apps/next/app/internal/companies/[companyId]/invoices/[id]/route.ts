import { formatISO } from "date-fns";
import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { PayRateType } from "@/db/enums";
import { companyContractors, equityAllocations, invoiceExpenses, invoiceLineItems, invoices, users } from "@/db/schema";
import { resolveClerkUserId } from "@/trpc/auth";
import { calculateInvoiceEquity } from "@/trpc/routes/equityCalculations";
import { latestUserComplianceInfo } from "@/trpc/routes/users/helpers";
import { findCompany, getFlexileFeeCents, parseInvoiceRequest } from "../helpers";

export async function PATCH(req: Request, { params }: { params: Promise<{ companyId: string; id: string }> }) {
  const ipAddress = req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0] ?? "";
  const userId = await resolveClerkUserId(ipAddress);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { companyId, id } = await params;
  const company = await findCompany(companyId);
  if (!company) return NextResponse.json({ success: false, error_message: "Company not found" }, { status: 404 });

  const user = await db.query.users.findFirst({
    where: eq(users.id, BigInt(userId)),
    with: { userComplianceInfos: latestUserComplianceInfo },
  });
  if (!user) return NextResponse.json({ success: false, error_message: "User not found" }, { status: 404 });

  const contractor = await db.query.companyContractors.findFirst({
    where: and(
      eq(companyContractors.companyId, company.id),
      eq(companyContractors.userId, user.id),
      isNull(companyContractors.endedAt),
    ),
    with: {
      user: true,
      company: true,
      role: true,
    },
  });
  if (!contractor) {
    return NextResponse.json({ success: false, error_message: "Contractor not found" }, { status: 403 });
  }

  const existingInvoice = await db.query.invoices.findFirst({
    where: and(eq(invoices.companyId, company.id), eq(invoices.userId, user.id), eq(invoices.externalId, id)),
    with: {
      lineItems: true,
      expenses: true,
    },
  });
  if (!existingInvoice) {
    return NextResponse.json({ success: false, error_message: "Invoice not found" }, { status: 404 });
  }

  const parsed = await parseInvoiceRequest(req);
  if (parsed.lineItems.length === 0) {
    return NextResponse.json({ success: false, error_message: "Please input all values" }, { status: 422 });
  }

  const isHourly = contractor.payRateType === PayRateType.Hourly;
  let totalMinutes = 0;
  let totalServicesCents = 0;

  interface ProcessedLineItem {
    id?: bigint | undefined;
    description: string;
    minutes: number | null;
    payRateInSubunits: number;
    payRateCurrency: string;
    totalAmountCents: bigint;
  }
  const processedLineItems: ProcessedLineItem[] = [];
  for (const item of parsed.lineItems) {
    if (!item.description) {
      return NextResponse.json({ success: false, error_message: "Please input all values" }, { status: 422 });
    }
    if (isHourly) {
      const minutes = item.minutes ?? 0;
      if (minutes <= 0) {
        return NextResponse.json({ success: false, error_message: "Please input all values" }, { status: 422 });
      }
      const itemAmount = Math.ceil(contractor.payRateInSubunits * (minutes / 60.0));
      totalMinutes += minutes;
      totalServicesCents += itemAmount;
      processedLineItems.push({
        id: item.id ? BigInt(item.id) : undefined,
        description: item.description,
        minutes,
        payRateInSubunits: contractor.payRateInSubunits,
        payRateCurrency: contractor.payRateCurrency,
        totalAmountCents: BigInt(itemAmount),
      });
    } else {
      const itemAmount = item.total_amount_cents ?? 0;
      if (itemAmount <= 0) {
        return NextResponse.json({ success: false, error_message: "Please input all values" }, { status: 422 });
      }
      totalServicesCents += itemAmount;
      processedLineItems.push({
        id: item.id ? BigInt(item.id) : undefined,
        description: item.description,
        minutes: null,
        payRateInSubunits: contractor.payRateInSubunits,
        payRateCurrency: contractor.payRateCurrency,
        totalAmountCents: BigInt(itemAmount),
      });
    }
  }

  interface ProcessedExpense {
    id?: bigint | undefined;
    description: string;
    expenseCategoryId: bigint;
    totalAmountInCents: bigint;
  }
  let totalExpensesCents = 0;
  const processedExpenses: ProcessedExpense[] = [];
  for (const exp of parsed.expenses) {
    if (!exp.description || !exp.expense_category_id || exp.total_amount_in_cents <= 0) {
      return NextResponse.json({ success: false, error_message: "Please input all values" }, { status: 422 });
    }
    totalExpensesCents += exp.total_amount_in_cents;
    processedExpenses.push({
      id: exp.id ? BigInt(exp.id) : undefined,
      description: exp.description,
      expenseCategoryId: BigInt(exp.expense_category_id),
      totalAmountInCents: BigInt(exp.total_amount_in_cents),
    });
  }

  const totalAmountInUsdCents = BigInt(totalServicesCents + totalExpensesCents);
  const invoiceDateString =
    parsed.invoiceDate || existingInvoice.invoiceDate || formatISO(new Date(), { representation: "date" });
  const invoiceYear = new Date(invoiceDateString).getFullYear();

  let equityAmountInCents = 0n;
  let equityAmountInOptions = 0;
  let equityPercentage = 0;
  let selectedPercentage: number | null = null;

  if (company.equityCompensationEnabled) {
    const equityResult = await calculateInvoiceEquity({
      companyContractor: contractor,
      serviceAmountCents: BigInt(totalServicesCents),
      invoiceYear,
      equityCompensationEnabled: true,
    });

    if (equityResult) {
      equityAmountInCents = BigInt(equityResult.equityCents);
      equityAmountInOptions = equityResult.equityOptions;
      equityPercentage = equityResult.equityPercentage;
      selectedPercentage = equityResult.selectedPercentage;
    }
  }

  const cashAmountInCents = totalAmountInUsdCents - equityAmountInCents;
  const flexileFeeCents = getFlexileFeeCents(totalAmountInUsdCents);
  const invoiceNumber = parsed.invoiceNumber || existingInvoice.invoiceNumber;

  await db.transaction(async (tx) => {
    await tx
      .update(invoices)
      .set({
        invoiceNumber,
        invoiceDate: invoiceDateString,
        notes: parsed.notes !== undefined ? parsed.notes : existingInvoice.notes,
        totalAmountInUsdCents,
        cashAmountInCents,
        equityAmountInCents,
        equityAmountInOptions,
        equityPercentage,
        totalMinutes: isHourly ? totalMinutes : null,
        flexileFeeCents,
      })
      .where(eq(invoices.id, existingInvoice.id));

    // Replace line items
    await tx.delete(invoiceLineItems).where(eq(invoiceLineItems.invoiceId, existingInvoice.id));
    for (const item of processedLineItems) {
      await tx.insert(invoiceLineItems).values({
        invoiceId: existingInvoice.id,
        description: item.description,
        minutes: item.minutes,
        payRateInSubunits: item.payRateInSubunits,
        payRateCurrency: item.payRateCurrency,
        totalAmountCents: item.totalAmountCents,
      });
    }

    // Replace expenses
    await tx.delete(invoiceExpenses).where(eq(invoiceExpenses.invoiceId, existingInvoice.id));
    for (const exp of processedExpenses) {
      await tx.insert(invoiceExpenses).values({
        invoiceId: existingInvoice.id,
        description: exp.description,
        expenseCategoryId: exp.expenseCategoryId,
        totalAmountInCents: exp.totalAmountInCents,
      });
    }

    if (selectedPercentage != null) {
      await tx
        .update(equityAllocations)
        .set({ locked: true })
        .where(and(eq(equityAllocations.companyContractorId, contractor.id), eq(equityAllocations.year, invoiceYear)));
    }
  });

  return NextResponse.json({ success: true });
}
