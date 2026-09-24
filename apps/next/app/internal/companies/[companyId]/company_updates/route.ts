import { and, desc, eq, isNotNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { companyAdministrators, companyContractors, companyInvestors, companyUpdates } from "@/db/schema";
import { resolveClerkUserId } from "@/trpc/auth";
import { findCompany } from "../invoices/helpers";

const updateInputSchema = z.object({
  company_update: z.object({
    title: z.string(),
    body: z.string(),
    video_url: z.string().optional().nullable(),
    period: z.enum(["month", "quarter", "year"]).optional().nullable(),
    period_started_on: z.string().optional().nullable(),
    show_revenue: z.boolean().optional(),
    show_net_income: z.boolean().optional(),
  }),
  publish: z.union([z.string(), z.boolean()]).optional(),
});

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function truncateText(text: string, length: number): string {
  if (text.length <= length) return text;
  return `${text.slice(0, length)}...`;
}

export async function GET(req: Request, { params }: { params: Promise<{ companyId: string }> }) {
  const ipAddress = req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0] ?? "";
  const userId = await resolveClerkUserId(ipAddress);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { companyId } = await params;
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

  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const limit = 10;
  const offset = (page - 1) * limit;

  const whereCondition = admin
    ? eq(companyUpdates.companyId, company.id)
    : and(eq(companyUpdates.companyId, company.id), isNotNull(companyUpdates.sentAt));

  const [allUpdates, countResult] = await Promise.all([
    db.query.companyUpdates.findMany({
      where: whereCondition,
      orderBy: desc(companyUpdates.createdAt),
      limit,
      offset,
    }),
    db.$count(companyUpdates, whereCondition),
  ]);

  const totalPages = Math.max(1, Math.ceil(countResult / limit));

  const updatesProps = allUpdates.map((update) => {
    if (admin) {
      return {
        id: update.externalId,
        title: update.title,
        sent_at: update.sentAt,
        status: update.sentAt ? "Sent" : "Draft",
      };
    }
    const plainText = stripHtml(update.body);
    return {
      id: update.externalId,
      title: update.title,
      summary: truncateText(plainText, 300),
    };
  });

  const pagy = {
    page,
    pages: totalPages,
    count: countResult,
    from: countResult === 0 ? 0 : offset + 1,
    to: Math.min(offset + limit, countResult),
    prev: page > 1 ? page - 1 : null,
    next: page < totalPages ? page + 1 : null,
  };

  return NextResponse.json({
    updates: updatesProps,
    pagy,
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ companyId: string }> }) {
  const ipAddress = req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0] ?? "";
  const userId = await resolveClerkUserId(ipAddress);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { companyId } = await params;
  const company = await findCompany(companyId);
  if (!company) return NextResponse.json({ success: false, error: "Company not found" }, { status: 404 });

  const admin = await db.query.companyAdministrators.findFirst({
    where: and(eq(companyAdministrators.companyId, company.id), eq(companyAdministrators.userId, BigInt(userId))),
  });
  if (!admin) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

  const body: unknown = await req.json().catch(() => ({}));
  const parseResult = updateInputSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json({ success: false, error: "Invalid parameters" }, { status: 422 });
  }

  const { company_update: data, publish } = parseResult.data;
  const isPublish = publish === true || publish === "true";
  const now = new Date();

  const [newUpdate] = await db
    .insert(companyUpdates)
    .values({
      companyId: company.id,
      title: data.title,
      body: data.body,
      videoUrl: data.video_url ?? null,
      period: data.period ?? null,
      periodStartedOn: data.period_started_on ?? null,
      showRevenue: data.show_revenue ?? false,
      showNetIncome: data.show_net_income ?? false,
      sentAt: isPublish ? now : null,
    })
    .returning();

  if (!newUpdate) {
    return NextResponse.json({ success: false, error: "Failed to create update" }, { status: 500 });
  }

  const presented = {
    id: newUpdate.externalId,
    title: newUpdate.title,
    body: newUpdate.body,
    period: newUpdate.period,
    period_started_on: newUpdate.periodStartedOn,
    sent_at: newUpdate.sentAt,
    status: newUpdate.sentAt ? "Sent" : "Draft",
    video_url: newUpdate.videoUrl,
    show_revenue: newUpdate.showRevenue,
    show_net_income: newUpdate.showNetIncome,
  };

  return NextResponse.json({ company_update: presented }, { status: 201 });
}
