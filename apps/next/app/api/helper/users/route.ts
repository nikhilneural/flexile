import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getCountryName } from "@/utils/countries";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const email = (url.searchParams.get("email") ?? "").trim().toLowerCase();

  if (!email) {
    return NextResponse.json({ success: false, error: "'email' parameter is required" }, { status: 400 });
  }

  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
    with: {
      companyContractors: {
        with: { company: true },
      },
      companyAdministrators: {
        with: { company: true },
      },
      companyInvestors: {
        with: { company: true },
      },
    },
  });

  const notes: string[] = [];

  if (user) {
    if (user.countryCode) {
      const country = getCountryName(user.countryCode) || user.countryCode;
      notes.push(`The user's residence country is ${country}`);
    }

    const contractorCompanies = user.companyContractors.map((c) => c.company.name).filter(Boolean);
    if (contractorCompanies.length > 0) {
      notes.push(`The user is a contractor for ${contractorCompanies.join(", ")}`);
    }

    const investorCompanies = user.companyInvestors.map((i) => i.company.name).filter(Boolean);
    if (investorCompanies.length > 0) {
      notes.push(`The user is an investor for ${investorCompanies.join(", ")}`);
    }

    const adminCompanies = user.companyAdministrators.map((a) => a.company.name).filter(Boolean);
    if (adminCompanies.length > 0) {
      notes.push(`The user is an administrator for ${adminCompanies.join(", ")}`);
    }
  }

  return NextResponse.json({
    success: true,
    user_info: {
      prompt: notes.join("\n"),
      metadata: user ? { name: user.email } : {},
    },
  });
}
