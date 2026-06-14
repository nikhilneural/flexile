import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  and,
  count,
  countDistinct,
  desc,
  eq,
  gt,
  gte,
  isNotNull,
  isNull,
  lte,
  or,
  sql,
  type SQLWrapper,
  sum,
} from "drizzle-orm";
import { pick } from "lodash-es";
import { z } from "zod";
import type { Env } from "@/env";
import { createDb, paginate, paginationSchema } from "@/db";
import { PayRateType } from "@/db/enums";
import {
  companyContractors,
  companyInvestors,
  equityGrantExercises,
  equityGrants,
  optionPools,
  users,
  vestingSchedules,
} from "@/db/schema";
import { authMiddleware } from "@/middleware/auth";
import { companyMiddleware, type CompanyContext } from "@/middleware/company";
import { assertDefined } from "@/utils/assert";
import { simpleUser } from "./users/helpers";

const app = new Hono<{ Bindings: Env }>();

// GET /api/companies/:companyId/equity-grants/:id
app.get("/:companyId/equity-grants/:id", authMiddleware, companyMiddleware, async (c) => {
  const ctx = c.get("company");
  const id = c.req.param("id");

  const canViewAll = ctx.companyAdministrator || ctx.companyLawyer;
  if (!canViewAll && !ctx.companyInvestor) return c.json({ error: "Forbidden" }, 403);

  const equityGrant = await ctx.db.query.equityGrants.findFirst({
    where: and(
      eq(equityGrants.externalId, id),
      canViewAll || !ctx.companyInvestor ? undefined : eq(equityGrants.companyInvestorId, ctx.companyInvestor.id),
    ),
    columns: {
      optionHolderName: true,
      issueDateRelationship: true,
      optionGrantType: true,
      numberOfShares: true,
      exercisedShares: true,
      forfeitedShares: true,
      vestedShares: true,
      unvestedShares: true,
      issuedAt: true,
      periodEndedAt: true,
      expiresAt: true,
      boardApprovalDate: true,
      voluntaryTerminationExerciseMonths: true,
      involuntaryTerminationExerciseMonths: true,
      terminationWithCauseExerciseMonths: true,
      deathExerciseMonths: true,
      disabilityExerciseMonths: true,
      retirementExerciseMonths: true,
      exercisePriceUsd: true,
      vestedAmountUsd: true,
      acceptedAt: true,
    },
    with: {
      optionPool: { columns: { name: true, companyId: true } },
      companyInvestor: { with: { user: { columns: { countryCode: true, state: true, email: true } } } },
    },
  });

  if (equityGrant?.optionPool.companyId !== ctx.company.id) return c.json({ error: "Not Found" }, 404);

  return c.json(equityGrant);
});

// GET /api/companies/:companyId/equity-grants
app.get(
  "/:companyId/equity-grants",
  authMiddleware,
  companyMiddleware,
  zValidator(
    "query",
    z.object({
      investorId: z.string().optional(),
      accepted: z.coerce.boolean().optional(),
      eventuallyExercisable: z.coerce.boolean().optional(),
      orderBy: z.enum(["issuedAt", "periodEndedAt"]).default("issuedAt"),
      page: z.coerce.number().optional(),
      perPage: z.coerce.number().optional(),
    }),
  ),
  async (c) => {
    const ctx = c.get("company");
    const input = c.req.valid("query");

    if (!ctx.company.equityGrantsEnabled) return c.json({ error: "Forbidden" }, 403);
    if (
      !ctx.companyAdministrator &&
      !ctx.companyLawyer &&
      (!ctx.companyInvestor || ctx.companyInvestor.externalId !== input.investorId)
    )
      return c.json({ error: "Forbidden" }, 403);

    const where = and(
      eq(optionPools.companyId, ctx.company.id),
      input.investorId ? eq(companyInvestors.externalId, input.investorId) : undefined,
      input.accepted ? isNotNull(equityGrants.acceptedAt) : undefined,
      input.eventuallyExercisable
        ? or(
            gt(equityGrants.vestedShares, 0),
            gt(equityGrants.unvestedShares, 0),
            eq(equityGrants.exercisedShares, 0),
          )
        : undefined,
    );

    const query = ctx.db
      .select({
        ...pick(
          equityGrants,
          "issuedAt",
          "numberOfShares",
          "vestedShares",
          "unvestedShares",
          "exercisedShares",
          "vestedAmountUsd",
          "exercisePriceUsd",
          "optionGrantType",
          "periodEndedAt",
          "periodStartedAt",
          "forfeitedShares",
          "acceptedAt",
          "expiresAt",
          "boardApprovalDate",
          "voluntaryTerminationExerciseMonths",
          "involuntaryTerminationExerciseMonths",
          "terminationWithCauseExerciseMonths",
          "deathExerciseMonths",
          "disabilityExerciseMonths",
          "retirementExerciseMonths",
          "issueDateRelationship",
          "optionHolderName",
        ),
        id: equityGrants.externalId,
        user: { id: users.externalId },
        activeExercise: pick(equityGrantExercises, "id", "numberOfOptions", "totalCostCents"),
        optionPool: pick(optionPools, "name"),
      })
      .from(equityGrants)
      .innerJoin(companyInvestors, eq(equityGrants.companyInvestorId, companyInvestors.id))
      .innerJoin(users, eq(companyInvestors.userId, users.id))
      .innerJoin(optionPools, eq(equityGrants.optionPoolId, optionPools.id))
      .leftJoin(equityGrantExercises, eq(equityGrants.activeExerciseId, equityGrantExercises.id))
      .where(where)
      .orderBy(desc(equityGrants[input.orderBy]));

    const [total] = await ctx.db
      .select({ total: count() })
      .from(equityGrants)
      .innerJoin(companyInvestors, eq(equityGrants.companyInvestorId, companyInvestors.id))
      .innerJoin(optionPools, eq(equityGrants.optionPoolId, optionPools.id))
      .where(where);

    const paginationInput = input.page && input.perPage ? { page: input.page, perPage: input.perPage } : {};
    return c.json({ equityGrants: await paginate(query, paginationInput), total: assertDefined(total).total });
  },
);

