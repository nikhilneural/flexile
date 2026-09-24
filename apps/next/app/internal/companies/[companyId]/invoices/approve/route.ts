import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { companyAdministrators, invoiceApprovals, invoices } from "@/db/schema";
import { resolveClerkUserId } from "@/trpc/auth";
import { findCompany } from "../helpers";

const approveSchema = z.object({
  approve_ids: z.array(z.string()).optional(),
  pay_ids: z.array(z.string()).optional(),
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
  const parseResult = approveSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json({ success: false, error_message: "Invalid input" }, { status: 422 });
  }

  const { approve_ids = [], pay_ids = [] } = parseResult.data;
  const allIds = Array.from(new Set([...approve_ids, ...pay_ids]));

  if (allIds.length === 0) {
    return NextResponse.json({ success: true });
  }

  await db.transaction(async (tx) => {
    for (const externalId of allIds) {
      const invoice = await tx.query.invoices.findFirst({
        where: and(eq(invoices.companyId, company.id), eq(invoices.externalId, externalId)),
      });
      if (!invoice) continue;

      const existingApproval = await tx.query.invoiceApprovals.findFirst({
        where: and(eq(invoiceApprovals.invoiceId, invoice.id), eq(invoiceApprovals.approverId, BigInt(userId))),
      });

      if (!existingApproval) {
        await tx.insert(invoiceApprovals).values({
          invoiceId: invoice.id,
          approverId: BigInt(userId),
          approvedAt: new Date(),
        });
        await tx
          .update(invoices)
          .set({
            invoiceApprovalsCount: invoice.invoiceApprovalsCount + 1,
            status: "approved",
          })
          .where(eq(invoices.id, invoice.id));
      } else {
        await tx.update(invoices).set({ status: "approved" }).where(eq(invoices.id, invoice.id));
      }
    }
  });

  return NextResponse.json({ success: true });
}
