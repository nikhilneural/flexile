import { Hono } from "hono";
import type { Env } from "@/env";

const quickbooksWebhookRouter = new Hono<{ Bindings: Env }>();

/**
 * QuickBooks webhook handler with HMAC signature verification.
 * Processes event notifications for vendor merges, deletions, etc.
 */
quickbooksWebhookRouter.post("/", async (c) => {
  const payload = await c.req.text();
  const signatureHeader = c.req.header("intuit-signature");

  // Validate webhook signature
  if (!signatureHeader || !payload) {
    return c.body(null, 400);
  }

  const isValid = await verifyQuickbooksSignature(signatureHeader, payload, c.env.QUICKBOOKS_CLIENT_SECRET);
  if (!isValid) {
    return c.body(null, 400);
  }

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(payload);
  } catch {
    return c.body(null, 400);
  }

  const intuitTid = c.req.header("intuit-t-id");
  console.info(`QuickBooks webhook received: TID=${intuitTid}`);

  await c.env.QUEUE_JOBS.send({
    type: "quickbooks.event",
    payload: event,
  });

  return c.body(null, 200);
});

async function verifyQuickbooksSignature(signature: string, body: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const expectedSignature = btoa(String.fromCharCode(...new Uint8Array(sig)));

  // Constant-time comparison
  if (signature.trim().length !== expectedSignature.trim().length) return false;
  const a = encoder.encode(signature.trim());
  const b = encoder.encode(expectedSignature.trim());
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return result === 0;
}

export { quickbooksWebhookRouter };