// GET /api/companies/:companyId/equity-grants/totals
app.get("/:companyId/equity-grants/totals", authMiddleware, companyMiddleware, async (c) => {
  const ctx = c.get("company");
  if (!ctx.companyAdministrator && !ctx.companyLawyer) return c.json({ error: "Forbidden" }, 403);

  const [totals] = await ctx.db
    .select({
      unvestedShares: sum(equityGrants.unvestedShares).mapWith(Number),
      vestedShares: sum(equityGrants.vestedShares).mapWith(Number),
      exercisedShares: sum(equityGrants.exercisedShares).mapWith(Number),
    })
    .from(equityGrants)
    .innerJoin(optionPools, eq(equityGrants.optionPoolId, optionPools.id))
    .where(eq(optionPools.companyId, ctx.company.id));

  return c.json(assertDefined(totals));
});

// GET /api/companies/:companyId/equity-grants/by-country
app.get("/:companyId/equity-grants/by-country", authMiddleware, companyMiddleware, async (c) => {
  const ctx = c.get("company");
  if (!ctx.companyAdministrator && !ctx.companyLawyer) return c.json({ error: "Forbidden" }, 403);

  const countries = await ctx.db
    .select({
      countryCode: users.countryCode,
      optionHolders: countDistinct(companyInvestors.id),
    })
    .from(companyInvestors)
    .innerJoin(equityGrants, eq(companyInvestors.id, equityGrants.companyInvestorId))
    .innerJoin(users, eq(companyInvestors.userId, users.id))
    .where(eq(companyInvestors.companyId, ctx.company.id))
    .groupBy(users.countryCode)
    .orderBy(users.countryCode);

  return c.json(countries);
});

// GET /api/companies/:companyId/equity-grants/sum-vested
app.get(
  "/:companyId/equity-grants/sum-vested",
  authMiddleware,
  companyMiddleware,
  zValidator("query", z.object({ investorId: z.string().optional() })),
  async (c) => {
    const ctx = c.get("company");
    const input = c.req.valid("query");

    if (
      !ctx.companyAdministrator &&
      (!ctx.companyInvestor || (input.investorId && input.investorId !== ctx.companyInvestor.externalId))
    )
      return c.json({ error: "Forbidden" }, 403);

    const investorId = input.investorId
      ? ctx.db
          .select({ id: companyInvestors.id })
          .from(companyInvestors)
          .where(eq(companyInvestors.externalId, input.investorId))
      : undefined;

    const result = await sumVestedShares(ctx.db, ctx.company.id, investorId);
    return c.json({ total: result });
  },
);

export const sumVestedShares = async (
  db: ReturnType<typeof createDb>,
  companyId: bigint,
  investorId: bigint | SQLWrapper | undefined,
) => {
  const [result] = await db
    .select({ total: sum(equityGrants.vestedShares).mapWith(Number) })
    .from(equityGrants)
    .innerJoin(optionPools, eq(equityGrants.optionPoolId, optionPools.id))
    .where(
      and(
        investorId ? eq(equityGrants.companyInvestorId, investorId) : undefined,
        eq(optionPools.companyId, companyId),
        gt(equityGrants.vestedShares, 0),
      ),
    );
  return assertDefined(result).total;
};

export const getUniqueUnvestedEquityGrantForYear = async (
  db: ReturnType<typeof createDb>,
  companyContractor: CompanyContext["companyContractor"],
  year: number,
) => {
  if (!companyContractor) return null;
  const investor = await db.query.companyInvestors.findFirst({
    where: and(
      eq(companyInvestors.companyId, companyContractor.companyId),
      eq(companyInvestors.userId, companyContractor.userId),
    ),
    columns: { id: true, companyId: true },
  });
  if (!investor) return null;

  const grants = await db.query.equityGrants.findMany({
    where: and(
      eq(equityGrants.companyInvestorId, investor.id),
      eq(equityGrants.vestingTrigger, "invoice_paid"),
      sql`EXTRACT(YEAR FROM ${equityGrants.periodEndedAt}) = ${year}`,
      gte(equityGrants.unvestedShares, 1),
    ),
  });

  return grants.length === 1 ? grants[0] : null;
};

export { app as equityGrantsRouter };
