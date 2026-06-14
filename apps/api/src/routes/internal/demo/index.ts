import { Hono } from "hono";
import type { Env } from "@/env";

const demoRouter = new Hono<{ Bindings: Env }>();

/** GET /internal/demo/company - Get demo company data (non-production only) */
demoRouter.get("/company", async (c) => {
  if (c.env.ENVIRONMENT === "production") {
    return c.json({ error: "Not Found" }, 404);
  }
  // Business logic: find default demo company and return DemoCompanyPresenter props
  return c.json({ company: {} });
});

export { demoRouter };
