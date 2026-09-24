import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { companies, companyAdministrators } from "@/db/schema";
import { resolveClerkUserId } from "@/trpc/auth";
import { findCompany } from "../../../invoices/helpers";

export async function GET(req: Request, { params }: { params: Promise<{ companyId: string }> }) {
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

  return NextResponse.json({
    company: {
      share_price_in_usd: company.sharePriceInUsd,
      fmv_per_share_in_usd: company.fmvPerShareInUsd,
    },
  });
}

const updateSchema = z.object({
  company: z
    .object({
      share_price_in_usd: z.union([z.string(), z.number()]).optional(),
      fmv_per_share_in_usd: z.union([z.string(), z.number()]).optional(),
    })
    .optional(),
  share_price_in_usd: z.union([z.string(), z.number()]).optional(),
  fmv_per_share_in_usd: z.union([z.string(), z.number()]).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ companyId: string }> }) {
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
  const parseResult = updateSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json({ success: false, error: "Invalid input" }, { status: 422 });
  }

  const data = parseResult.data;
  const sharePrice = data.company?.share_price_in_usd ?? data.share_price_in_usd;
  const fmvPrice = data.company?.fmv_per_share_in_usd ?? data.fmv_per_share_in_usd;

  await db
    .update(companies)
    .set({
      sharePriceInUsd: sharePrice != null ? String(sharePrice) : undefined,
      fmvPerShareInUsd: fmvPrice != null ? String(fmvPrice) : undefined,
    })
    .where(eq(companies.id, company.id));

  return NextResponse.json({ success: true });
}
