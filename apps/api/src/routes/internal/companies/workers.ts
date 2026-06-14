import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { Env } from "@/env";

const workersRouter = new Hono<{ Bindings: Env }>();

const createWorkerSchema = z.object({
  contractor: z.object({
    email: z.string().email(),
    started_at: z.string(),
    pay_rate_type: z.string(),
    pay_rate_in_subunits: z.number(),
    role_id: z.string().optional(),
    on_trial: z.boolean().optional(),
    hours_per_week: z.number().optional(),
  }),
  application_id: z.string().optional(),
});

/** POST /internal/companies/:companyId/workers - Invite a new worker */
workersRouter.post("/", zValidator("json", createWorkerSchema), async (c) => {
  const body = c.req.valid("json");
  // Business logic: InviteWorker service
  return c.json({ success: true, new_user_id: null });
});

export { workersRouter };
