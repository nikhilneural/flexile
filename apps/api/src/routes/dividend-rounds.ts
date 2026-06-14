import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import type { Env } from "@/env";
import { pagination } from "@/db";
import { dividendRounds } from "@/db/schema";
import { authMiddleware } from "@/middleware/auth";
import { companyMiddleware } from "@/middleware/company";

const app = new Hono<{ Bindings: Env }>();

// GET /api/companies/:companyId/dividend-rounds
app.get(
  "/:companyId/dividend-rounds",
  authMiddleware,
  companyMiddleware,
  zValidator("query", z.object({ page: z.coerce.number().optional(), perPage: z.coerce.number().optional() })),
  async (c) => {
    const ctx = c.get("company");
    const input = c.req.valid("query");

    if (!ctx.company.dividendsAllowed) return c.json({ error: "Forbidden" }, 403);
    if (!(ctx.companyAdministrator || ctx.companyLawyer)) return c.json({ error: "Forbidden" }, 403);

    const where = eq(dividendRounds.companyId, ctx.company.id);
    const paginationInput = input.page && input.perPage ? { page: input.page, perPage: input.perPage } : {};
    const rows = await ctx.db.query.dividendRounds.findMany({
      columns: { id: true, issuedAt: true, totalAmountInCents: true, numberOfShareholders: true },
      where,
      orderBy: [desc(dividendRounds.id)],
      ...pagination(paginationInput),
    });
    const count = await ctx.db.$count(dividendRounds, where);

    return c.json({ dividendRounds: rows, total: count });
  },
);

// GET /api/companies/:companyId/dividend-rounds/:id
app.get(
  "/:companyId/dividend-rounds/:id",
  authMiddleware,
  companyMiddleware,
  zValidator("param", z.object({ companyId: z.string(), id: z.coerce.number() })),
  async (c) => {
    const ctx = c.get("company");
    const { id } = c.req.valid("param");

    if (!ctx.company.dividendsAllowed) return c.json({ error: "Forbidden" }, 403);
    if (!(ctx.companyAdministrator || ctx.companyLawyer)) return c.json({ error: "Forbidden" }, 403);

    const dividendRound = await ctx.db.query.dividendRounds.findFirst({
      columns: { issuedAt: true, totalAmountInCents: true, numberOfShareholders: true },
      where: and(eq(dividendRounds.id, BigInt(id)), eq(dividendRounds.companyId, ctx.company.id)),
    });
    if (!dividendRound) return c.json({ error: "Not Found" }, 404);

    return c.json(dividendRound);
  },
);

export { app as dividendRoundsRouter };
