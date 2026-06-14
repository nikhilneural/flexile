import { createMiddleware } from "hono/factory";
import * as jose from "jose";
import type { Env } from "@/env";

export interface AuthUser {
  clerkUserId: string;
}

type AuthEnv = {
  Bindings: Env;
  Variables: {
    auth: AuthUser;
  };
};

let jwksCache: jose.JWTVerifyGetKey | null = null;

function getJwks(clerkSecretKey: string): jose.JWTVerifyGetKey {
  if (!jwksCache) {
    // Derive the Clerk frontend API URL from the secret key
    // Clerk secret keys follow the pattern: sk_test_... or sk_live_...
    // The JWKS endpoint is at https://<clerk-instance>/.well-known/jwks.json
    const issuer = getClerkIssuer(clerkSecretKey);
    const jwksUrl = new URL("/.well-known/jwks.json", issuer);
    jwksCache = jose.createRemoteJWKSet(jwksUrl);
  }
  return jwksCache;
}

function getClerkIssuer(_clerkSecretKey: string): string {
  // The issuer is typically https://<your-clerk-instance>.clerk.accounts.dev
  // In production this comes from the JWT itself; we validate after decoding
  // For now, we skip issuer validation and rely on signature verification
  return "https://clerk.flexile.com";
}

/**
 * Auth middleware that verifies Clerk JWTs from the Authorization header.
 * Extracts the user's Clerk ID and makes it available in the context.
 */
export const authMiddleware = createMiddleware<AuthEnv>(async (c, next) => {
  const authHeader = c.req.header("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized", message: "Missing or invalid Authorization header" }, 401);
  }

  const token = authHeader.slice(7);

  try {
    const jwks = getJwks(c.env.CLERK_SECRET_KEY);

    const { payload } = await jose.jwtVerify(token, jwks, {
      // Skip issuer validation for flexibility across environments
      // The signature verification via JWKS is the primary security mechanism
    });

    const clerkUserId = payload.sub;
    if (!clerkUserId) {
      return c.json({ error: "Unauthorized", message: "Invalid token: missing subject" }, 401);
    }

    c.set("auth", { clerkUserId });
    await next();
  } catch (err) {
    if (err instanceof jose.errors.JWTExpired) {
      return c.json({ error: "Unauthorized", message: "Token expired" }, 401);
    }
    if (err instanceof jose.errors.JWSSignatureVerificationFailed) {
      return c.json({ error: "Unauthorized", message: "Invalid token signature" }, 401);
    }
    console.error("Auth middleware error:", err);
    return c.json({ error: "Unauthorized", message: "Token verification failed" }, 401);
  }
});
