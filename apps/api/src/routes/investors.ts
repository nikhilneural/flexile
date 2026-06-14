import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { Env } from "@/env";
import { byExternalId } from "@/db";
import { companyInvestors, users } from "@/db/schema";
import { authMiddleware } from "@/middleware/auth";
import { companyMiddleware } from "@/middleware/company";

const app = new Hono<{ Bindings: Env }>();

// GET /api/companies/:companyId/investors
app.get(
  "/:companyId/investors",
  authMiddleware,
  companyMiddleware,
  zValidator("query", z.object({ userId: z.string() })),
  async (c) => {
    const ctx = c.get("company");
    const { userId } = c.req.valid("query");

    if (!ctx.companyAdministrator && !ctx.companyLawyer) return c.json({ error: "Forbidden" }, 403);

    const investor = await ctx.db.query.companyInvestors.findFirst({
      where: and(
        eq(companyInvestors.companyId, ctx.company.id),
        eq(companyInvestors.userId, byExternalId(users, userId)),
      ),
    });
    if (!investor) return c.json({ error: "Not Found" }, 404);

    return c.json({ id: investor.externalId });
  },
);

export { app as investorsRouter };
