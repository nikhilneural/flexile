import { Hono } from "hono";
import type { Env } from "@/env";

const ALLOWED_WEBHOOK_EVENTS = ["issues", "pull_request"];
const ALLOWED_WEBHOOK_ACTIONS = ["reopened", "closed", "edited"];

const githubWebhookRouter = new Hono<{ Bindings: Env }>();

/**
 * GitHub webhook handler with HMAC-SHA256 signature verification.
 * Handles push/PR/issue events that sync to the GitHub integration.
 */
githubWebhookRouter.post("/", async (c) => {
  const payload = await c.req.text();
  const signatureHeader = c.req.header("X-Hub-Signature-256");
  const event = c.req.header("X-GitHub-Event");
  const webhookId = c.req.header("X-GitHub-Hook-ID");
  const deliveryId = c.req.header("X-GitHub-Delivery");

  // Validate webhook signature
  if (!signatureHeader || !payload) {
    return c.body(null, 400);
  }

  const isValid = await verifyGithubSignature(signatureHeader, payload, c.env.GH_WEBHOOK_SECRET);
  if (!isValid) {
    return c.body(null, 400);
  }

  // Dismiss invalid webhook events
  if (!event || !ALLOWED_WEBHOOK_EVENTS.includes(event)) {
    return c.body(null, 200);
  }

  let parsedPayload: Record<string, unknown>;
  try {
    parsedPayload = JSON.parse(payload);
  } catch {
    return c.body(null, 400);
  }

  // Check if the action is one we handle
  const action = parsedPayload.action as string;
  if (!ALLOWED_WEBHOOK_ACTIONS.includes(action)) {
    return c.body(null, 200);
  }

  console.info(`GitHub webhook received: event=${event} delivery=${deliveryId}`);

  await c.env.QUEUE_JOBS.send({
    type: "github.event",
    payload: {
      webhookId,
      event,
      action,
      data: parsedPayload,
    },
  });

  return c.body(null, 200);
});

async function verifyGithubSignature(signature: string, body: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const expectedSignature = `sha256=${Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}`;

  // Constant-time comparison
  if (signature.length !== expectedSignature.length) return false;
  const a = encoder.encode(signature);
  const b = encoder.encode(expectedSignature);
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return result === 0;
}

export { githubWebhookRouter };
