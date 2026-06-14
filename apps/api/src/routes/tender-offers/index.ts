import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, sql } from "drizzle-orm";
import { pick } from "lodash-es";
import { z } from "zod";
import type { Env } from "@/env";
import { paginate } from "@/db";
import {
  activeStorageAttachments,
  activeStorageBlobs,
  companies,
  tenderOffers,
} from "@/db/schema";
import { authMiddleware } from "@/middleware/auth";
import { companyMiddleware } from "@/middleware/company";

const app = new Hono<{ Bindings: Env }>();

// POST /api/companies/:companyId/tender-offers
app.post(
  "/:companyId/tender-offers",
  authMiddleware,
  companyMiddleware,
  zValidator(
    "json",
    z.object({
      startsAt: z.string(),
      endsAt: z.string(),
      minimumValuation: z.number(),
      attachmentKey: z.string(),
    }),
  ),
  async (c) => {
    const ctx = c.get("company");
    const input = c.req.valid("json");

    if (!ctx.company.tenderOffersEnabled || !ctx.companyAdministrator)
      return c.json({ error: "Forbidden" }, 403);

    await ctx.db.transaction(async (tx) => {
      const blob = await tx.query.activeStorageBlobs.findFirst({
        where: eq(activeStorageBlobs.key, input.attachmentKey),
      });
      if (!blob) return c.json({ error: "Attachment not found" }, 404);

      const [tenderOffer] = await tx
        .insert(tenderOffers)
        .values({
          companyId: ctx.company.id,
          startsAt: new Date(input.startsAt),
          endsAt: new Date(input.endsAt),
          minimumValuation: input.minimumValuation,
        })
        .returning();
      if (!tenderOffer) return c.json({ error: "Internal error" }, 500);

      await tx.insert(activeStorageAttachments).values({
        name: "attachment",
        blobId: blob.id,
        recordType: "TenderOffer",
        recordId: tenderOffer.id,
      });
    });

    return c.json({ success: true }, 201);
  },
);

// GET /api/companies/:companyId/tender-offers
app.get(
  "/:companyId/tender-offers",
  authMiddleware,
  companyMiddleware,
  zValidator("query", z.object({ page: z.coerce.number().optional(), perPage: z.coerce.number().optional() })),
  async (c) => {
    const ctx = c.get("company");
    const input = c.req.valid("query");

    if (!ctx.company.tenderOffersEnabled || (!ctx.companyAdministrator && !ctx.companyInvestor))
      return c.json({ error: "Forbidden" }, 403);

    const query = ctx.db
      .select({
        ...pick(tenderOffers, "startsAt", "endsAt", "minimumValuation"),
        id: tenderOffers.externalId,
      })
      .from(tenderOffers)
      .innerJoin(companies, eq(tenderOffers.companyId, companies.id))
      .where(eq(companies.id, ctx.company.id))
      .orderBy(desc(tenderOffers.createdAt));

    const total = await ctx.db.$count(query.as("tenderOffers"));
    const paginationInput = input.page && input.perPage ? { page: input.page, perPage: input.perPage } : {};

    return c.json({ tenderOffers: await paginate(query, paginationInput), total });
  },
);

// GET /api/companies/:companyId/tender-offers/:id
app.get("/:companyId/tender-offers/:id", authMiddleware, companyMiddleware, async (c) => {
  const ctx = c.get("company");
  const id = c.req.param("id");

  if (!ctx.company.tenderOffersEnabled || (!ctx.companyAdministrator && !ctx.companyInvestor))
    return c.json({ error: "Forbidden" }, 403);

  const tenderOffer = await ctx.db.query.tenderOffers.findFirst({
    columns: { id: true, startsAt: true, endsAt: true, minimumValuation: true },
    where: and(eq(tenderOffers.externalId, id), eq(tenderOffers.companyId, ctx.company.id)),
  });
  if (!tenderOffer) return c.json({ error: "Not Found" }, 404);

  const attachment = await ctx.db.query.activeStorageAttachments.findFirst({
    where: sql`record_type = 'TenderOffer' AND record_id = ${tenderOffer.id}`,
    with: { blob: true },
  });

  return c.json({
    ...pick(tenderOffer, ["startsAt", "endsAt", "minimumValuation"]),
    attachment: attachment
      ? `https://${c.env.S3_PRIVATE_BUCKET}.s3.amazonaws.com/${attachment.blob.key}`
      : null,
  });
});

export { app as tenderOffersRouter };
