import { NextResponse } from "next/server";
import { getEffectiveCurrentUser } from "@/trpc/routes/users/demoUser";

export async function GET(req: Request) {
  const user = await getEffectiveCurrentUser(req);
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(user);
}
