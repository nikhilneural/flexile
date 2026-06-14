import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { Env } from "@/env";

const apiV1Router = new Hono<{ Bindings: Env }>();

/**
 * GET /api/v1/companies/:companyId/roles - List actively hiring roles (XML/JSON)
 * Public API endpoint for role listings.
 */
apiV1Router.get("/companies/:companyId/roles", async (c) => {
  const companyId = c.req.param("companyId");
  // Business logic: find company and return actively_hiring roles
  // Original returns XML, we support both JSON and XML based on Accept header
  const acceptHeader = c.req.header("Accept") || "";
  if (acceptHeader.includes("application/xml") || acceptHeader.includes("text/xml")) {
    c.header("Content-Type", "application/xml");
    return c.body("<roles></roles>");
  }
  return c.json({ roles: [] });
});

const userLeadSchema = z.object({
  email: z.string().email(),
});

/**
 * POST /api/v1/user-leads - Create a user lead
 * Public API endpoint for capturing email leads.
 */
apiV1Router.post("/user-leads", zValidator("json", userLeadSchema), async (c) => {
  const { email } = c.req.valid("json");
  // Business logic: create UserLead record
  // Always returns success (even if duplicate) to avoid leaking info
  return c.json({ success: true }, 201);
});

export { apiV1Router };
