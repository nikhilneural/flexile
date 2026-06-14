import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { Env } from "@/env";

const switchRouter = new Hono<{ Bindings: Env }>();

const switchSchema = z.object({
  access_role: z.string(),
});

/** POST /internal/companies/:companyId/switch - Switch access role within company */
switchRouter.post("/", zValidator("json", switchSchema), async (c) => {
  const { access_role } = c.req.valid("json");
  // Business logic: switch_role, return logged_in_user data
  return c.json({ user: {}, access_role });
});

export { switchRouter };
