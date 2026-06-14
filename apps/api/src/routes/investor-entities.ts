import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, gt, or } from "drizzle-orm";
import { z } from "zod";
import type { Env } from "@/env";
import { byExternalId } from "@/db";
import { companyInvestorEntities, equityGrants, shareHoldings } from "@/db/schema";
import { authMiddleware } from "@/middleware/auth";
import { companyMiddleware } from "@/middleware/company";

const RECORDS_PER_SECTION = 20;

const app = new Hono<{ Bindings: Env }>();

// GET /api/companies/:companyId/investor-entities/:id
app.get("/:companyId/investor-entities/:id", authMiddleware, companyMiddleware, async (c) => {
  const ctx = c.get("company");
  const id = c.req.param("id");

  if (!ctx.company.capTableEnabled) return c.json({ error: "Not Found" }, 404);
  if (!(ctx.companyAdministrator || ctx.companyLawyer)) return c.json({ error: "Forbidden" }, 403);

  const investorEntity = await ctx.db.query.companyInvestorEntities.findFirst({
    where: and(
      eq(companyInvestorEntities.companyId, ctx.company.id),
      eq(companyInvestorEntities.externalId, id),
    ),
  });
  if (!investorEntity) return c.json({ error: "Not Found" }, 404);

  const grants = (
    await ctx.db.query.equityGrants.findMany({
      where: and(
        eq(equityGrants.companyInvestorEntityId, byExternalId(companyInvestorEntities, id)),
        or(gt(equityGrants.vestedShares, 0), gt(equityGrants.unvestedShares, 0), eq(equityGrants.exercisedShares, 0)),
      ),
      limit: RECORDS_PER_SECTION,
      orderBy: [desc(equityGrants.issuedAt)],
    })
  ).map((grant) => ({
    issuedAt: grant.issuedAt,
    numberOfShares: grant.numberOfShares,
    vestedShares: grant.vestedShares,
    unvestedShares: grant.unvestedShares,
    exercisedShares: grant.exercisedShares,
    vestedAmountUsd: grant.vestedAmountUsd,
    exercisePriceUsd: grant.exercisePriceUsd,
  }));

  const shares = (
    await ctx.db.query.shareHoldings.findMany({
      where: eq(shareHoldings.companyInvestorEntityId, byExternalId(companyInvestorEntities, id)),
      limit: RECORDS_PER_SECTION,
      orderBy: [desc(shareHoldings.id)],
    })
  ).map((share) => ({
    issuedAt: share.issuedAt,
    shareType: share.name,
    numberOfShares: share.numberOfShares,
    sharePriceUsd: share.sharePriceUsd,
    totalAmountInCents: share.totalAmountInCents,
  }));

  return c.json({
    id: investorEntity.externalId,
    name: investorEntity.name,
    grants,
    shares,
  });
});

export { app as investorEntitiesRouter };
