import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { resolveClerkUserId } from "@/trpc/auth";
import { getCurrentUserData } from "@/trpc/routes/users/currentUserData";
import { findCompany } from "../invoices/helpers";

const switchBodySchema = z.object({
  access_role: z.enum(["administrator", "worker", "lawyer", "investor"]).optional(),
});

type AccessRole = "administrator" | "worker" | "lawyer" | "investor";

export async function POST(req: Request, { params }: { params: Promise<{ companyId: string }> }) {
  const ipAddress = req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0] ?? "";
  const userId = await resolveClerkUserId(ipAddress);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { companyId } = await params;
  const company = await findCompany(companyId);
  if (!company) return NextResponse.json({ success: false, error: "Company not found" }, { status: 404 });

  const user = await db.query.users.findFirst({
    where: eq(users.id, BigInt(userId)),
  });
  if (!user) return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });

  const url = new URL(req.url);
  const rawBody: unknown = await req.json().catch(() => ({}));
  const parsedBody = switchBodySchema.safeParse(rawBody);
  const roleFromQuery = url.searchParams.get("access_role");
  const parsedQueryRole = switchBodySchema.shape.access_role.safeParse(roleFromQuery);
  const requestedRole: AccessRole | undefined =
    (parsedQueryRole.success ? parsedQueryRole.data : undefined) ??
    (parsedBody.success ? parsedBody.data.access_role : undefined);

  const cookieHeader = req.headers.get("cookie") ?? "";
  const accessRolesCookieName = `${user.externalId}_access_roles`;
  const accessRoles: Record<string, AccessRole> = {};

  const matchRoles = new RegExp(`${accessRolesCookieName}=([^;]+)`, "u").exec(cookieHeader);
  if (matchRoles?.[1]) {
    try {
      Object.assign(accessRoles, JSON.parse(decodeURIComponent(matchRoles[1])));
    } catch {
      // ignore JSON parse error
    }
  }

  if (requestedRole) {
    accessRoles[company.externalId] = requestedRole;
  }

  const userData = await getCurrentUserData(user.id, {
    selectedCompanyId: company.externalId,
    accessRoles,
  });

  if (!userData) {
    return NextResponse.json({ success: false, error: "Failed to load user data" }, { status: 500 });
  }

  const res = NextResponse.json(userData);
  res.cookies.set(`${user.externalId}_selected_company`, company.externalId, {
    path: "/",
    maxAge: 315360000,
  });
  res.cookies.set(`${user.externalId}_access_roles`, JSON.stringify(accessRoles), {
    path: "/",
    maxAge: 315360000,
  });

  return res;
}
