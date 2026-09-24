import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { companyAdministrators, companyContractors, companyInvestors, companyLawyers } from "@/db/schema";
import { resolveClerkUserId } from "@/trpc/auth";
import { findCompany } from "../invoices/helpers";

interface SigneeResult {
  id: number;
  type: string;
  name: string;
  email: string;
  role: string;
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
  const query = (url.searchParams.get("query") ?? "").trim().toLowerCase();

  const [workers, investors, admins] = await Promise.all([
    db.query.companyContractors.findMany({
      where: eq(companyContractors.companyId, company.id),
      with: { user: true },
    }),
    db.query.companyInvestors.findMany({
      where: eq(companyInvestors.companyId, company.id),
      with: { user: true },
    }),
    db.query.companyAdministrators.findMany({
      where: eq(companyAdministrators.companyId, company.id),
      with: { user: true },
    }),
  ]);

  const results: SigneeResult[] = [];

  for (const w of workers) {
    const name = w.user.legalName || w.user.preferredName || "";
    const email = w.user.email;
    if (!query || name.toLowerCase().includes(query) || email.toLowerCase().includes(query)) {
      results.push({
        id: Number(w.id),
        type: "CompanyWorker",
        name,
        email,
        role: "Contractor",
      });
    }
  }

  for (const inv of investors) {
    const name = inv.user.legalName || inv.user.preferredName || "";
    const email = inv.user.email;
    if (!query || name.toLowerCase().includes(query) || email.toLowerCase().includes(query)) {
      results.push({
        id: Number(inv.id),
        type: "CompanyInvestor",
        name,
        email,
        role: "Investor",
      });
    }
  }

  for (const a of admins) {
    const name = a.user.legalName || a.user.preferredName || "";
    const email = a.user.email;
    if (!query || name.toLowerCase().includes(query) || email.toLowerCase().includes(query)) {
      results.push({
        id: Number(a.id),
        type: "CompanyAdministrator",
        name,
        email,
        role: "Administrator",
      });
    }
  }

  results.sort((a, b) => a.name.localeCompare(b.name));
  const limitedResults = results.slice(0, 20);

  return NextResponse.json(limitedResults);
}
