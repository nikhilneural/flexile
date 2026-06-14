import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { isFuture, parseISO } from "date-fns";
import { and, desc, eq, gte, isNotNull, isNull, lte, or } from "drizzle-orm";
import { pick, truncate } from "lodash-es";
import { z } from "zod";
import type { Env } from "@/env";
import { pagination } from "@/db";
import { companyMonthlyFinancialReports, companyUpdates } from "@/db/schema";
import { authMiddleware } from "@/middleware/auth";
import { companyMiddleware } from "@/middleware/company";
import { assertDefined } from "@/utils/assert";

const isActive = (contractor: { endedAt: Date | null } | null): boolean =>
  !!contractor && (!contractor.endedAt || isFuture(contractor.endedAt));

// Simple tiptap text renderer
const renderTiptapToText = (body: unknown): string => {
  if (!body || typeof body !== "object") return "";
  const doc = body as { content?: Array<{ content?: Array<{ text?: string }> }> };
  if (!doc.content) return "";
  return doc.content
    .map((node) => (node.content ? node.content.map((n) => n.text ?? "").join("") : ""))
    .join("\n");
};

const app = new Hono<{ Bindings: Env }>();

// GET /api/companies/:companyId/company-updates
app.get(
  "/:companyId/company-updates",
  authMiddleware,
  companyMiddleware,
  zValidator("query", z.object({ page: z.coerce.number().optional(), perPage: z.coerce.number().optional() })),
  async (c) => {
    const ctx = c.get("company");
    const input = c.req.valid("query");

    if (
      !ctx.company.companyUpdatesEnabled ||
      (!ctx.companyAdministrator && !isActive(ctx.companyContractor) && !ctx.companyInvestor)
    )
      return c.json({ error: "Forbidden" }, 403);

    const where = and(
      eq(companyUpdates.companyId, ctx.company.id),
      ctx.companyAdministrator ? undefined : isNotNull(companyUpdates.sentAt),
    );
    const paginationInput = input.page && input.perPage ? { page: input.page, perPage: input.perPage } : {};
    const rows = await ctx.db.query.companyUpdates.findMany({
      where,
      ...pagination(paginationInput),
      orderBy: desc(companyUpdates.createdAt),
    });
    const total = await ctx.db.$count(companyUpdates, where);

    const updates = rows.map((update) => ({
      ...pick(update, ["title", "sentAt"]),
      id: update.externalId,
      summary: truncate(renderTiptapToText(update.body), { length: 300 }),
    }));

    return c.json({ updates, total });
  },
);

// GET /api/companies/:companyId/company-updates/:id
app.get("/:companyId/company-updates/:id", authMiddleware, companyMiddleware, async (c) => {
  const ctx = c.get("company");
  const id = c.req.param("id");

  if (
    !ctx.company.companyUpdatesEnabled ||
    (!ctx.companyAdministrator && !isActive(ctx.companyContractor) && !ctx.companyInvestor)
  )
    return c.json({ error: "Forbidden" }, 403);

  const update = await ctx.db.query.companyUpdates.findFirst({
    where: and(eq(companyUpdates.companyId, ctx.company.id), eq(companyUpdates.externalId, id)),
  });
  if (!update) return c.json({ error: "Not Found" }, 404);

  const financialReports = await getFinancialReports(ctx.db, update);

  return c.json({
    ...pick(update, [
      "title",
      "body",
      "videoUrl",
      "period",
      "periodStartedOn",
      "showRevenue",
      "showNetIncome",
      "sentAt",
    ]),
    financialReports,
    id: update.externalId,
  });
});

// POST /api/companies/:companyId/company-updates
app.post(
  "/:companyId/company-updates",
  authMiddleware,
  companyMiddleware,
  zValidator(
    "json",
    z.object({
      title: z.string(),
      body: z.unknown(),
      videoUrl: z.string().nullable().optional(),
      period: z.string(),
      periodStartedOn: z.string(),
      showRevenue: z.boolean(),
      showNetIncome: z.boolean(),
    }),
  ),
  async (c) => {
    const ctx = c.get("company");
    const input = c.req.valid("json");

    if (!ctx.companyAdministrator) return c.json({ error: "Forbidden" }, 403);

    const [update] = await ctx.db
      .insert(companyUpdates)
      .values({
        ...pick(input, ["title", "body", "videoUrl", "period", "periodStartedOn", "showRevenue", "showNetIncome"]),
        companyId: ctx.company.id,
      })
      .returning();

    return c.json({ id: assertDefined(update).externalId }, 201);
  },
);

