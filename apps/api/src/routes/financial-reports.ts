import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import type { Env } from "@/env";
import { companyMonthlyFinancialReports } from "@/db/schema";
import { authMiddleware } from "@/middleware/auth";
import { companyMiddleware } from "@/middleware/company";

const app = new Hono<{ Bindings: Env }>();

// GET /api/companies/:companyId/financial-reports
app.get(
  "/:companyId/financial-reports",
  authMiddleware,
  companyMiddleware,
  zValidator("query", z.object({ years: z.string().optional() })),
  async (c) => {
    const ctx = c.get("company");
    const { years: yearsStr } = c.req.valid("query");
    const years = yearsStr ? yearsStr.split(",").map(Number) : undefined;

    const isActiveContractor = ctx.companyContractor && !ctx.companyContractor.endedAt;
    if (
      !ctx.companyAdministrator &&
      !(ctx.company.companyUpdatesEnabled && (ctx.companyInvestor || isActiveContractor))
    )
      return c.json({ error: "Forbidden" }, 403);

    const results = await ctx.db.query.companyMonthlyFinancialReports.findMany({
      columns: { month: true, year: true, revenueCents: true, netIncomeCents: true },
      where: and(
        eq(companyMonthlyFinancialReports.companyId, ctx.company.id),
        years ? inArray(companyMonthlyFinancialReports.year, years) : undefined,
      ),
    });

    return c.json(results);
  },
);

export { app as financialReportsRouter };
