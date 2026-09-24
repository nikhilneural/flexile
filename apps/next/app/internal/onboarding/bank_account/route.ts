import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { documents, users, wiseRecipients } from "@/db/schema";
import { resolveClerkUserId } from "@/trpc/auth";
import { latestUserComplianceInfo, userDisplayEmail } from "@/trpc/routes/users/helpers";
import { getCountryName } from "@/utils/countries";

export async function GET(req: Request) {
  const ipAddress = req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0] ?? "";
  const userId = await resolveClerkUserId(ipAddress);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const user = await db.query.users.findFirst({
    where: eq(users.id, BigInt(userId)),
    with: {
      userComplianceInfos: latestUserComplianceInfo,
      wiseRecipients: {
        where: and(eq(wiseRecipients.usedForInvoices, true), isNull(wiseRecipients.deletedAt)),
      },
    },
  });
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  if (user.wiseRecipients.length > 0) {
    return NextResponse.json({ redirect_path: "/dashboard" }, { status: 403 });
  }

  const compliance = user.userComplianceInfos[0];
  const billingEntityName = compliance?.businessEntity ? compliance.businessName || user.legalName : user.legalName;

  const unsignedDoc = await db.query.documents.findFirst({
    where: and(eq(documents.userId, user.id), isNull(documents.completedAt), isNotNull(documents.docusealSubmissionId)),
  });

  return NextResponse.json({
    email: userDisplayEmail(user),
    country: getCountryName(user.countryCode) || "Not Specified",
    country_code: user.countryCode,
    state: user.state,
    city: user.city,
    zip_code: user.zipCode,
    street_address: user.streetAddress,
    billing_entity_name: billingEntityName,
    legal_type: compliance?.businessEntity ? "BUSINESS" : "PRIVATE",
    unsigned_document_id: unsignedDoc?.id != null ? Number(unsignedDoc.id) : null,
  });
}
