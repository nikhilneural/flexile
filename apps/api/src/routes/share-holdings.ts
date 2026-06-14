import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, sum } from "drizzle-orm";
import { pick } from "lodash-es";
import { z } from "zod";
import type { Env } from "@/env";
import { byExternalId, paginate, paginationSchema } from "@/db";
import { companyInvestors, shareClasses, shareHoldings } from "@/db/schema";
import { authMiddleware } from "@/middleware/auth";
import { companyMiddleware } from "@/middleware/company";

const app = new Hono<{ Bindings: Env }>();

// GET /api/companies/:companyId/share-holdings
app.get(
  "/:companyId/share-holdings",
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

    const query = ctx.db
      .select({
        shareClassName: shareClasses.name,
        ...pick(shareHoldings, "numberOfShares", "sharePriceUsd", "totalAmountInCents", "issuedAt"),
      })
      .from(shareHoldings)
      .innerJoin(companyInvestors, eq(shareHoldings.companyInvestorId, companyInvestors.id))
      .innerJoin(shareClasses, eq(shareHoldings.shareClassId, shareClasses.id))
      .where(and(eq(shareClasses.companyId, ctx.company.id), eq(companyInvestors.externalId, input.investorId)))
      .orderBy(desc(shareHoldings.id));

    const total = await ctx.db.$count(query.as("shareHoldings"));
    const paginationInput = input.page && input.perPage ? { page: input.page, perPage: input.perPage } : {};

    return c.json({ shareHoldings: await paginate(query, paginationInput), total });
  },
);

// GET /api/companies/:companyId/share-holdings/sum-by-class
app.get(
  "/:companyId/share-holdings/sum-by-class",
  authMiddleware,
  companyMiddleware,
  zValidator("query", z.object({ investorId: z.string().optional() })),
  async (c) => {
    const ctx = c.get("company");
    const { investorId } = c.req.valid("query");

    if (
      !ctx.companyAdministrator &&
      (!ctx.companyInvestor || (investorId && investorId !== ctx.companyInvestor.externalId))
    )
      return c.json({ error: "Forbidden" }, 403);

    const result = await ctx.db
      .select({ className: shareClasses.name, count: sum(shareHoldings.numberOfShares).mapWith(Number) })
      .from(shareHoldings)
      .where(
        and(
          investorId
            ? eq(shareHoldings.companyInvestorId, byExternalId(companyInvestors, investorId))
            : undefined,
          eq(shareClasses.companyId, ctx.company.id),
        ),
      )
      .innerJoin(shareClasses, eq(shareHoldings.shareClassId, shareClasses.id))
      .groupBy(shareClasses.name);

    return c.json(result);
  },
);

export { app as shareHoldingsRouter };
