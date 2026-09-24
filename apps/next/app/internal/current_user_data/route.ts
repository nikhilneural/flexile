import { NextResponse } from "next/server";
import { getCurrentUserDataFromRequest } from "@/trpc/routes/users/currentUserData";

export async function GET(req: Request) {
  const user = await getCurrentUserDataFromRequest(req);
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(user);
}
