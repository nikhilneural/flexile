import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { Env } from "@/env";
import { equityAllocations } from "@/db/schema";
import { authMiddleware } from "@/middleware/auth";
import { companyMiddleware } from "@/middleware/company";

const app = new Hono<{ Bindings: Env }>();

// GET /api/companies/:companyId/equity-allocations
app.get(
  "/:companyId/equity-allocations",
  authMiddleware,
  companyMiddleware,
  zValidator("query", z.object({ year: z.coerce.number() })),
  async (c) => {
    const ctx = c.get("company");
    const { year } = c.req.valid("query");

    if (!ctx.companyContractor) return c.json({ error: "Forbidden" }, 403);

    const result = await ctx.db.query.equityAllocations.findFirst({
      columns: { equityPercentage: true, locked: true },
      where: and(
        eq(equityAllocations.year, year),
        eq(equityAllocations.companyContractorId, ctx.companyContractor.id),
      ),
    });

    return c.json(result ?? null);
  },
);

export { app as equityAllocationsRouter };
