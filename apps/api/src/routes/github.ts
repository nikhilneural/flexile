import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import type { Env } from "@/env";
import { integrations } from "@/db/schema";
import { authMiddleware } from "@/middleware/auth";
import { companyMiddleware } from "@/middleware/company";

export const companyGithubIntegration = (companyId: bigint) =>
  and(eq(integrations.companyId, companyId), eq(integrations.type, "GithubIntegration"), isNull(integrations.deletedAt));

const app = new Hono<{ Bindings: Env }>();

// GET /api/companies/:companyId/github
app.get("/:companyId/github", authMiddleware, companyMiddleware, async (c) => {
  const ctx = c.get("company");
  if (!ctx.companyAdministrator) return c.json({ error: "Forbidden" }, 403);

  const integration = await ctx.db.query.integrations.findFirst({
    columns: { status: true },
    where: companyGithubIntegration(ctx.company.id),
  });

  return c.json(integration ?? null);
});

// POST /api/companies/:companyId/github/connect
app.post(
  "/:companyId/github/connect",
  authMiddleware,
  companyMiddleware,
  zValidator("json", z.object({ code: z.string() })),
  async (c) => {
    const ctx = c.get("company");
    const { code } = c.req.valid("json");

    if (!ctx.companyAdministrator) return c.json({ error: "Forbidden" }, 403);

    // In production this would call the GitHub OAuth flow
    // For now, store the integration with the code
    const values = {
      status: "active" as const,
      configuration: {
        organizations: [],
        access_token: code,
        webhooks: [],
      },
      accountId: "pending",
    };

    const [updated] = await ctx.db
      .update(integrations)
      .set(values)
      .where(companyGithubIntegration(ctx.company.id))
      .returning();
    if (!updated) {
      await ctx.db.insert(integrations).values({
        ...values,
        type: "GithubIntegration",
        companyId: ctx.company.id,
      });
    }

    return c.json({ success: true });
  },
);

// POST /api/companies/:companyId/github/disconnect
app.post("/:companyId/github/disconnect", authMiddleware, companyMiddleware, async (c) => {
  const ctx = c.get("company");
  if (!ctx.companyAdministrator) return c.json({ error: "Forbidden" }, 403);

  const integration = await ctx.db.query.integrations.findFirst({ where: companyGithubIntegration(ctx.company.id) });
  if (!integration) return c.json({ error: "Not Found" }, 404);

  await ctx.db
    .update(integrations)
    .set({
      deletedAt: new Date(),
      status: "deleted",
      configuration: { ...(integration.configuration as object), webhooks: [] },
    })
    .where(eq(integrations.id, integration.id));

  return c.json({ success: true });
});

// GET /api/companies/:companyId/github/search
app.get(
  "/:companyId/github/search",
  authMiddleware,
  companyMiddleware,
  zValidator("query", z.object({ query: z.string().nullable() })),
  async (c) => {
    const ctx = c.get("company");
    if (!ctx.companyAdministrator && !ctx.companyContractor) return c.json({ error: "Forbidden" }, 403);

    const integration = await ctx.db.query.integrations.findFirst({
      where: companyGithubIntegration(ctx.company.id),
    });
    if (!integration) return c.json({ error: "Not Found" }, 404);

    // Search would use Octokit in production - return empty for now
    return c.json([]);
  },
);

// GET /api/companies/:companyId/github/unfurl
app.get(
  "/:companyId/github/unfurl",
  authMiddleware,
  companyMiddleware,
  zValidator("query", z.object({ url: z.string() })),
  async (c) => {
    const ctx = c.get("company");
    if (!ctx.companyAdministrator && !ctx.companyContractor) return c.json({ error: "Forbidden" }, 403);

    const integration = await ctx.db.query.integrations.findFirst({
      where: companyGithubIntegration(ctx.company.id),
    });
    if (!integration) return c.json({ error: "Not Found" }, 404);

    // Unfurl would use Octokit in production - return null for now
    return c.json(null);
  },
);

export { app as githubRouter };
