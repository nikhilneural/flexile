import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { Env } from "@/env";

const lawyersRouter = new Hono<{ Bindings: Env }>();

const createSchema = z.object({
  email: z.string().email(),
});

/** POST /internal/companies/:companyId/lawyers - Invite a lawyer */
lawyersRouter.post("/", zValidator("json", createSchema), async (c) => {
  const { email } = c.req.valid("json");
  // Business logic: InviteLawyer service
  return c.json({ success: true });
});

export { lawyersRouter };
