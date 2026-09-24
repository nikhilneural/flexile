import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { findCompany } from "@/app/internal/companies/[companyId]/invoices/helpers";
import { db } from "@/db";
import { companyRoles } from "@/db/schema";

export async function GET(_req: Request, { params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const company = await findCompany(companyId);
  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  const roles = await db.query.companyRoles.findMany({
    where: and(
      eq(companyRoles.companyId, company.id),
      eq(companyRoles.activelyHiring, true),
      isNull(companyRoles.deletedAt),
    ),
    with: {
      rates: true,
    },
  });

  const presentedRoles = roles.map((role) => {
    const rate = role.rates[0];
    const payRate = rate?.payRateInSubunits ?? 0;
    const workingWeeks = 50;

    return {
      name: role.name,
      job_description: role.jobDescription,
      location: "Global",
      url: `/roles/${company.externalId}/${role.externalId}`,
      min_comp_usd: (workingWeeks * 20 * payRate) / 100,
      max_comp_usd: (workingWeeks * 35 * payRate) / 100,
      currency_code: "USD",
      period: "yearly",
      location_type: "Remote",
      employment_type: "Part-time",
    };
  });

  return NextResponse.json(presentedRoles);
}
