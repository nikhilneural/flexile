import { Hono } from "hono";
import type { Env } from "@/env";

const roleApplicationsRouter = new Hono<{ Bindings: Env }>();

/** GET /internal/companies/:companyId/role-applications?role_id=... - List applications */
roleApplicationsRouter.get("/", async (c) => {
  const roleId = c.req.query("role_id");
  // Business logic: CompanyRoleApplicationPresenter.index_props
  return c.json({ applications: [] });
});

/** GET /internal/companies/:companyId/role-applications/:id - Show application */
roleApplicationsRouter.get("/:id", async (c) => {
  return c.json({ application: {} });
});

/** DELETE /internal/companies/:companyId/role-applications/:id - Deny application */
roleApplicationsRouter.delete("/:id", async (c) => {
  // Business logic: mark as denied
  return c.body(null, 204);
});

export { roleApplicationsRouter };
