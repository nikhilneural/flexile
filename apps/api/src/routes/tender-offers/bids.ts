import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, exists, gte, lte, sum } from "drizzle-orm";
import { pick } from "lodash-es";
import { z } from "zod";
import type { Env } from "@/env";
import { byExternalId, pagination } from "@/db";
import { companyInvestors, shareClasses, shareHoldings, tenderOfferBids, tenderOffers } from "@/db/schema";
import { authMiddleware } from "@/middleware/auth";
import { companyMiddleware } from "@/middleware/company";
import { simpleUser } from "../users/helpers";
import { sumVestedShares } from "../equity-grants";

const VESTED_SHARES_CLASS = "Vested Shares";

const app = new Hono<{ Bindings: Env }>();

// GET /api/companies/:companyId/tender-offers/bids
app.get(
  "/:companyId/tender-offers/bids",
  authMiddleware,
  companyMiddleware,
  zValidator(
    "query",
    z.object({
      tenderOfferId: z.string(),
      investorId: z.string().optional(),
      page: z.coerce.number().optional(),
      perPage: z.coerce.number().optional(),
    }),
  ),
  async (c) => {
    const ctx = c.get("company");
    const input = c.req.valid("query");

    if (
      !ctx.company.tenderOffersEnabled ||
      (!ctx.companyAdministrator && (!ctx.companyInvestor || ctx.companyInvestor.externalId !== input.investorId))
    )
      return c.json({ error: "Forbidden" }, 403);

    const where = and(
      eq(
        tenderOfferBids.tenderOfferId,
        byExternalId(tenderOffers, input.tenderOfferId, eq(tenderOffers.companyId, ctx.company.id)),
      ),
      input.investorId
        ? eq(tenderOfferBids.companyInvestorId, byExternalId(companyInvestors, input.investorId))
        : undefined,
    );

    const paginationInput = input.page && input.perPage ? { page: input.page, perPage: input.perPage } : {};
    const bidsQuery = await ctx.db.query.tenderOfferBids.findMany({
      where,
      with: { companyInvestor: { with: { user: { columns: simpleUser.columns } } } },
      orderBy: desc(tenderOfferBids.createdAt),
      ...pagination(paginationInput),
    });
    const total = await ctx.db.$count(tenderOfferBids, where);

    const bids = bidsQuery.map((bid) => ({
      ...pick(bid, ["sharePriceCents", "shareClass", "numberOfShares"]),
      id: bid.externalId,
      companyInvestor: { user: { email: bid.companyInvestor.user.email } },
    }));

    return c.json({ bids, total });
  },
);

// POST /api/companies/:companyId/tender-offers/bids
app.post(
  "/:companyId/tender-offers/bids",
  authMiddleware,
  companyMiddleware,
  zValidator(
    "json",
    z.object({
      tenderOfferId: z.string(),
      numberOfShares: z.number().positive(),
      sharePriceCents: z.number().positive(),
      shareClass: z.string(),
    }),
  ),
  async (c) => {
    const ctx = c.get("company");
    const input = c.req.valid("json");

    if (!ctx.company.tenderOffersEnabled || !ctx.companyInvestor) return c.json({ error: "Forbidden" }, 403);

    const tenderOffer = await ctx.db.query.tenderOffers.findFirst({
      where: and(
        eq(tenderOffers.externalId, input.tenderOfferId),
        eq(tenderOffers.companyId, ctx.company.id),
        lte(tenderOffers.startsAt, new Date()),
        gte(tenderOffers.endsAt, new Date()),
      ),
    });
    if (!tenderOffer) return c.json({ error: "Not Found" }, 404);

    if (input.shareClass === VESTED_SHARES_CLASS) {
      const vestedTotal = await sumVestedShares(ctx.db, ctx.company.id, ctx.companyInvestor.id);
      if (input.numberOfShares > (vestedTotal ?? 0)) return c.json({ error: "Insufficient shares" }, 400);
    } else {
      const [countResult] = await ctx.db
        .select({ count: sum(shareHoldings.numberOfShares).mapWith(Number) })
        .from(shareHoldings)
        .innerJoin(shareClasses, eq(shareHoldings.shareClassId, shareClasses.id))
        .where(
          and(
            eq(shareHoldings.companyInvestorId, ctx.companyInvestor.id),
            eq(shareClasses.companyId, ctx.company.id),
            eq(shareClasses.name, input.shareClass),
          ),
        );
      if (!countResult || (countResult.count ?? 0) < input.numberOfShares)
        return c.json({ error: "Insufficient shares" }, 400);
    }

    await ctx.db.insert(tenderOfferBids).values({
      tenderOfferId: tenderOffer.id,
      companyInvestorId: ctx.companyInvestor.id,
      numberOfShares: `${input.numberOfShares}`,
      sharePriceCents: input.sharePriceCents,
      shareClass: input.shareClass,
    });

    return c.json({ success: true }, 201);
  },
);

// DELETE /api/companies/:companyId/tender-offers/bids/:id
app.delete("/:companyId/tender-offers/bids/:id", authMiddleware, companyMiddleware, async (c) => {
  const ctx = c.get("company");
  const id = c.req.param("id");

  if (!ctx.company.tenderOffersEnabled || !ctx.companyInvestor) return c.json({ error: "Forbidden" }, 403);

  const result = await ctx.db
    .delete(tenderOfferBids)
    .where(
      and(
        eq(tenderOfferBids.externalId, id),
        eq(tenderOfferBids.companyInvestorId, ctx.companyInvestor.id),
        exists(
          ctx.db
            .select()
            .from(tenderOffers)
            .where(
              and(
                eq(tenderOffers.id, tenderOfferBids.tenderOfferId),
                eq(tenderOffers.companyId, ctx.company.id),
                lte(tenderOffers.startsAt, new Date()),
                gte(tenderOffers.endsAt, new Date()),
              ),
            ),
        ),
      ),
    )
    .returning();
  if (result.length === 0) return c.json({ error: "Not Found" }, 404);

  return c.json({ success: true });
});

export { app as tenderOfferBidsRouter };
