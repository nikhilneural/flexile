import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { Env } from "@/env";

const adminGithubRouter = new Hono<{ Bindings: Env }>();

const connectSchema = z.object({
  code: z.string(),
  state: z.string(),
});

/** POST /internal/companies/:companyId/administrator/github - Connect GitHub */
adminGithubRouter.post("/", zValidator("json", connectSchema), async (c) => {
  const { code, state } = c.req.valid("json");
  // Business logic: IntegrationApi::Github OAuth flow
  // Validates state, exchanges code for token, creates/restores integration
  return c.json({ success: true, integration: {} });
});

/** DELETE /internal/companies/:companyId/administrator/github - Disconnect GitHub */
adminGithubRouter.delete("/", async (c) => {
  // Business logic: revoke GitHub token and mark integration as deleted
  return c.json({ success: true });
});

export { adminGithubRouter };
