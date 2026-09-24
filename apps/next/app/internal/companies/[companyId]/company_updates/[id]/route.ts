import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { companyAdministrators, companyContractors, companyInvestors, companyUpdates } from "@/db/schema";
import { resolveClerkUserId } from "@/trpc/auth";
import { findCompany } from "../../invoices/helpers";
import { presentCompanyUpdate } from "../helpers";

const updateSchema = z.object({
  company_update: z.object({
    title: z.string().optional(),
    body: z.string().optional(),
    video_url: z.string().optional().nullable(),
    period: z.enum(["month", "quarter", "year"]).optional().nullable(),
    period_started_on: z.string().optional().nullable(),
    show_revenue: z.boolean().optional(),
    show_net_income: z.boolean().optional(),
  }),
  publish: z.union([z.string(), z.boolean()]).optional(),
});

export async function GET(req: Request, { params }: { params: Promise<{ companyId: string; id: string }> }) {
  const ipAddress = req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0] ?? "";
  const userId = await resolveClerkUserId(ipAddress);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { companyId, id } = await params;
  const company = await findCompany(companyId);
  if (!company) return NextResponse.json({ success: false, error: "Company not found" }, { status: 404 });

  const userBigInt = BigInt(userId);
  const [admin, contractor, investor] = await Promise.all([
    db.query.companyAdministrators.findFirst({
      where: and(eq(companyAdministrators.companyId, company.id), eq(companyAdministrators.userId, userBigInt)),
    }),
    db.query.companyContractors.findFirst({
      where: and(eq(companyContractors.companyId, company.id), eq(companyContractors.userId, userBigInt)),
    }),
    db.query.companyInvestors.findFirst({
      where: and(eq(companyInvestors.companyId, company.id), eq(companyInvestors.userId, userBigInt)),
    }),
  ]);

  if (!admin && !contractor && !investor) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const update = await db.query.companyUpdates.findFirst({
    where: and(eq(companyUpdates.companyId, company.id), eq(companyUpdates.externalId, id)),
  });
  if (!update) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

  const primaryAdmin = await db.query.companyAdministrators.findFirst({
    where: eq(companyAdministrators.companyId, company.id),
    orderBy: asc(companyAdministrators.id),
    with: { user: true },
  });
  const adminName = primaryAdmin?.user.legalName || primaryAdmin?.user.preferredName || "Administrator";

  return NextResponse.json(presentCompanyUpdate(update, adminName));
}

export async function PATCH(req: Request, { params }: { params: Promise<{ companyId: string; id: string }> }) {
  const ipAddress = req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0] ?? "";
  const userId = await resolveClerkUserId(ipAddress);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { companyId, id } = await params;
  const company = await findCompany(companyId);
  if (!company) return NextResponse.json({ success: false, error: "Company not found" }, { status: 404 });

  const admin = await db.query.companyAdministrators.findFirst({
    where: and(eq(companyAdministrators.companyId, company.id), eq(companyAdministrators.userId, BigInt(userId))),
  });
  if (!admin) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

  const existingUpdate = await db.query.companyUpdates.findFirst({
    where: and(eq(companyUpdates.companyId, company.id), eq(companyUpdates.externalId, id)),
  });
  if (!existingUpdate) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

  const body: unknown = await req.json().catch(() => ({}));
  const parseResult = updateSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json({ success: false, error: "Invalid parameters" }, { status: 422 });
  }

  const { company_update: data, publish } = parseResult.data;
  const isPublish = publish === true || publish === "true";

  const updatePayload: Partial<typeof companyUpdates.$inferInsert> = {
    ...(data.title !== undefined ? { title: data.title } : {}),
    ...(data.body !== undefined ? { body: data.body } : {}),
    ...(data.video_url !== undefined ? { videoUrl: data.video_url } : {}),
    ...(data.period !== undefined ? { period: data.period } : {}),
    ...(data.period_started_on !== undefined ? { periodStartedOn: data.period_started_on } : {}),
    ...(data.show_revenue !== undefined ? { showRevenue: data.show_revenue } : {}),
    ...(data.show_net_income !== undefined ? { showNetIncome: data.show_net_income } : {}),
    ...(isPublish && !existingUpdate.sentAt ? { sentAt: new Date() } : {}),
  };

  const [updated] = await db
    .update(companyUpdates)
    .set(updatePayload)
    .where(eq(companyUpdates.id, existingUpdate.id))
    .returning();

  if (!updated) {
    return NextResponse.json({ success: false, error: "Failed to update" }, { status: 500 });
  }

  const primaryAdmin = await db.query.companyAdministrators.findFirst({
    where: eq(companyAdministrators.companyId, company.id),
    orderBy: asc(companyAdministrators.id),
    with: { user: true },
  });
  const adminName = primaryAdmin?.user.legalName || primaryAdmin?.user.preferredName || "Administrator";

  return NextResponse.json({ company_update: presentCompanyUpdate(updated, adminName) });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ companyId: string; id: string }> }) {
  const ipAddress = req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0] ?? "";
  const userId = await resolveClerkUserId(ipAddress);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { companyId, id } = await params;
  const company = await findCompany(companyId);
  if (!company) return NextResponse.json({ success: false, error: "Company not found" }, { status: 404 });

  const admin = await db.query.companyAdministrators.findFirst({
    where: and(eq(companyAdministrators.companyId, company.id), eq(companyAdministrators.userId, BigInt(userId))),
  });
  if (!admin) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

  const deleted = await db
    .delete(companyUpdates)
    .where(and(eq(companyUpdates.companyId, company.id), eq(companyUpdates.externalId, id)))
    .returning();

  if (deleted.length === 0) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
