import { format, formatISO } from "date-fns";
import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { companyAdministrators, companyContractors, invoices } from "@/db/schema";
import { resolveClerkUserId } from "@/trpc/auth";
import { findCompany } from "../helpers";

function escapeCsvField(field: string): string {
  if (field.includes(",") || field.includes('"') || field.includes("\n") || field.includes("\r")) {
    return `"${field.replace(/"/gu, '""')}"`;
  }
  return field;
}

export async function GET(req: Request, { params }: { params: Promise<{ companyId: string }> }) {
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

  const allInvoices = await db.query.invoices.findMany({
    where: eq(invoices.companyId, company.id),
    orderBy: asc(invoices.createdAt),
    with: {
      user: {
        with: {
          companyContractors: {
            where: eq(companyContractors.companyId, company.id),
            with: { role: true },
          },
        },
      },
    },
  });

  const headers = ["Contractor name", "Role", "Invoice date", "Invoice ID", "Paid at", "Amount in USD", "Status"];
  const rows: string[][] = [];

  for (const inv of allInvoices) {
    const status = inv.status === "received" ? "open" : inv.status;
    const contractorName = inv.user?.legalName ?? "";
    const roleName = inv.user?.companyContractors?.[0]?.role?.name ?? "";
    const invoiceDate = inv.invoiceDate;
    const invoiceId = inv.invoiceNumber;
    const paidAt = inv.paidAt ? formatISO(inv.paidAt, { representation: "date" }) : "";
    const amountInUsd = (Number(inv.totalAmountInUsdCents) / 100).toFixed(2);

    rows.push([contractorName, roleName, invoiceDate, invoiceId, paidAt, amountInUsd, status]);
  }

  const csvContent = [
    headers.map(escapeCsvField).join(","),
    ...rows.map((row) => row.map(escapeCsvField).join(",")),
  ].join("\n");

  const timestamp = format(new Date(), "yyyy-MM-dd_HHmmss");

  return new Response(csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=invoices-${timestamp}.csv`,
    },
  });
}
