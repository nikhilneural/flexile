import { formatISO } from "date-fns";
import { and, desc, eq, ilike } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { companyAdministrators, companyContractors, companyInvestors, companyLawyers, invoices } from "@/db/schema";
import { resolveClerkUserId } from "@/trpc/auth";
import { findCompany } from "../invoices/helpers";

interface SearchUserResult {
  name: string;
  role: string;
  url: string;
}

interface SearchInvoiceResult {
  status: string;
  paid_at: Date | null;
  invoice_number: string;
  invoice_date: string;
  title: string;
  url: string;
}

export async function GET(req: Request, { params }: { params: Promise<{ companyId: string }> }) {
  const ipAddress = req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0] ?? "";
  const userId = await resolveClerkUserId(ipAddress);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { companyId } = await params;
  const company = await findCompany(companyId);
  if (!company) return NextResponse.json({ success: false, error: "Company not found" }, { status: 404 });

  const userBigInt = BigInt(userId);
  const [admin, contractor, investor, lawyer] = await Promise.all([
    db.query.companyAdministrators.findFirst({
      where: and(eq(companyAdministrators.companyId, company.id), eq(companyAdministrators.userId, userBigInt)),
    }),
    db.query.companyContractors.findFirst({
      where: and(eq(companyContractors.companyId, company.id), eq(companyContractors.userId, userBigInt)),
    }),
    db.query.companyInvestors.findFirst({
      where: and(eq(companyInvestors.companyId, company.id), eq(companyInvestors.userId, userBigInt)),
    }),
    db.query.companyLawyers.findFirst({
      where: and(eq(companyLawyers.companyId, company.id), eq(companyLawyers.userId, userBigInt)),
    }),
  ]);

  if (!admin && !contractor && !investor && !lawyer) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const query = (url.searchParams.get("query") ?? "").trim();
  const searchPattern = `%${query}%`;

  const invoiceRows = await db.query.invoices.findMany({
    where: and(eq(invoices.companyId, company.id), query ? ilike(invoices.invoiceNumber, searchPattern) : undefined),
    with: {
      user: true,
    },
    orderBy: desc(invoices.invoiceDate),
    limit: 6,
  });

  const matchedInvoices: SearchInvoiceResult[] = invoiceRows.map((inv) => {
    const creatorName = inv.user.legalName || inv.user.preferredName || "Worker";
    return {
      status: inv.status,
      paid_at: inv.paidAt,
      invoice_number: inv.invoiceNumber,
      invoice_date: inv.invoiceDate ? formatISO(inv.invoiceDate, { representation: "date" }) : "",
      title: `${inv.invoiceNumber} from ${creatorName}`,
      url: `/invoices/${inv.externalId}`,
    };
  });

  const workerRows = await db.query.companyContractors.findMany({
    where: eq(companyContractors.companyId, company.id),
    with: {
      user: true,
      role: true,
    },
    limit: 20,
  });

  const investorRows = await db.query.companyInvestors.findMany({
    where: eq(companyInvestors.companyId, company.id),
    with: {
      user: true,
    },
    limit: 20,
  });

  const matchedUsers: SearchUserResult[] = [];

  const lowerQuery = query.toLowerCase();

  for (const w of workerRows) {
    const name = w.user.legalName || w.user.preferredName || "";
    const email = w.user.email || "";
    if (!lowerQuery || name.toLowerCase().includes(lowerQuery) || email.toLowerCase().includes(lowerQuery)) {
      matchedUsers.push({
        name,
        role: w.role.name || "Contractor",
        url: `/people/${w.user.externalId}`,
      });
    }
  }

  for (const inv of investorRows) {
    const name = inv.user.legalName || inv.user.preferredName || "";
    const email = inv.user.email || "";
    if (!lowerQuery || name.toLowerCase().includes(lowerQuery) || email.toLowerCase().includes(lowerQuery)) {
      matchedUsers.push({
        name,
        role: "Investor",
        url: `/people/${inv.user.externalId}`,
      });
    }
  }

  matchedUsers.sort((a, b) => a.name.localeCompare(b.name));
  const limitedUsers = matchedUsers.slice(0, 6);

  return NextResponse.json({
    invoices: matchedInvoices,
    users: limitedUsers,
  });
}
