import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { pick } from "lodash-es";
import { z } from "zod";
import type { Env } from "@/env";
import { companyAdministrators } from "@/db/schema";
import { authMiddleware } from "@/middleware/auth";
import { companyMiddleware } from "@/middleware/company";

const app = new Hono<{ Bindings: Env }>();

// GET /api/companies/:companyId/administrators
app.get("/:companyId/administrators", authMiddleware, companyMiddleware, async (c) => {
  const ctx = c.get("company");
  if (!ctx.companyAdministrator) return c.json({ error: "Forbidden" }, 403);

  const administrators = await ctx.db.query.companyAdministrators.findMany({
    where: eq(companyAdministrators.companyId, ctx.company.id),
    columns: { externalId: true, boardMember: true },
    with: { user: true },
  });

  return c.json(
    administrators.map((admin) => ({
      ...admin,
      id: admin.externalId,
      name: admin.user.legalName ?? admin.user.email,
    })),
  );
});

// PUT /api/companies/:companyId/administrators/:id
app.put(
  "/:companyId/administrators/:id",
  authMiddleware,
  companyMiddleware,
  zValidator("json", z.object({ boardMember: z.boolean().optional() })),
  async (c) => {
    const ctx = c.get("company");
    const id = c.req.param("id");
    const input = c.req.valid("json");

    if (!ctx.companyAdministrator) return c.json({ error: "Forbidden" }, 403);

    const [row] = await ctx.db
      .update(companyAdministrators)
      .set(pick(input, "boardMember"))
      .where(and(eq(companyAdministrators.externalId, id), eq(companyAdministrators.companyId, ctx.company.id)))
      .returning();
    if (!row) return c.json({ error: "Not Found" }, 404);

    return c.json({ success: true });
  },
);

export { app as companyAdministratorsRouter };
