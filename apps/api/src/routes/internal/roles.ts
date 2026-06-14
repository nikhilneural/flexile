import { Hono } from "hono";
import type { Env } from "@/env";

const internalRolesRouter = new Hono<{ Bindings: Env }>();

/** GET /internal/roles?company_id=:companyId - List actively hiring roles for a company */
internalRolesRouter.get("/", async (c) => {
  const companyId = c.req.query("company_id");
  if (!companyId) {
    return c.json({ error: "company_id is required" }, 400);
  }
  // Business logic: find company by external_id and return CompanyRolePresenter.actively_hiring_props
  return c.json({ roles: [] });
});

/** GET /internal/roles/:id - Get a specific role */
internalRolesRouter.get("/:id", async (c) => {
  const roleId = c.req.param("id");
  // Business logic: find role by external_id and return CompanyRolePresenter props
  return c.json({ role: { id: roleId } });
});

export { internalRolesRouter };
