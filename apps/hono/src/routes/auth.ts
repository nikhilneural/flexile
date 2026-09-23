import { Hono } from "hono";
import { setCookie, deleteCookie } from "hono/cookie";
import type { AppEnv } from "../types";
import { verifyPassword, signJwt, hashPassword } from "../lib/auth";
import { requireAuth } from "../lib/middleware";
import { externalId } from "../lib/ids";

const auth = new Hono<AppEnv>();

// POST /api/auth/login
auth.post("/login", async (c) => {
  const body = await c.req.json<{ email?: string; password?: string }>().catch(() => ({}));
  const { email, password } = body;
  if (!email || !password) return c.json({ error: "Email and password are required" }, 400);

  const user = await c.env.DB.prepare(
    "SELECT id, external_id, email, password_hash, legal_name FROM users WHERE email = ?",
  )
    .bind(email.toLowerCase())
    .first<{ id: number; external_id: string; email: string; password_hash: string; legal_name: string | null }>();

  if (!user || !user.password_hash || !(await verifyPassword(password, user.password_hash))) {
    return c.json({ error: "Invalid email or password" }, 401);
  }

  const token = await signJwt({ sub: user.id, email: user.email }, c.env.JWT_SECRET);
  setCookie(c, "flexile_session", token, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return c.json({
    token,
    user: { id: user.id, externalId: user.external_id, email: user.email, legalName: user.legal_name },
  });
});

// POST /api/auth/signup
auth.post("/signup", async (c) => {
  const body = await c.req.json<{ email?: string; password?: string; legalName?: string }>().catch(() => ({}));
  const { email, password, legalName } = body;
  if (!email || !password) return c.json({ error: "Email and password are required" }, 400);

  const existing = await c.env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email.toLowerCase()).first();
  if (existing) return c.json({ error: "Email already registered" }, 409);

  const hash = await hashPassword(password);
  const extId = externalId("usr");
  const result = await c.env.DB.prepare(
    "INSERT INTO users (external_id, email, password_hash, legal_name) VALUES (?, ?, ?, ?)",
  )
    .bind(extId, email.toLowerCase(), hash, legalName ?? null)
    .run();

  const id = result.meta.last_row_id;
  const token = await signJwt({ sub: id, email: email.toLowerCase() }, c.env.JWT_SECRET);
  setCookie(c, "flexile_session", token, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return c.json({ token, user: { id, externalId: extId, email: email.toLowerCase(), legalName: legalName ?? null } }, 201);
});

// POST /api/auth/logout
auth.post("/logout", (c) => {
  deleteCookie(c, "flexile_session", { path: "/" });
  return c.json({ ok: true });
});

// GET /api/auth/me
auth.get("/me", requireAuth, (c) => {
  return c.json({ user: c.get("user") });
});

export default auth;
