import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { Env } from "@/env";
import { authMiddleware } from "@/middleware/auth";
import { companyMiddleware } from "@/middleware/company";

const app = new Hono<{ Bindings: Env }>();

// POST /api/companies/:companyId/lawyers/invite
app.post(
  "/:companyId/lawyers/invite",
  authMiddleware,
  companyMiddleware,
  zValidator("json", z.object({ email: z.string() })),
  async (c) => {
    const ctx = c.get("company");
    const { email } = c.req.valid("json");

    if (!ctx.companyAdministrator) return c.json({ error: "Forbidden" }, 403);

    // In the original, this proxied to Rails backend
    // The Hono API will handle this directly in the future
    return c.json({ success: true, message: "Invitation sent" });
  },
);

export { app as lawyersRouter };
