import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

function verifyGithubSignature(signature: string | null, rawBody: string, secret: string): boolean {
  if (!signature || !rawBody || !secret) return false;
  try {
    const expected = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
    const sigBuffer = Buffer.from(signature.trim());
    const expectedBuffer = Buffer.from(expected);
    if (sigBuffer.length !== expectedBuffer.length) return false;
    return timingSafeEqual(sigBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature-256");
  const secret = process.env.GITHUB_WEBHOOK_SECRET ?? process.env.GH_WEBHOOK_SECRET ?? "";

  if (secret && signature && !verifyGithubSignature(signature, rawBody, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
