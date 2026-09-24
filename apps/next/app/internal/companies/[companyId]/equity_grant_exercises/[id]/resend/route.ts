import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { companyInvestors, equityGrantExercises } from "@/db/schema";
import { resolveClerkUserId } from "@/trpc/auth";
import { findCompany } from "../../../invoices/helpers";

export async function POST(req: Request, { params }: { params: Promise<{ companyId: string; id: string }> }) {
  const ipAddress = req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0] ?? "";
  const userId = await resolveClerkUserId(ipAddress);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { companyId, id } = await params;
  const company = await findCompany(companyId);
  if (!company) return NextResponse.json({ success: false, error: "Company not found" }, { status: 404 });

  const investor = await db.query.companyInvestors.findFirst({
    where: and(eq(companyInvestors.companyId, company.id), eq(companyInvestors.userId, BigInt(userId))),
  });
  if (!investor) return NextResponse.json({ success: false, error: "Investor not found" }, { status: 403 });

  const exercise = await db.query.equityGrantExercises.findFirst({
    where: and(eq(equityGrantExercises.id, BigInt(id)), eq(equityGrantExercises.companyInvestorId, investor.id)),
  });
  if (!exercise) return NextResponse.json({ success: false, error: "Exercise not found" }, { status: 404 });

  // Payment instructions email or notification
  return NextResponse.json({ success: true });
}
