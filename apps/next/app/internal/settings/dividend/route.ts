import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { resolveClerkUserId } from "@/trpc/auth";

const MAX_MINIMUM_DIVIDEND_PAYMENT_IN_CENTS = 100000;
const MIN_MINIMUM_DIVIDEND_PAYMENT_IN_CENTS = 0;

export async function GET(req: Request) {
  const ipAddress = req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0] ?? "";
  const userId = await resolveClerkUserId(ipAddress);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const user = await db.query.users.findFirst({
    where: eq(users.id, BigInt(userId)),
  });
  if (!user) return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });

  return NextResponse.json({
    minimum_dividend_payment_in_cents: Number(user.minimumDividendPaymentInCents),
    max_minimum_dividend_payment_in_cents: MAX_MINIMUM_DIVIDEND_PAYMENT_IN_CENTS,
    min_minimum_dividend_payment_in_cents: MIN_MINIMUM_DIVIDEND_PAYMENT_IN_CENTS,
  });
}

export async function PATCH(req: Request) {
  const ipAddress = req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0] ?? "";
  const userId = await resolveClerkUserId(ipAddress);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const userPayload = body.user && typeof body.user === "object" ? (body.user as Record<string, unknown>) : undefined;
  const rawVal = userPayload?.minimum_dividend_payment_in_cents ?? body.minimum_dividend_payment_in_cents;
  const amount = Number(rawVal);

  if (
    isNaN(amount) ||
    amount < MIN_MINIMUM_DIVIDEND_PAYMENT_IN_CENTS ||
    amount > MAX_MINIMUM_DIVIDEND_PAYMENT_IN_CENTS
  ) {
    return NextResponse.json(
      { success: false, error: "Minimum dividend payment amount must be between $0 and $1,000" },
      { status: 422 },
    );
  }

  await db
    .update(users)
    .set({
      minimumDividendPaymentInCents: BigInt(Math.round(amount)),
    })
    .where(eq(users.id, BigInt(userId)));

  return NextResponse.json({ success: true });
}
