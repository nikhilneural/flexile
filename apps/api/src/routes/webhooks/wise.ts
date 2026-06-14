import { Hono } from "hono";
import type { Env } from "@/env";

/**
 * Wise uses RSA signature verification with their public key.
 * Production and sandbox use different keys.
 */
const WISE_PRODUCTION_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAvO8vXV+JksBzZAY6GhSO
XdoTCfhXaaiZ+qAbtaDBiu2AGkGVpmEygFmWP4Li9m5+Ni85BhVvZOodM9epgW3F
bA5Q1SexvAF1PPjX4JpMstak/QhAgl1qMSqEevL8cmUeTgcMuVWCJmlge9h7B1CS
D4rtlimGZozG39rUBDg6Qt2K+P4wBfLblL0k4C4YUdLnpGYEDIth+i8XsRpFlogx
CAFyH9+knYsDbR43UJ9shtc42Ybd40Afihj8KnYKXzchyQ42aC8aZ/h5hyZ28yVy
Oj3Vos0VdBIs/gAyJ/4yyQFCXYte64I7ssrlbGRaco4nKF3HmaNhxwyKyJafz19e
HwIDAQAB
-----END PUBLIC KEY-----`;

const WISE_SANDBOX_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwpb91cEYuyJNQepZAVfP
ZIlPZfNUefH+n6w9SW3fykqKu938cR7WadQv87oF2VuT+fDt7kqeRziTmPSUhqPU
ys/V2Q1rlfJuXbE+Gga37t7zwd0egQ+KyOEHQOpcTwKmtZ81ieGHynAQzsn1We3j
wt760MsCPJ7GMT141ByQM+yW1Bx+4SG3IGjXWyqOWrcXsxAvIXkpUD/jK/L958Cg
nZEgz0BSEh0QxYLITnW1lLokSx/dTianWPFEhMC9BgijempgNXHNfcVirg1lPSyg
z7KqoKUN0oHqWLr2U1A+7kqrl6O2nx3CKs1bj1hToT1+p4kcMoHXA7kA+VBLUpEs
VwIDAQAB
-----END PUBLIC KEY-----`;

const wiseWebhookRouter = new Hono<{ Bindings: Env }>();

/**
 * Wise transfer state change webhook handler with RSA signature verification.
 */
wiseWebhookRouter.post("/transfer-state-change", async (c) => {
  const payload = await c.req.text();
  const signatureHeader = c.req.header("X-Signature-SHA256");
  const isTestNotification = c.req.header("X-Test-Notification");

  if (!signatureHeader || !payload) {
    return c.json({ success: false }, 400);
  }

  const isValid = await verifyWiseSignature(signatureHeader, payload, c.env.ENVIRONMENT);
  if (!isValid) {
    return c.json({ success: false }, 400);
  }

  if (isTestNotification === "true") {
    return c.json({ success: true, message: "Good check!" });
  }

  const params = JSON.parse(payload);
  await c.env.QUEUE_JOBS.send({
    type: "wise.transfer-state-change",
    payload: params,
  });

  return c.json({ success: true });
});

/**
 * Wise balance credit webhook handler with RSA signature verification.
 */
wiseWebhookRouter.post("/balance-credit", async (c) => {
  const payload = await c.req.text();
  const signatureHeader = c.req.header("X-Signature-SHA256");
  const isTestNotification = c.req.header("X-Test-Notification");

  if (!signatureHeader || !payload) {
    return c.json({ success: false }, 400);
  }

  const isValid = await verifyWiseSignature(signatureHeader, payload, c.env.ENVIRONMENT);
  if (!isValid) {
    return c.json({ success: false }, 400);
  }

  if (isTestNotification === "true") {
    return c.json({ success: true, message: "Good check!" });
  }

  const params = JSON.parse(payload);
  await c.env.QUEUE_JOBS.send({
    type: "wise.balance-credit",
    payload: params,
  });

  return c.json({ success: true });
});

async function verifyWiseSignature(signature: string, body: string, environment: string): Promise<boolean> {
  try {
    const publicKeyPem = environment === "production" ? WISE_PRODUCTION_PUBLIC_KEY : WISE_SANDBOX_PUBLIC_KEY;
    const pemContents = publicKeyPem.replace(/-----BEGIN PUBLIC KEY-----/, "").replace(/-----END PUBLIC KEY-----/, "").replace(/\n/g, "");
    const binaryDer = Uint8Array.from(atob(pemContents), (ch: string) => ch.charCodeAt(0));

    const publicKey = await crypto.subtle.importKey(
      "spki",
      binaryDer,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );

    const decodedSignature = Uint8Array.from(atob(signature), (ch: string) => ch.charCodeAt(0));
    const encoder = new TextEncoder();

    return await crypto.subtle.verify("RSASSA-PKCS1-v1_5", publicKey, decodedSignature, encoder.encode(body));
  } catch (err) {
    console.error("Wise signature verification failed:", err);
    return false;
  }
}

export { wiseWebhookRouter };
