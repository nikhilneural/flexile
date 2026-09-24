import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { userComplianceInfos, users } from "@/db/schema";
import { resolveClerkUserId } from "@/trpc/auth";
import { latestUserComplianceInfo } from "@/trpc/routes/users/helpers";

export async function GET(req: Request) {
  const ipAddress = req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0] ?? "";
  const userId = await resolveClerkUserId(ipAddress);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const user = await db.query.users.findFirst({
    where: eq(users.id, BigInt(userId)),
    with: { userComplianceInfos: latestUserComplianceInfo },
  });
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const compliance = user.userComplianceInfos[0];
  return NextResponse.json({
    legal_name: user.legalName,
    preferred_name: user.preferredName,
    country_code: user.countryCode,
    citizenship_country_code: compliance?.citizenshipCountryCode || user.citizenshipCountryCode || user.countryCode,
  });
}

export async function PATCH(req: Request) {
  const ipAddress = req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0] ?? "";
  const userId = await resolveClerkUserId(ipAddress);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const userData = body.user ?? body;

  const legalName = userData.legal_name?.trim();
  const preferredName = userData.preferred_name?.trim();
  const countryCode = userData.country_code?.trim();
  const citizenshipCountryCode = userData.citizenship_country_code?.trim();

  if (!legalName || !preferredName || !countryCode || !citizenshipCountryCode) {
    return NextResponse.json({ success: false, error_message: "Please input all values" });
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, BigInt(userId)),
    with: {
      userComplianceInfos: latestUserComplianceInfo,
      companyAdministrators: true,
      companyContractors: true,
      companyInvestors: true,
      companyLawyers: true,
    },
  });
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const isInitialOnboarding =
    user.companyAdministrators.length === 0 &&
    user.companyContractors.length === 0 &&
    user.companyInvestors.length === 0 &&
    user.companyLawyers.length === 0 &&
    !user.invitingCompany;

  await db
    .update(users)
    .set({
      legalName,
      preferredName,
      countryCode,
      citizenshipCountryCode,
      ...(isInitialOnboarding ? { invitingCompany: true } : {}),
    })
    .where(eq(users.id, user.id));

  const previousCompliance = user.userComplianceInfos[0];
  await db.insert(userComplianceInfos).values({
    userId: user.id,
    legalName,
    countryCode,
    citizenshipCountryCode,
    birthDate: previousCompliance?.birthDate ?? user.birthDate,
    streetAddress: previousCompliance?.streetAddress ?? user.streetAddress,
    city: previousCompliance?.city ?? user.city,
    state: previousCompliance?.state ?? user.state,
    zipCode: previousCompliance?.zipCode ?? user.zipCode,
    businessEntity: previousCompliance?.businessEntity ?? false,
    businessName: previousCompliance?.businessName,
    taxId: previousCompliance?.taxId,
  });

  return NextResponse.json({ success: true });
}
