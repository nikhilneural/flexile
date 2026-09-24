import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { companyAdministrators, companyLawyers, users } from "@/db/schema";
import { resolveClerkUserId } from "@/trpc/auth";
import { findCompany } from "../invoices/helpers";

const lawyerSchema = z.object({
  email: z.string().email(),
});

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
  const parseResult = lawyerSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json({ success: false, error: "Invalid email" }, { status: 422 });
  }

  const email = parseResult.data.email.toLowerCase();

  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (existingUser) {
    const existingLawyer = await db.query.companyLawyers.findFirst({
      where: and(eq(companyLawyers.companyId, company.id), eq(companyLawyers.userId, existingUser.id)),
    });
    if (existingLawyer) {
      return NextResponse.json(
        { success: false, field: "email", error_message: "Email has already been taken" },
        { status: 422 },
      );
    }
    await db.insert(companyLawyers).values({
      companyId: company.id,
      userId: existingUser.id,
    });
    return NextResponse.json({ success: true });
  }

  const [newUser] = await db
    .insert(users)
    .values({
      email,
    })
    .returning();

  if (!newUser) {
    return NextResponse.json({ success: false, error_message: "Failed to create user" }, { status: 500 });
  }

  await db.insert(companyLawyers).values({
    companyId: company.id,
    userId: newUser.id,
  });

  return NextResponse.json({ success: true });
}
