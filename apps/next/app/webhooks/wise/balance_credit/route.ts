import { NextResponse } from "next/server";
import { verifyWiseSignature } from "@/lib/webhooks/wise";

export async function POST(req: Request) {
  const isTest = req.headers.get("x-test-notification") === "true";
  const rawBody = await req.text();
  const signature = req.headers.get("x-signature-sha256");

  if (!isTest && !verifyWiseSignature(signature, rawBody)) {
    return NextResponse.json({ success: false }, { status: 400 });
  }

  if (isTest) {
    return NextResponse.json({ success: true, message: "Good check!" });
  }

  return NextResponse.json({ success: true });
}
