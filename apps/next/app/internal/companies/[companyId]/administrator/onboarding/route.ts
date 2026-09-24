import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { companies, companyAdministrators, users } from "@/db/schema";
import { resolveClerkUserId } from "@/trpc/auth";

export async function PATCH(req: Request, { params }: { params: Promise<{ companyId: string }> }) {
  const ipAddress = req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0] ?? "";
  const userId = await resolveClerkUserId(ipAddress);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { companyId } = await params;
  const user = await db.query.users.findFirst({
    where: eq(users.id, BigInt(userId)),
    with: { companyAdministrators: true },
  });
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const companyData = body.company ?? {};
  const name = companyData.name?.trim();
  const streetAddress = companyData.street_address?.trim();
  const city = companyData.city?.trim();
  const state = companyData.state?.trim();
  const zipCode = companyData.zip_code?.trim();
  const legalName = body.legal_name?.trim();

  if (!name || !streetAddress || !city || !state || !zipCode || !legalName) {
    return NextResponse.json({ success: false, error_message: "Please input all values" });
  }

  await db.update(users).set({ legalName }).where(eq(users.id, user.id));

  let company = null;
  if (companyId && companyId !== "_") {
    company = await db.query.companies.findFirst({
      where: eq(companies.externalId, companyId),
    });
  }

  if (!company) {
    const [newCompany] = await db
      .insert(companies)
      .values({
        name,
        email: user.email,
        streetAddress,
        city,
        state,
        zipCode,
        countryCode: "US",
        defaultCurrency: "usd",
      })
      .returning();

    if (newCompany) {
      await db.insert(companyAdministrators).values({
        companyId: newCompany.id,
        userId: user.id,
      });
    }
  } else {
    await db
      .update(companies)
      .set({
        name,
        streetAddress,
        city,
        state,
        zipCode,
      })
      .where(eq(companies.id, company.id));
  }

  return NextResponse.json({ success: true });
}
