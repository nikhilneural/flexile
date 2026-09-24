import { asc, desc, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, wallets, wiseRecipients } from "@/db/schema";
import { resolveClerkUserId } from "@/trpc/auth";
import { latestUserComplianceInfo } from "@/trpc/routes/users/helpers";
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
        where: isNull(wiseRecipients.deletedAt),
        orderBy: asc(wiseRecipients.id),
      },
      wallets: {
        where: isNull(wallets.deletedAt),
        orderBy: desc(wallets.createdAt),
      },
    },
  });

  if (!user) return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });

  const compliance = user.userComplianceInfos[0];
  const countryCode = compliance?.countryCode ?? user.countryCode ?? "US";
  const citizenshipCountryCode = compliance?.citizenshipCountryCode ?? user.citizenshipCountryCode ?? "US";
  const country = getCountryName(countryCode) || "Not Specified";
  const isBusiness = Boolean(compliance?.businessEntity ?? false);

  const bankAccounts = user.wiseRecipients.map((recipient) => ({
    id: Number(recipient.id),
    currency: recipient.currency ?? "USD",
    details: {
      accountHolderName: recipient.accountHolderName ?? "",
      bankName: recipient.bankName ?? "",
    },
    last_four_digits: recipient.lastFourDigits ?? "0000",
    used_for_invoices: recipient.usedForInvoices,
    used_for_dividends: recipient.usedForDividends,
  }));

  const defaultAccount = user.wiseRecipients.find((r) => r.usedForInvoices) ?? user.wiseRecipients[0];

  return NextResponse.json({
    email: user.email,
    country_code: countryCode,
    citizenship_country_code: citizenshipCountryCode,
    country,
    state: compliance?.state ?? user.state ?? null,
    city: compliance?.city ?? user.city ?? "",
    zip_code: compliance?.zipCode ?? user.zipCode ?? "",
    street_address: compliance?.streetAddress ?? user.streetAddress ?? "",
    billing_entity_name: isBusiness
      ? (compliance?.businessName ?? compliance?.legalName ?? user.legalName ?? "")
      : (compliance?.legalName ?? user.legalName ?? ""),
    legal_type: isBusiness ? "BUSINESS" : "PRIVATE",
    bank_accounts: bankAccounts,
    bank_account_currency: defaultAccount?.currency ?? null,
    wallet_address: user.wallets[0]?.walletAddress ?? null,
  });
}
