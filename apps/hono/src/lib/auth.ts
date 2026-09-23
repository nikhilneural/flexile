// Auth helpers built on the Web Crypto API (works in Cloudflare Workers).
// Password hashing uses SHA-256 with a static app salt (demo-grade; in
// production this would be bcrypt/scrypt via a Worker-compatible lib).
// Sessions use a signed JWT (HS256).

const SALT = "flexile-static-salt";
const encoder = new TextEncoder();

function bufToHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function base64url(input: ArrayBuffer | string): string {
  let bytes: Uint8Array;
  if (typeof input === "string") {
    bytes = encoder.encode(input);
  } else {
    bytes = new Uint8Array(input);
  }
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlToString(input: string): string {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return atob(b64);
}

export async function hashPassword(password: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(SALT + password));
  return bufToHex(digest);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const computed = await hashPassword(password);
  // constant-ish time compare
  if (computed.length !== hash.length) return false;
  let diff = 0;
  for (let i = 0; i < computed.length; i++) diff |= computed.charCodeAt(i) ^ hash.charCodeAt(i);
  return diff === 0;
}

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

export type JwtPayload = {
  sub: number;
  email: string;
  exp: number;
};

export async function signJwt(payload: Omit<JwtPayload, "exp">, secret: string, ttlSeconds = 60 * 60 * 24 * 7): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const fullPayload: JwtPayload = { ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds };
  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(fullPayload));
  const data = `${headerB64}.${payloadB64}`;
  const key = await importKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return `${data}.${base64url(sig)}`;
}

export async function verifyJwt(token: string, secret: string): Promise<JwtPayload | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, sigB64] = parts;
  const data = `${headerB64}.${payloadB64}`;
  const key = await importKey(secret);
  const expectedSig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  if (base64url(expectedSig) !== sigB64) return null;
  try {
    const payload = JSON.parse(base64urlToString(payloadB64)) as JwtPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
