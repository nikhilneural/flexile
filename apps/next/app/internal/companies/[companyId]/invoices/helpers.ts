import { and, desc, eq, not, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { companies, invoices } from "@/db/schema";
import { getCountryName } from "@/utils/countries";

export async function findCompany(companyParam: string) {
  const isNumeric = /^\d+$/u.test(companyParam);
  return db.query.companies.findFirst({
    where: or(eq(companies.externalId, companyParam), isNumeric ? eq(companies.id, BigInt(companyParam)) : undefined),
  });
}

export async function getRecommendedInvoiceNumber(
  companyId: bigint,
  userId: bigint,
  excludeInvoiceId?: bigint,
): Promise<string> {
  const preceding = await db.query.invoices.findFirst({
    where: and(
      eq(invoices.companyId, companyId),
      eq(invoices.userId, userId),
      eq(invoices.invoiceType, "services"),
      excludeInvoiceId ? not(eq(invoices.id, excludeInvoiceId)) : undefined,
    ),
    orderBy: [desc(invoices.invoiceDate), desc(invoices.createdAt)],
  });

  if (!preceding || !preceding.invoiceNumber) return "1";

  const matches = preceding.invoiceNumber.match(/\d+/gu);
  const digits = matches ? matches[matches.length - 1] : null;
  if (!digits) return "1";
  const num = parseInt(digits, 10);
  if (num === 0) return "1";
  const nextNum = (num + 1).toString().padStart(digits.length, "0");

  return preceding.invoiceNumber
    .split("")
    .reverse()
    .join("")
    .replace(digits.split("").reverse().join(""), nextNum.split("").reverse().join(""))
    .split("")
    .reverse()
    .join("");
}

export function getFlexileFeeCents(totalAmountCents: bigint): bigint {
  const BASE_FLEXILE_FEE_CENTS = 50n;
  const MAX_FLEXILE_FEE_CENTS = 1500n;
  const PERCENT_FLEXILE_FEE = 1.5;

  const feeCents = BASE_FLEXILE_FEE_CENTS + (totalAmountCents * BigInt(Math.round(PERCENT_FLEXILE_FEE * 100))) / 10000n;
  return feeCents > MAX_FLEXILE_FEE_CENTS ? MAX_FLEXILE_FEE_CENTS : feeCents;
}

export function formatAddress(address: {
  streetAddress?: string | null | undefined;
  city?: string | null | undefined;
  state?: string | null | undefined;
  zipCode?: string | null | undefined;
  countryCode?: string | null | undefined;
}) {
  const countryCode = address.countryCode ?? "US";
  return {
    street_address: address.streetAddress ?? "",
    city: address.city ?? "",
    zip_code: address.zipCode ?? "",
    state: address.state ?? null,
    country_code: countryCode,
    country: getCountryName(countryCode) || "United States",
  };
}

export interface ParsedLineItem {
  id?: string | undefined;
  description: string;
  minutes?: number | undefined;
  total_amount_cents?: number | undefined;
}

export interface ParsedExpense {
  id?: string | undefined;
  description: string;
  expense_category_id: number;
  total_amount_in_cents: number;
}

export interface ParsedInvoiceData {
  invoiceNumber?: string | undefined;
  invoiceDate?: string | undefined;
  notes?: string | undefined;
  lineItems: ParsedLineItem[];
  expenses: ParsedExpense[];
}

const jsonBodySchema = z.object({
  invoice: z
    .object({
      invoice_number: z.string().optional(),
      invoice_date: z.string().optional(),
      notes: z.string().optional(),
    })
    .optional(),
  invoice_line_items: z
    .array(
      z.object({
        id: z.union([z.string(), z.number()]).optional(),
        description: z.string(),
        minutes: z.number().optional(),
        total_amount_cents: z.number().optional(),
      }),
    )
    .optional(),
  invoice_expenses: z
    .array(
      z.object({
        id: z.union([z.string(), z.number()]).optional(),
        description: z.string(),
        expense_category_id: z.number(),
        total_amount_in_cents: z.number(),
      }),
    )
    .optional(),
});

export async function parseInvoiceRequest(req: Request): Promise<ParsedInvoiceData> {
  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
    const formData = await req.formData();
    const rawInvoiceNumber = formData.get("invoice[invoice_number]");
    const invoiceNumber =
      typeof rawInvoiceNumber === "string" && rawInvoiceNumber.trim() ? rawInvoiceNumber.trim() : undefined;

    const rawInvoiceDate = formData.get("invoice[invoice_date]");
    const invoiceDate = typeof rawInvoiceDate === "string" && rawInvoiceDate.trim() ? rawInvoiceDate.trim() : undefined;

    const rawNotes = formData.get("invoice[notes]");
    const notes = typeof rawNotes === "string" && rawNotes.trim() ? rawNotes.trim() : undefined;

    const descriptions = formData
      .getAll("invoice_line_items[][description]")
      .map((v) => (typeof v === "string" ? v : ""));
    const minutesList = formData.getAll("invoice_line_items[][minutes]").map((v) => (typeof v === "string" ? v : ""));
    const amountsList = formData
      .getAll("invoice_line_items[][total_amount_cents]")
      .map((v) => (typeof v === "string" ? v : ""));
    const lineItemIds = formData.getAll("invoice_line_items[][id]").map((v) => (typeof v === "string" ? v : ""));

    const lineItems: ParsedLineItem[] = [];
    for (let i = 0; i < descriptions.length; i++) {
      const desc = descriptions[i]?.trim();
      if (!desc) continue;
      const minVal = minutesList[i] ? Number(minutesList[i]) : undefined;
      const amtVal = amountsList[i] ? Number(amountsList[i]) : undefined;
      lineItems.push({
        id: lineItemIds[i]?.trim() || undefined,
        description: desc,
        minutes: Number.isFinite(minVal) ? minVal : undefined,
        total_amount_cents: Number.isFinite(amtVal) ? amtVal : undefined,
      });
    }

    const expenseDescriptions = formData
      .getAll("invoice_expenses[][description]")
      .map((v) => (typeof v === "string" ? v : ""));
    const categoryIds = formData
      .getAll("invoice_expenses[][expense_category_id]")
      .map((v) => (typeof v === "string" ? v : ""));
    const expenseAmounts = formData
      .getAll("invoice_expenses[][total_amount_in_cents]")
      .map((v) => (typeof v === "string" ? v : ""));
    const expenseIds = formData.getAll("invoice_expenses[][id]").map((v) => (typeof v === "string" ? v : ""));

    const expenses: ParsedExpense[] = [];
    for (let i = 0; i < expenseDescriptions.length; i++) {
      const desc = expenseDescriptions[i]?.trim();
      if (!desc) continue;
      expenses.push({
        id: expenseIds[i]?.trim() || undefined,
        description: desc,
        expense_category_id: Number(categoryIds[i] || 0),
        total_amount_in_cents: Number(expenseAmounts[i] || 0),
      });
    }

    return { invoiceNumber, invoiceDate, notes, lineItems, expenses };
  }

  const json: unknown = await req.json().catch(() => ({}));
  const parseResult = jsonBodySchema.safeParse(json);
  if (!parseResult.success) {
    return { lineItems: [], expenses: [] };
  }

  const { data } = parseResult;
  const lineItems: ParsedLineItem[] = (data.invoice_line_items ?? []).map((item) => ({
    id: item.id != null ? String(item.id) : undefined,
    description: item.description.trim(),
    minutes: item.minutes,
    total_amount_cents: item.total_amount_cents,
  }));

  const expenses: ParsedExpense[] = (data.invoice_expenses ?? []).map((exp) => ({
    id: exp.id != null ? String(exp.id) : undefined,
    description: exp.description.trim(),
    expense_category_id: exp.expense_category_id,
    total_amount_in_cents: exp.total_amount_in_cents,
  }));

  return {
    invoiceNumber: data.invoice?.invoice_number?.trim() || undefined,
    invoiceDate: data.invoice?.invoice_date?.trim() || undefined,
    notes: data.invoice?.notes?.trim() || undefined,
    lineItems,
    expenses,
  };
}
