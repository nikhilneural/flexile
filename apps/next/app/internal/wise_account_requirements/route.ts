import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveClerkUserId } from "@/trpc/auth";

const wiseReqSchema = z.object({
  wise_account_requirement: z.object({
    source: z.string(),
    target: z.string(),
    source_amount: z.union([z.number(), z.string()]).optional(),
    type: z.string().optional().nullable(),
    details: z.record(z.unknown()).optional(),
  }),
});

export async function POST(req: Request) {
  const ipAddress = req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0] ?? "";
  const userId = await resolveClerkUserId(ipAddress);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const rawBody: unknown = await req.json().catch(() => ({}));
  const parseResult = wiseReqSchema.safeParse(rawBody);
  if (!parseResult.success) {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 422 });
  }

  const { wise_account_requirement: data } = parseResult.data;

  const wiseBaseUrl =
    process.env.WISE_API_URL ||
    (process.env.NODE_ENV === "production" ? "https://api.transferwise.com" : "https://api.sandbox.transferwise.tech");

  const queryParams = new URLSearchParams({
    source: data.source,
    target: data.target,
    ...(data.source_amount != null ? { sourceAmount: String(data.source_amount) } : {}),
  });

  try {
    const wiseResponse = await fetch(`${wiseBaseUrl}/v1/account-requirements?${queryParams.toString()}`, {
      method: "POST",
      headers: {
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Minor-Version": "1",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: data.type ?? null,
        details: data.details ?? {},
      }),
    });

    const bodyData: unknown = await wiseResponse.json().catch(() => ({}));
    return NextResponse.json(bodyData, { status: wiseResponse.status });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to fetch Wise account requirements";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
