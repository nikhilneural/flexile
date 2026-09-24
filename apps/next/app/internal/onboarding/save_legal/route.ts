import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { userComplianceInfos, users } from "@/db/schema";
import { resolveClerkUserId } from "@/trpc/auth";
import { latestUserComplianceInfo } from "@/trpc/routes/users/helpers";

export async function PATCH(req: Request) {
  const ipAddress = req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0] ?? "";
  const userId = await resolveClerkUserId(ipAddress);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const userObj = body.user && typeof body.user === "object" ? (body.user as Record<string, unknown>) : undefined;
  const data = userObj ?? body;

  const streetAddress = typeof data.street_address === "string" ? data.street_address.trim() : "";
  const city = typeof data.city === "string" ? data.city.trim() : "";
  const state = typeof data.state === "string" ? data.state.trim() : null;
  const zipCode = typeof data.zip_code === "string" ? data.zip_code.trim() : "";
  const businessEntity = Boolean(data.business_entity);
  const businessName = typeof data.business_name === "string" ? data.business_name.trim() : null;
  const taxId = typeof data.tax_id === "string" ? data.tax_id.trim() : null;
  const birthDate = data.birth_date ? String(data.birth_date).trim() : null;
  const signature = typeof data.signature === "string" ? data.signature.trim() : null;

  if (!streetAddress || !city || !zipCode || (businessEntity && !businessName)) {
    return NextResponse.json({ success: false, error_message: "Please input all values" });
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, BigInt(userId)),
    with: { userComplianceInfos: latestUserComplianceInfo },
  });
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  await db
    .update(users)
    .set({
      streetAddress,
      city,
      state,
      zipCode,
      ...(birthDate ? { birthDate } : {}),
    })
    .where(eq(users.id, user.id));

  const previousCompliance = user.userComplianceInfos[0];
  await db.insert(userComplianceInfos).values({
    userId: user.id,
    legalName: previousCompliance?.legalName ?? user.legalName,
    countryCode: previousCompliance?.countryCode ?? user.countryCode,
    citizenshipCountryCode: previousCompliance?.citizenshipCountryCode ?? user.citizenshipCountryCode,
    streetAddress,
    city,
    state,
    zipCode,
    businessEntity,
    businessName,
    taxId: taxId ?? previousCompliance?.taxId,
    birthDate: birthDate ?? previousCompliance?.birthDate ?? user.birthDate,
    signature: signature ?? previousCompliance?.signature,
    taxInformationConfirmedAt: taxId ? new Date() : previousCompliance?.taxInformationConfirmedAt,
  });

  return NextResponse.json({ success: true });
}
