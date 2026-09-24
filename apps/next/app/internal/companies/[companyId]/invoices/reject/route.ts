import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { companyAdministrators, invoices } from "@/db/schema";
import { resolveClerkUserId } from "@/trpc/auth";
import { findCompany } from "../helpers";

const rejectSchema = z.object({
  ids: z.array(z.string()),
  reason: z.string().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ companyId: string }> }) {
  const ipAddress = req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0] ?? "";
  const userId = await resolveClerkUserId(ipAddress);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { companyId } = await params;
  const company = await findCompany(companyId);
  if (!company) return NextResponse.json({ success: false, error_message: "Company not found" }, { status: 404 });

  const admin = await db.query.companyAdministrators.findFirst({
    where: and(eq(companyAdministrators.companyId, company.id), eq(companyAdministrators.userId, BigInt(userId))),
  });
  if (!admin) return NextResponse.json({ success: false, error_message: "Forbidden" }, { status: 403 });

  const body: unknown = await req.json().catch(() => ({}));
  const parseResult = rejectSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json({ success: false, error_message: "Invalid input" }, { status: 422 });
  }

  const { ids, reason } = parseResult.data;

  await db.transaction(async (tx) => {
    for (const externalId of ids) {
      await tx
        .update(invoices)
        .set({
          status: "rejected",
          rejectedById: BigInt(userId),
          rejectionReason: reason || null,
          rejectedAt: new Date(),
        })
        .where(and(eq(invoices.companyId, company.id), eq(invoices.externalId, externalId)));
    }
  });

  return NextResponse.json({ success: true });
}
