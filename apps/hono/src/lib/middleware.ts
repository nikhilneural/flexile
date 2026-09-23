import type { MiddlewareHandler } from "hono";
import { getCookie } from "hono/cookie";
import type { AppEnv } from "../types";
import { verifyJwt } from "./auth";

// Reads JWT from the `flexile_session` cookie or Authorization: Bearer header,
// loads the user from D1, and attaches it to the context. Returns 401 if absent.
export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const cookieToken = getCookie(c, "flexile_session");
  const authHeader = c.req.header("Authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
  const token = cookieToken || bearer;

  if (!token) return c.json({ error: "Unauthorized" }, 401);

  const payload = await verifyJwt(token, c.env.JWT_SECRET);
  if (!payload) return c.json({ error: "Invalid or expired session" }, 401);

  const user = await c.env.DB.prepare(
    "SELECT id, external_id, email, legal_name FROM users WHERE id = ?",
  )
    .bind(payload.sub)
    .first<{ id: number; external_id: string; email: string; legal_name: string | null }>();

  if (!user) return c.json({ error: "User not found" }, 401);

  c.set("user", {
    id: user.id,
    externalId: user.external_id,
    email: user.email,
    legalName: user.legal_name,
  });

  await next();
};
