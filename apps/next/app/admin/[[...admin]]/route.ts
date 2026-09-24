import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { resolveClerkUserId } from "@/trpc/auth";

export async function GET(req: Request) {
  const ipAddress = req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0] ?? "";
  const userId = await resolveClerkUserId(ipAddress);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const user = await db.query.users.findFirst({
    where: eq(users.id, BigInt(userId)),
  });

  if (!user?.teamMember) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    success: true,
    message: "Admin console",
    user: {
      id: Number(user.id),
      email: user.email,
      teamMember: user.teamMember,
    },
  });
}

export async function POST(req: Request) {
  return GET(req);
}

export async function PATCH(req: Request) {
  return GET(req);
}

export async function DELETE(req: Request) {
  return GET(req);
}
