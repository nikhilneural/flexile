import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { Env } from "@/env";
import { authMiddleware } from "@/middleware/auth";

const companyInvitationsRouter = new Hono<{ Bindings: Env }>();

companyInvitationsRouter.use("*", authMiddleware);

const createSchema = z.object({
  company_administrator: z.object({
    email: z.string().email(),
  }),
  company: z.object({
    name: z.string().min(1),
  }),
  company_role: z.object({
    name: z.string().min(1),
  }),
  company_role_rate: z.object({
    pay_rate_in_subunits: z.number(),
    pay_rate_type: z.string(),
  }),
  company_worker: z.object({
    started_at: z.string(),
    pay_rate_in_subunits: z.number(),
    pay_rate_type: z.string(),
    hours_per_week: z.number().optional(),
  }),
});

/** POST /internal/company-invitations - Invite a company */
companyInvitationsRouter.post("/", zValidator("json", createSchema), async (c) => {
  const body = c.req.valid("json");
  // Business logic: InviteCompany service
  return c.json(
    {
      success: true,
      new_user_id: null,
      administrator_id: null,
    },
    201,
  );
});

export { companyInvitationsRouter };
