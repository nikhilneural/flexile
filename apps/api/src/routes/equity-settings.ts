import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { Env } from "@/env";
import { PayRateType } from "@/db/enums";
import { companyContractors, equityAllocations } from "@/db/schema";
import { authMiddleware } from "@/middleware/auth";
import { companyMiddleware } from "@/middleware/company";
import { getUniqueUnvestedEquityGrantForYear } from "./equity-grants";

const MAX_EQUITY_PERCENTAGE = 100;

const app = new Hono<{ Bindings: Env }>();

const assertPermissions = (contractor: typeof companyContractors.$inferSelect) => {
  if (contractor.payRateType === PayRateType.Salary) return false;
  if (contractor.endedAt && new Date() > contractor.endedAt) return false;
  return true;
};

// Utility removed - inline queries used directly in handlers

// GET /api/companies/:companyId/equity-settings
app.get("/:companyId/equity-settings", authMiddleware, companyMiddleware, async (c) => {
  const ctx = c.get("company");
  if (!ctx.companyContractor) return c.json({ error: "Forbidden" }, 403);
  if (!assertPermissions(ctx.companyContractor)) return c.json({ error: "Forbidden" }, 403);

  const allocation = await ctx.db.query.equityAllocations.findFirst({
    columns: { equityPercentage: true, locked: true },
    where: and(
      eq(equityAllocations.companyContractorId, ctx.companyContractor.id),
      eq(equityAllocations.year, new Date().getFullYear()),
    ),
  });

  return c.json({ allocation: allocation ?? null });
});

// PUT /api/companies/:companyId/equity-settings
app.put(
  "/:companyId/equity-settings",
  authMiddleware,
  companyMiddleware,
  zValidator("json", z.object({ equityPercentage: z.number().min(0).max(MAX_EQUITY_PERCENTAGE) })),
  async (c) => {
    const ctx = c.get("company");
    const input = c.req.valid("json");

    if (!ctx.companyContractor) return c.json({ error: "Forbidden" }, 403);
    if (!assertPermissions(ctx.companyContractor)) return c.json({ error: "Forbidden" }, 403);
    if (ctx.companyContractor.onTrial) return c.json({ error: "Forbidden" }, 403);

    const equityAllocation = await ctx.db.query.equityAllocations.findFirst({
      columns: { equityPercentage: true, locked: true },
      where: and(
        eq(equityAllocations.companyContractorId, ctx.companyContractor.id),
        eq(equityAllocations.year, new Date().getFullYear()),
      ),
    });
    if (equityAllocation?.locked) return c.json({ error: "Forbidden" }, 403);

    const unvestedEquityGrant = await getUniqueUnvestedEquityGrantForYear(
      ctx.db,
      ctx.companyContractor,
      new Date().getFullYear(),
    );
    if (!unvestedEquityGrant) return c.json({ error: "Forbidden" }, 403);

    await ctx.db
      .insert(equityAllocations)
      .values({
        companyContractorId: ctx.companyContractor.id,
        year: new Date().getFullYear(),
        equityPercentage: input.equityPercentage,
      })
      .onConflictDoUpdate({
        target: [equityAllocations.companyContractorId, equityAllocations.year],
        set: { equityPercentage: input.equityPercentage },
      });

    return c.json({ success: true });
  },
);

export { app as equitySettingsRouter };
