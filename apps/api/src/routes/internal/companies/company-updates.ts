import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { Env } from "@/env";

const companyUpdatesRouter = new Hono<{ Bindings: Env }>();

/** GET /internal/companies/:companyId/company-updates - List company updates */
companyUpdatesRouter.get("/", async (c) => {
  // Business logic: CompanyUpdatesPresenter
  return c.json({ updates: [] });
});

/** GET /internal/companies/:companyId/company-updates/new - New update form */
companyUpdatesRouter.get("/new", async (c) => {
  return c.json({ form_props: {} });
});

/** GET /internal/companies/:companyId/company-updates/:id/edit - Edit update form */
companyUpdatesRouter.get("/:id/edit", async (c) => {
  return c.json({ form_props: {} });
});

const companyUpdateSchema = z.object({
  company_update: z.object({
    title: z.string().min(1),
    body: z.string().optional(),
    video_url: z.string().optional(),
    period: z.string().optional(),
    period_started_on: z.string().optional(),
    show_revenue: z.boolean().optional(),
    show_net_income: z.boolean().optional(),
  }),
  publish: z.string().optional(),
});

/** POST /internal/companies/:companyId/company-updates - Create a company update */
companyUpdatesRouter.post("/", zValidator("json", companyUpdateSchema), async (c) => {
  const body = c.req.valid("json");
  // Business logic: CreateOrUpdateCompanyUpdate + optional PublishCompanyUpdate
  return c.json({ company_update: {} }, 201);
});

/** PUT /internal/companies/:companyId/company-updates/:id - Update a company update */
companyUpdatesRouter.put("/:id", zValidator("json", companyUpdateSchema), async (c) => {
  const body = c.req.valid("json");
  // Business logic: CreateOrUpdateCompanyUpdate + optional PublishCompanyUpdate
  return c.json({ company_update: {} });
});

/** GET /internal/companies/:companyId/company-updates/:id - Show company update */
companyUpdatesRouter.get("/:id", async (c) => {
  return c.json({ update: {} });
});

/** DELETE /internal/companies/:companyId/company-updates/:id - Delete company update */
companyUpdatesRouter.delete("/:id", async (c) => {
  return c.body(null, 204);
});

/** POST /internal/companies/:companyId/company-updates/:id/send-test-email - Send test email */
companyUpdatesRouter.post("/:id/send-test-email", async (c) => {
  // Business logic: CompanyUpdateMailer.update_published
  return c.body(null, 200);
});

export { companyUpdatesRouter };
