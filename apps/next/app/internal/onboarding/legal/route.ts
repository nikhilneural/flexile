import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { resolveClerkUserId } from "@/trpc/auth";
import { latestUserComplianceInfo } from "@/trpc/routes/users/helpers";
import { getCountryStates } from "@/utils/countries";

export async function GET(req: Request) {
  const ipAddress = req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0] ?? "";
  const userId = await resolveClerkUserId(ipAddress);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const user = await db.query.users.findFirst({
    where: eq(users.id, BigInt(userId)),
    with: {
      userComplianceInfos: latestUserComplianceInfo,
      companyInvestors: { with: { company: true } },
      companyContractors: { with: { company: true } },
    },
  });
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const compliance = user.userComplianceInfos[0];
  const isInvestor = user.companyInvestors.length > 0;
  const isWorkerWithTaxForms = user.companyContractors.some((c) => Boolean(c.company?.irsTaxForms));
  const collectTaxInfo = isInvestor || isWorkerWithTaxForms;

  const citizenship = compliance?.citizenshipCountryCode || user.citizenshipCountryCode;
  const isForeign = ![citizenship, user.countryCode].includes("US");
  const zipCodeLabel = user.countryCode === "US" ? "Zip code" : "Postal code";

  const states = getCountryStates(user.countryCode || "US");

  return NextResponse.json({
    user: {
      collect_tax_info: collectTaxInfo,
      legal_name: user.legalName,
      street_address: compliance?.streetAddress ?? user.streetAddress,
      city: compliance?.city ?? user.city,
      state: compliance?.state ?? user.state,
      zip_code: compliance?.zipCode ?? user.zipCode,
      zip_code_label: zipCodeLabel,
      business_entity: Boolean(compliance?.businessEntity),
      business_name: compliance?.businessName ?? null,
      is_foreign: isForeign,
      tax_id: compliance?.taxId ?? null,
      birth_date: compliance?.birthDate ?? user.birthDate ?? null,
    },
    states,
  });
}
