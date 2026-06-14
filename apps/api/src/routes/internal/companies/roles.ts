import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { Env } from "@/env";

const companyRolesRouter = new Hono<{ Bindings: Env }>();

/** GET /internal/companies/:companyId/roles - List company roles */
companyRolesRouter.get("/", async (c) => {
  // Business logic: CompanyRolePresenter.index_props
  return c.json({ roles: [] });
});

const createRoleSchema = z.object({
  role: z.object({
    name: z.string().min(1),
    capitalized_expense: z.boolean().optional(),
    actively_hiring: z.boolean().optional(),
    trial_enabled: z.boolean().optional(),
    job_description: z.string().optional(),
    expense_account_id: z.string().optional(),
    expense_card_enabled: z.boolean().optional(),
    expense_card_spending_limit_cents: z.number().optional(),
    pay_rate_in_subunits: z.number().optional(),
    trial_pay_rate_in_subunits: z.number().optional(),
    pay_rate_type: z.string().optional(),
  }),
});

/** POST /internal/companies/:companyId/roles - Create a company role */
companyRolesRouter.post("/", zValidator("json", createRoleSchema), async (c) => {
  const { role } = c.req.valid("json");
  // Business logic: create role with associated rate
  return c.json({ id: null });
});

/** PUT /internal/companies/:companyId/roles/:id - Update a company role */
companyRolesRouter.put("/:id", zValidator("json", createRoleSchema), async (c) => {
  const roleId = c.req.param("id");
  // Business logic: UpdateCompanyRoleService
  return c.body(null, 204);
});

/** DELETE /internal/companies/:companyId/roles/:id - Delete a company role */
companyRolesRouter.delete("/:id", async (c) => {
  const roleId = c.req.param("id");
  // Business logic: mark_deleted!
  return c.body(null, 204);
});

export { companyRolesRouter };
