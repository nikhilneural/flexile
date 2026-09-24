import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { userLeads } from "@/db/schema";

const leadSchema = z.object({
  email: z.string().email(),
});

export async function POST(req: Request) {
  const rawBody: unknown = await req.json().catch(() => ({}));
  const parseResult = leadSchema.safeParse(rawBody);
  if (!parseResult.success) {
    return NextResponse.json({ success: true }, { status: 200 });
  }

  try {
    await db.insert(userLeads).values({
      email: parseResult.data.email.toLowerCase(),
    });
    return NextResponse.json({ success: true }, { status: 201 });
  } catch {
    return NextResponse.json({ success: true }, { status: 200 });
  }
}
