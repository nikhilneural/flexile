import { Hono } from "hono";
import { desc, eq } from "drizzle-orm";
import type { Env } from "@/env";
import { optionPools } from "@/db/schema";
import { authMiddleware } from "@/middleware/auth";
import { companyMiddleware } from "@/middleware/company";

const app = new Hono<{ Bindings: Env }>();

// GET /api/companies/:companyId/option-pools
app.get("/:companyId/option-pools", authMiddleware, companyMiddleware, async (c) => {
  const ctx = c.get("company");

  if (!ctx.company.equityGrantsEnabled) return c.json({ error: "Forbidden" }, 403);
  if (!(ctx.companyAdministrator || ctx.companyLawyer)) return c.json({ error: "Forbidden" }, 403);

  const results = await ctx.db.query.optionPools.findMany({
    columns: { name: true, authorizedShares: true, issuedShares: true, availableShares: true },
    where: eq(optionPools.companyId, ctx.company.id),
    orderBy: [desc(optionPools.id)],
  });

  return c.json(results);
});

export { app as optionPoolsRouter };
