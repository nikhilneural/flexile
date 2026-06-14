import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, count, desc, eq, sum } from "drizzle-orm";
import { pick } from "lodash-es";
import { z } from "zod";
import type { Env } from "@/env";
import { paginate } from "@/db";
import { companyInvestors, convertibleInvestments, convertibleSecurities } from "@/db/schema";
import { authMiddleware } from "@/middleware/auth";
import { companyMiddleware } from "@/middleware/company";
import { assertDefined } from "@/utils/assert";

const app = new Hono<{ Bindings: Env }>();

// GET /api/companies/:companyId/convertible-securities
app.get(
  "/:companyId/convertible-securities",
  authMiddleware,
  companyMiddleware,
  zValidator(
    "query",
    z.object({
      investorId: z.string(),
      page: z.coerce.number().optional(),
      perPage: z.coerce.number().optional(),
    }),
  ),
  async (c) => {
    const ctx = c.get("company");
    const input = c.req.valid("query");

    if (
      !ctx.companyAdministrator &&
      !ctx.companyLawyer &&
      !(ctx.companyInvestor && ctx.companyInvestor.externalId === input.investorId)
    )
      return c.json({ error: "Forbidden" }, 403);

    const where = and(
      eq(companyInvestors.companyId, ctx.company.id),
      eq(companyInvestors.externalId, input.investorId),
    );

    const paginationInput = input.page && input.perPage ? { page: input.page, perPage: input.perPage } : {};
    const query = paginate(
      ctx.db
        .select({
          ...pick(convertibleSecurities, "issuedAt", "principalValueInCents"),
          ...pick(convertibleInvestments, "convertibleType", "companyValuationInDollars"),
        })
        .from(convertibleSecurities)
        .innerJoin(companyInvestors, eq(convertibleSecurities.companyInvestorId, companyInvestors.id))
        .innerJoin(convertibleInvestments, eq(convertibleSecurities.convertibleInvestmentId, convertibleInvestments.id))
        .where(where)
        .orderBy(desc(convertibleSecurities.issuedAt)),
      paginationInput,
    );

    const [totals] = await ctx.db
      .select({
        totalImpliedShares: sum(convertibleSecurities.impliedShares).mapWith(Number),
        totalPrincipalValueInCents: sum(convertibleSecurities.principalValueInCents).mapWith(Number),
        totalCount: count(),
      })
      .from(convertibleSecurities)
      .innerJoin(companyInvestors, eq(convertibleSecurities.companyInvestorId, companyInvestors.id))
      .innerJoin(convertibleInvestments, eq(convertibleSecurities.convertibleInvestmentId, convertibleInvestments.id))
      .where(where);

    return c.json({ convertibleSecurities: await query, ...assertDefined(totals) });
  },
);

export { app as convertibleSecuritiesRouter };