// PUT /api/companies/:companyId/company-updates/:id
app.put(
  "/:companyId/company-updates/:id",
  authMiddleware,
  companyMiddleware,
  zValidator(
    "json",
    z.object({
      title: z.string().optional(),
      body: z.unknown().optional(),
      videoUrl: z.string().nullable().optional(),
      period: z.string().optional(),
      periodStartedOn: z.string().optional(),
      showRevenue: z.boolean().optional(),
      showNetIncome: z.boolean().optional(),
    }),
  ),
  async (c) => {
    const ctx = c.get("company");
    const id = c.req.param("id");
    const input = c.req.valid("json");

    if (!ctx.companyAdministrator) return c.json({ error: "Forbidden" }, 403);

    const [update] = await ctx.db
      .update(companyUpdates)
      .set(pick(input, ["title", "body", "videoUrl", "period", "periodStartedOn", "showRevenue", "showNetIncome"]))
      .where(and(eq(companyUpdates.companyId, ctx.company.id), eq(companyUpdates.externalId, id)))
      .returning();
    if (!update) return c.json({ error: "Not Found" }, 404);

    return c.json({ success: true });
  },
);

// POST /api/companies/:companyId/company-updates/:id/publish
app.post("/:companyId/company-updates/:id/publish", authMiddleware, companyMiddleware, async (c) => {
  const ctx = c.get("company");
  const id = c.req.param("id");

  if (!ctx.companyAdministrator) return c.json({ error: "Forbidden" }, 403);

  const [update] = await ctx.db
    .update(companyUpdates)
    .set({ sentAt: new Date() })
    .where(
      and(eq(companyUpdates.companyId, ctx.company.id), eq(companyUpdates.externalId, id), isNull(companyUpdates.sentAt)),
    )
    .returning();

  if (!update) return c.json({ error: "Not Found" }, 404);

  return c.json({ id: update.externalId });
});

// DELETE /api/companies/:companyId/company-updates/:id
app.delete("/:companyId/company-updates/:id", authMiddleware, companyMiddleware, async (c) => {
  const ctx = c.get("company");
  const id = c.req.param("id");

  if (!ctx.companyAdministrator) return c.json({ error: "Forbidden" }, 403);

  const result = await ctx.db
    .delete(companyUpdates)
    .where(and(eq(companyUpdates.companyId, ctx.company.id), eq(companyUpdates.externalId, id)))
    .returning();
  if (result.length === 0) return c.json({ error: "Not Found" }, 404);

  return c.json({ success: true });
});

const getFinancialReports = async (db: any, update: typeof companyUpdates.$inferSelect) => {
  const periodStartedOn = update.periodStartedOn != null ? parseISO(update.periodStartedOn) : null;
  if (periodStartedOn == null) return [];
  const month = periodStartedOn.getMonth() + 1;
  const year = periodStartedOn.getFullYear();
  return await db
    .select({
      ...pick(companyMonthlyFinancialReports, "month", "year"),
      ...(update.showRevenue ? pick(companyMonthlyFinancialReports, "revenueCents") : {}),
      ...(update.showNetIncome ? pick(companyMonthlyFinancialReports, "netIncomeCents") : {}),
    })
    .from(companyMonthlyFinancialReports)
    .where(
      and(
        eq(companyMonthlyFinancialReports.companyId, update.companyId),
        or(eq(companyMonthlyFinancialReports.year, year), eq(companyMonthlyFinancialReports.year, year - 1)),
        gte(companyMonthlyFinancialReports.month, month),
        lte(
          companyMonthlyFinancialReports.month,
          month + (update.period === "month" ? 0 : update.period === "quarter" ? 2 : 11),
        ),
      ),
    );
};

export { app as companyUpdatesRouter };
