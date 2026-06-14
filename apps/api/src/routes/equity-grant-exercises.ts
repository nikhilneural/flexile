import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import type { Env } from "@/env";
import { byExternalId } from "@/db";
import { companyInvestors, equityGrantExercises } from "@/db/schema";
import { authMiddleware } from "@/middleware/auth";
import { companyMiddleware } from "@/middleware/company";

const app = new Hono<{ Bindings: Env }>();

// GET /api/companies/:companyId/equity-grant-exercises
app.get(
  "/:companyId/equity-grant-exercises",
  authMiddleware,
  companyMiddleware,
  zValidator("query", z.object({ investorId: z.string().optional() })),
  async (c) => {
    const ctx = c.get("company");
    const { investorId } = c.req.valid("query");

    if (!ctx.companyAdministrator && !ctx.companyLawyer) return c.json({ error: "Forbidden" }, 403);

    const results = await ctx.db.query.equityGrantExercises.findMany({
      columns: { id: true, requestedAt: true, numberOfOptions: true, totalCostCents: true, status: true },
      where: and(
        eq(equityGrantExercises.companyId, ctx.company.id),
        ne(equityGrantExercises.status, "pending"),
        investorId
          ? eq(equityGrantExercises.companyInvestorId, byExternalId(companyInvestors, investorId))
          : undefined,
      ),
    });

    return c.json(results);
  },
);

export { app as equityGrantExercisesRouter };
