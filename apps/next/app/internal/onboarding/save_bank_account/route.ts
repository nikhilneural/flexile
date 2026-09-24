import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { wiseRecipients } from "@/db/schema";
import { resolveClerkUserId } from "@/trpc/auth";

export async function PATCH(req: Request) {
  const ipAddress = req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0] ?? "";
  const userId = await resolveClerkUserId(ipAddress);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const recipient = body.recipient ?? {};
  const rawDetails = recipient.details && typeof recipient.details === "object" ? recipient.details : {};
  const details: Record<string, unknown> = rawDetails;
  const replaceRecipientId = body.replace_recipient_id;

  if (replaceRecipientId) {
    await db
      .update(wiseRecipients)
      .set({ deletedAt: new Date() })
      .where(eq(wiseRecipients.id, BigInt(replaceRecipientId)));
  }

  const rawAccountNumber =
    details.accountNumber ??
    details.iban ??
    details.clabe ??
    details["account.accountNumber"] ??
    details["details.accountNumber"] ??
    "0000";
  const accountNumber = String(rawAccountNumber);
  const lastFourDigits = accountNumber.slice(-4);
  const currency = typeof recipient.currency === "string" ? recipient.currency : "USD";
  const countryCode = String(details.country ?? details["address.country"] ?? "US");
  const bankName = String(details.bankName ?? "Bank");
  const rawHolder = details.accountHolderName ?? details["address.accountHolderName"];
  const accountHolderName = rawHolder ? String(rawHolder) : null;

  const [newRecipient] = await db
    .insert(wiseRecipients)
    .values({
      userId: BigInt(userId),
      recipientId: `rec_${nanoid()}`,
      currency,
      countryCode,
      bankName,
      accountHolderName,
      lastFourDigits,
      usedForInvoices: true,
      usedForDividends: true,
    })
    .returning();

  if (!newRecipient) {
    return NextResponse.json({ success: false, error: "Error saving recipient" });
  }

  // Format flattened details for BankAccountModal
  const flattenedDetails: Record<string, string | null> = {};
  for (const [k, v] of Object.entries(details)) {
    if (v != null) flattenedDetails[k] = String(v);
  }

  return NextResponse.json({
    success: true,
    bank_account: {
      id: Number(newRecipient.id),
      currency: newRecipient.currency,
      details: flattenedDetails,
      last_four_digits: newRecipient.lastFourDigits ?? "0000",
      used_for_invoices: newRecipient.usedForInvoices,
      used_for_dividends: newRecipient.usedForDividends,
    },
  });
}
