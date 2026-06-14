import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { Env } from "@/env";

const wiseAccountRequirementsRouter = new Hono<{ Bindings: Env }>();

const createSchema = z.object({
  wise_account_requirement: z.object({
    source: z.string(),
    source_amount: z.number(),
    target: z.string(),
    type: z.string(),
    details: z.record(z.unknown()).optional(),
  }),
});

/** POST /internal/wise-account-requirements - Fetch Wise account requirements */
wiseAccountRequirementsRouter.post("/", zValidator("json", createSchema), async (c) => {
  const { wise_account_requirement: params } = c.req.valid("json");
  // Business logic: Wise::PayoutApi.account_requirements call
  // Returns the Wise API response directly
  return c.json({
    type: params.type,
    fields: [],
  });
});

export { wiseAccountRequirementsRouter };
