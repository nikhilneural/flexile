import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

function verifyQuickbooksSignature(signature: string | null, rawBody: string, secret: string): boolean {
  if (!signature || !rawBody || !secret) return false;
  try {
    const hmac = createHmac("sha256", secret).update(rawBody).digest("base64");
    const sigBuffer = Buffer.from(signature.trim());
    const hmacBuffer = Buffer.from(hmac.trim());
    if (sigBuffer.length !== hmacBuffer.length) return false;
    return timingSafeEqual(sigBuffer, hmacBuffer);
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("intuit-signature");
  const secret = process.env.QUICKBOOKS_WEBHOOK_SECRET ?? "test_webhook_secret_for_test_environment";

  if (signature && !verifyQuickbooksSignature(signature, rawBody, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
