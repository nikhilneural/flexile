import { NextResponse } from "next/server";
import { db } from "@/db";

export async function GET() {
  const allCompanies = await db.query.companies.findMany({
    columns: {
      externalId: true,
      name: true,
      countryCode: true,
      defaultCurrency: true,
    },
  });

  return NextResponse.json(allCompanies);
}
