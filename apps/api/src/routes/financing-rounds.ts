import { Hono } from "hono";
import { desc, eq } from "drizzle-orm";
import type { Env } from "@/env";
import { financingRounds } from "@/db/schema";
import { authMiddleware } from "@/middleware/auth";
import { companyMiddleware } from "@/middleware/company";

const app = new Hono<{ Bindings: Env }>();

// GET /api/companies/:companyId/financing-rounds
app.get("/:companyId/financing-rounds", authMiddleware, companyMiddleware, async (c) => {
  const ctx = c.get("company");

  if (!ctx.company.financingRoundsEnabled || !(ctx.companyAdministrator || ctx.companyLawyer || ctx.companyInvestor))
    return c.json({ error: "Forbidden" }, 403);

  const results = await ctx.db.query.financingRounds.findMany({
    columns: {
      name: true,
      issuedAt: true,
      sharesIssued: true,
      pricePerShareCents: true,
      amountRaisedCents: true,
      postMoneyValuationCents: true,
      investors: true,
    },
    where: eq(financingRounds.companyId, ctx.company.id),
    orderBy: [desc(financingRounds.issuedAt)],
  });

  return c.json(results);
});

export { app as financingRoundsRouter };
