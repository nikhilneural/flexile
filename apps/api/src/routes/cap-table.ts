import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, inArray, or, sql, sum } from "drizzle-orm";
import { omit, pick } from "lodash-es";
import { z } from "zod";
import type { Env } from "@/env";
import { PayRateType } from "@/db/enums";
import {
  companyInvestorEntities,
  companyInvestors,
  convertibleInvestments,
  equityGrants,
  optionPools,
  shareClasses,
  shareHoldings,
  users,
} from "@/db/schema";
import { authMiddleware } from "@/middleware/auth";
import { companyMiddleware } from "@/middleware/company";

const app = new Hono<{ Bindings: Env }>();

// GET /api/companies/:companyId/cap-table
app.get(
  "/:companyId/cap-table",
  authMiddleware,
  companyMiddleware,
  zValidator("query", z.object({ newSchema: z.coerce.boolean().optional() })),
  async (c) => {
    const ctx = c.get("company");
    const { newSchema } = c.req.valid("query");

    const isAdminOrLawyer = !!(ctx.companyAdministrator || ctx.companyLawyer);
    const isWorkerForGumroad =
      ctx.companyContractor &&
      ctx.companyContractor.endedAt === null &&
      ctx.companyContractor.payRateType === PayRateType.Hourly &&
      ctx.company.isGumroad;
    if (!ctx.company.capTableEnabled || !(isAdminOrLawyer || ctx.companyInvestor || isWorkerForGumroad))
      return c.json({ error: "Forbidden" }, 403);

    let upcomingDividendCents = 0n;
    let outstandingShares = 0n;

    const investors: Record<string, unknown>[] = [];
    const investorsConditions = (relation: typeof companyInvestorEntities | typeof companyInvestors) =>
      and(
        eq(relation.companyId, ctx.company.id),
        or(sql`${relation.totalShares} > 0`, sql`${relation.totalOptions} > 0`),
      );

    if (newSchema) {
      (
        await ctx.db
          .select({
            id: companyInvestorEntities.externalId,
            name: companyInvestorEntities.name,
            outstandingShares: companyInvestorEntities.totalShares,
            fullyDilutedShares: sql<bigint>`${companyInvestorEntities.totalShares} + ${companyInvestorEntities.totalOptions}`,
            notes: companyInvestorEntities.capTableNotes,
            email: companyInvestorEntities.email,
          })
          .from(companyInvestorEntities)
          .where(investorsConditions(companyInvestorEntities))
          .orderBy(desc(companyInvestorEntities.totalShares), desc(companyInvestorEntities.totalOptions))
      ).forEach((investor) => {
        outstandingShares += investor.outstandingShares;
        investors.push({
          ...(isAdminOrLawyer ? investor : omit(investor, "email")),
          upcomingDividendCents: 0n,
        });
      });
    } else {
      (
        await ctx.db
          .select({
            id: companyInvestors.externalId,
            userId: users.externalId,
            name: sql<string>`COALESCE(${users.legalName}, '')`,
            outstandingShares: companyInvestors.totalShares,
            fullyDilutedShares: companyInvestors.fullyDilutedShares,
            notes: companyInvestors.capTableNotes,
            upcomingDividendCents: companyInvestors.upcomingDividendCents,
            email: users.email,
          })
          .from(companyInvestors)
          .innerJoin(users, eq(companyInvestors.userId, users.id))
          .where(investorsConditions(companyInvestors))
          .orderBy(desc(companyInvestors.totalShares), desc(companyInvestors.totalOptions))
      ).forEach((investor) => {
        upcomingDividendCents += investor.upcomingDividendCents || 0n;
        outstandingShares += investor.outstandingShares;
        investors.push(isAdminOrLawyer ? investor : omit(investor, "email"));
      });
    }

    (
      await ctx.db
        .select({
          name: sql<string>`CONCAT(${convertibleInvestments.entityName}, ' ', ${convertibleInvestments.convertibleType})`,
          upcomingDividendCents: convertibleInvestments.upcomingDividendCents,
        })
        .from(convertibleInvestments)
        .where(eq(convertibleInvestments.companyId, ctx.company.id))
        .orderBy(desc(convertibleInvestments.impliedShares))
    ).forEach((investment) => {
      upcomingDividendCents += investment.upcomingDividendCents || 0n;
      investors.push(investment);
    });

    const pools = await ctx.db
      .select({
        id: optionPools.id,
        shareClassId: optionPools.shareClassId,
        name: optionPools.name,
        availableShares: optionPools.availableShares,
      })
      .from(optionPools)
      .where(eq(optionPools.companyId, ctx.company.id));

    const classes = await Promise.all(
      (
        await ctx.db
          .select({ id: shareClasses.id, name: shareClasses.name })
          .from(shareClasses)
          .where(eq(shareClasses.companyId, ctx.company.id))
      ).map(async (shareClass) => {
        const [holdings] = await ctx.db
          .select({ outstandingShares: sum(shareHoldings.numberOfShares).mapWith(Number) })
          .from(shareHoldings)
          .where(eq(shareHoldings.shareClassId, shareClass.id));
        const outstandingSharesVal = holdings?.outstandingShares ?? 0;
        const poolIds = pools.filter((pool) => pool.shareClassId === shareClass.id).map((pool) => pool.id);
        const [grants] = poolIds.length > 0
          ? await ctx.db
              .select({
                exercisableShares: sum(sql`${equityGrants.vestedShares} + ${equityGrants.unvestedShares}`).mapWith(Number),
              })
              .from(equityGrants)
              .where(inArray(equityGrants.optionPoolId, poolIds))
          : [{ exercisableShares: 0 }];
        const exercisableShares = grants?.exercisableShares ?? 0;
        return {
          name: shareClass.name,
          outstandingShares: outstandingSharesVal,
          fullyDilutedShares: outstandingSharesVal + exercisableShares,
        };
      }),
    );

    return c.json({
      investors,
      fullyDilutedShares: ctx.company.fullyDilutedShares,
      outstandingShares,
      upcomingDividendCents,
      optionPools: pools.map((pool) => pick(pool, ["name", "availableShares"])),
      shareClasses: classes,
    });
  },
);

export { app as capTableRouter };
