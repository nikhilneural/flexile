import { Hono } from "hono";
import type { Env } from "@/env";

const equityExercisePaymentsRouter = new Hono<{ Bindings: Env }>();

/** PUT /internal/companies/:companyId/equity-exercise-payments/:id - Process an equity exercise payment */
equityExercisePaymentsRouter.put("/:id", async (c) => {
  const exerciseId = c.req.param("id");
  // Business logic: EquityExercisingService.process
  return c.body(null, 200);
});

export { equityExercisePaymentsRouter };
