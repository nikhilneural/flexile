import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { Env } from "@/env";

const adminEquityGrantsRouter = new Hono<{ Bindings: Env }>();

const createSchema = z.object({
  equity_grant: z.object({
    company_worker_id: z.string(),
    option_pool_id: z.string(),
    number_of_shares: z.number(),
    issue_date_relationship: z.string().optional(),
    option_grant_type: z.string().optional(),
    option_expiry_months: z.number().optional(),
    vesting_trigger: z.string().optional(),
    voluntary_termination_exercise_months: z.number().optional(),
    involuntary_termination_exercise_months: z.number().optional(),
    termination_with_cause_exercise_months: z.number().optional(),
    death_exercise_months: z.number().optional(),
    disability_exercise_months: z.number().optional(),
    retirement_exercise_months: z.number().optional(),
    board_approval_date: z.string().optional(),
    vesting_commencement_date: z.string().optional(),
    docuseal_submission_id: z.string().optional(),
    vesting_schedule_id: z.string().optional(),
    total_vesting_duration_months: z.number().optional(),
    cliff_duration_months: z.number().optional(),
    vesting_frequency_months: z.number().optional(),
  }),
});

/** POST /internal/companies/:companyId/administrator/equity-grants - Grant stock options */
adminEquityGrantsRouter.post("/", zValidator("json", createSchema), async (c) => {
  const body = c.req.valid("json");
  // Business logic: GrantStockOptions service
  return c.json({ document_id: null });
});

export { adminEquityGrantsRouter };
