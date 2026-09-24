import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { companies, companyStripeAccounts, users } from "@/db/schema";
import { resolveClerkUserId } from "@/trpc/auth";
import { getCountryStates } from "@/utils/countries";

export async function GET(req: Request, { params }: { params: Promise<{ companyId: string }> }) {
  const ipAddress = req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0] ?? "";
  const userId = await resolveClerkUserId(ipAddress);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { companyId } = await params;
  const user = await db.query.users.findFirst({
    where: eq(users.id, BigInt(userId)),
  });
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  let company = null;
  if (companyId && companyId !== "_") {
    company = await db.query.companies.findFirst({
      where: eq(companies.externalId, companyId),
    });
  }

  let bankAccountAdded = false;
  if (company) {
    const stripe = await db.query.companyStripeAccounts.findFirst({
      where: and(eq(companyStripeAccounts.companyId, company.id), isNull(companyStripeAccounts.deletedAt)),
    });
    bankAccountAdded = Boolean(stripe && stripe.status !== "initial");
  }

  const onSuccessRedirectPath = company
    ? bankAccountAdded
      ? "/people"
      : `/companies/${company.externalId}/administrator/onboarding/bank_account`
    : "/people";

  return NextResponse.json({
    company: {
      name: company?.name ?? null,
      street_address: company?.streetAddress ?? null,
      city: company?.city ?? null,
      state: company?.state ?? null,
      zip_code: company?.zipCode ?? null,
    },
    states: getCountryStates("US"),
    legal_name: user.legalName,
    on_success_redirect_path: onSuccessRedirectPath,
  });
}
