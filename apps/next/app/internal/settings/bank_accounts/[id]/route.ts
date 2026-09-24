import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { wiseRecipients } from "@/db/schema";
import { resolveClerkUserId } from "@/trpc/auth";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ipAddress = req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0] ?? "";
  const userId = await resolveClerkUserId(ipAddress);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const accountId = BigInt(id);

  const bankAccount = await db.query.wiseRecipients.findFirst({
    where: and(
      eq(wiseRecipients.id, accountId),
      eq(wiseRecipients.userId, BigInt(userId)),
      isNull(wiseRecipients.deletedAt),
    ),
  });

  if (!bankAccount) {
    return NextResponse.json({ success: false, error: "Bank account not found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const bankAccountObj =
    body.bank_account && typeof body.bank_account === "object"
      ? (body.bank_account as Record<string, unknown>)
      : undefined;
  const bankAccountParams = bankAccountObj ?? body;
  const usedForInvoices =
    bankAccountParams.used_for_invoices !== undefined ? Boolean(bankAccountParams.used_for_invoices) : undefined;
  const usedForDividends =
    bankAccountParams.used_for_dividends !== undefined ? Boolean(bankAccountParams.used_for_dividends) : undefined;

  await db.transaction(async (tx) => {
    if (usedForInvoices !== undefined) {
      if (usedForInvoices) {
        await tx
          .update(wiseRecipients)
          .set({ usedForInvoices: false })
          .where(and(eq(wiseRecipients.userId, BigInt(userId)), isNull(wiseRecipients.deletedAt)));
        await tx.update(wiseRecipients).set({ usedForInvoices: true }).where(eq(wiseRecipients.id, accountId));
      } else {
        await tx.update(wiseRecipients).set({ usedForInvoices: false }).where(eq(wiseRecipients.id, accountId));
      }
    }

    if (usedForDividends !== undefined) {
      if (usedForDividends) {
        await tx
          .update(wiseRecipients)
          .set({ usedForDividends: false })
          .where(and(eq(wiseRecipients.userId, BigInt(userId)), isNull(wiseRecipients.deletedAt)));
        await tx.update(wiseRecipients).set({ usedForDividends: true }).where(eq(wiseRecipients.id, accountId));
      } else {
        await tx.update(wiseRecipients).set({ usedForDividends: false }).where(eq(wiseRecipients.id, accountId));
      }
    }
  });

  return NextResponse.json({ success: true });
}
