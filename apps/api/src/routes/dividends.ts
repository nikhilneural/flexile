import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { Env } from "@/env";
import { byExternalId, pagination } from "@/db";
import { companyInvestors, dividends } from "@/db/schema";
import { authMiddleware } from "@/middleware/auth";
import { companyMiddleware } from "@/middleware/company";
import { simpleUser } from "./users/helpers";

const app = new Hono<{ Bindings: Env }>();

// GET /api/companies/:companyId/dividends
app.get(
  "/:companyId/dividends",
  authMiddleware,
  companyMiddleware,
  zValidator(
    "query",
    z.object({
      investorId: z.string().optional(),
      dividendRoundId: z.coerce.number().optional(),
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
      eq(dividends.companyId, ctx.company.id),
      input.investorId
        ? eq(dividends.companyInvestorId, byExternalId(companyInvestors, input.investorId))
        : undefined,
      input.dividendRoundId ? eq(dividends.dividendRoundId, BigInt(input.dividendRoundId)) : undefined,
    );

    const paginationInput = input.page && input.perPage ? { page: input.page, perPage: input.perPage } : {};
    const rows = await ctx.db.query.dividends.findMany({
      columns: { numberOfShares: true, totalAmountInCents: true, retainedReason: true, status: true },
      with: {
        dividendRound: { columns: { issuedAt: true } },
        investor: { with: { user: { columns: simpleUser.columns } } },
      },
      where,
      ...pagination(paginationInput),
    });
    const total = await ctx.db.$count(dividends, where);

    return c.json({
      dividends: rows.map((row) => ({ ...row, investor: { user: simpleUser(row.investor.user) } })),
      total,
    });
  },
);

export { app as dividendsRouter };
