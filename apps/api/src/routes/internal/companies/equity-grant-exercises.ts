import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { Env } from "@/env";

const equityGrantExercisesRouter = new Hono<{ Bindings: Env }>();

const createSchema = z.object({
  equity_grants: z.array(
    z.object({
      id: z.string(),
      number_of_options: z.number(),
    }),
  ),
  submission_id: z.string().optional(),
});

/** POST /internal/companies/:companyId/equity-grant-exercises - Create exercise request */
equityGrantExercisesRouter.post("/", zValidator("json", createSchema), async (c) => {
  const body = c.req.valid("json");
  // Business logic: EquityExercisingService.create_request
  return c.json({ id: null });
});

/** POST /internal/companies/:companyId/equity-grant-exercises/:id/resend - Resend payment instructions */
equityGrantExercisesRouter.post("/:id/resend", async (c) => {
  const exerciseId = c.req.param("id");
  // Business logic: send CompanyInvestorMailer.stock_exercise_payment_instructions
  return c.body(null, 200);
});

export { equityGrantExercisesRouter };
