import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { subYears } from "date-fns";
import { and, eq, gt, gte, isNotNull, isNull, sql } from "drizzle-orm";
import { pick } from "lodash-es";
import { z } from "zod";
import type { Env } from "@/env";
import { createDb } from "@/db";
import { PayRateType } from "@/db/enums";
import {
  activeStorageAttachments,
  activeStorageBlobs,
  companies,
  companyContractors,
  invoices,
  users,
} from "@/db/schema";
import { authMiddleware } from "@/middleware/auth";
import { companyMiddleware } from "@/middleware/company";
import { assertDefined } from "@/utils/assert";

export const companyName = (company: Pick<typeof companies.$inferSelect, "publicName" | "name">) =>
  company.publicName ?? company.name;

const app = new Hono<{ Bindings: Env }>();

// GET /api/companies/:companyId/settings
app.get("/:companyId/settings", authMiddleware, companyMiddleware, async (c) => {
  const ctx = c.get("company");
  if (!ctx.companyAdministrator) return c.json({ error: "Forbidden" }, 403);

  return c.json(
    pick(ctx.company, [
      "taxId",
      "brandColor",
      "website",
      "description",
      "showStatsInJobDescriptions",
      "name",
      "phoneNumber",
    ]),
  );
});

// PUT /api/companies/:companyId
app.put(
  "/:companyId",
  authMiddleware,
  companyMiddleware,
  zValidator(
    "json",
    z.object({
      name: z.string().optional(),
      taxId: z.string().optional(),
      phoneNumber: z.string().optional(),
      streetAddress: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      zipCode: z.string().optional(),
      publicName: z.string().optional(),
      website: z.string().optional(),
      description: z.string().optional(),
      brandColor: z
        .string()
        .regex(/^#([0-9A-F]{6})$/iu, "Invalid hex color")
        .optional(),
      showStatsInJobDescriptions: z.boolean().optional(),
      sharePriceInUsd: z.string().optional(),
      fmvPerShareInUsd: z.string().optional(),
      conversionSharePriceUsd: z.string().optional(),
      logoKey: z.string().optional(),
    }),
  ),
  async (c) => {
    const ctx = c.get("company");
    if (!ctx.companyAdministrator) return c.json({ error: "Forbidden" }, 403);

    const input = c.req.valid("json");

    await ctx.db.transaction(async (tx) => {
      const { logoKey, ...updateData } = input;
      await tx.update(companies).set(updateData).where(eq(companies.id, ctx.company.id));

      if (logoKey) {
        const companyLogoWhere = and(
          eq(activeStorageAttachments.recordType, "Company"),
          eq(activeStorageAttachments.recordId, ctx.company.id),
          eq(activeStorageAttachments.name, "logo"),
        );
        await tx.delete(activeStorageAttachments).where(companyLogoWhere);
        const blob = await tx.query.activeStorageBlobs.findFirst({
          where: eq(activeStorageBlobs.key, logoKey),
        });
        if (!blob) return c.json({ error: "Logo not found" }, 404);
        await tx.insert(activeStorageAttachments).values({
          name: "logo",
          blobId: blob.id,
          recordType: "Company",
          recordId: ctx.company.id,
        });
      }
    });

    return c.json({ success: true });
  },
);

// GET /api/companies/:companyId/public-info
app.get(
  "/:companyId/public-info",
  zValidator("param", z.object({ companyId: z.string() })),
  async (c) => {
    const { companyId } = c.req.valid("param");
    const db = createDb(c.env);

    const company = await db.query.companies.findFirst({
      where: eq(companies.externalId, companyId),
    });
    if (!company) return c.json({ error: "Not Found" }, 404);

    const logo = await db.query.activeStorageAttachments.findFirst({
      where: and(
        eq(activeStorageAttachments.recordType, "Company"),
        eq(activeStorageAttachments.recordId, company.id),
        eq(activeStorageAttachments.name, "logo"),
      ),
      with: { blob: true },
    });

    const logoUrl = logo?.blob ? `https://${c.env.S3_PUBLIC_BUCKET}.s3.amazonaws.com/${logo.blob.key}` : null;

    const response = {
      ...pick(
        company,
        "website",
        "description",
        "equityGrantsEnabled",
        "expenseCardsEnabled",
        "sharePriceInUsd",
        "fmvPerShareInUsd",
      ),
      name: companyName(company),
      additionalSupportedCountries: company.isGumroad ? ["BR"] : [],
      logoUrl,
    };

    if (!company.showStatsInJobDescriptions) return c.json(response);

    const [avgTenure] = await db
      .select({
        avg: sql`
          AVG(EXTRACT(DAY FROM (COALESCE(${companyContractors.endedAt}, NOW()) - ${companyContractors.startedAt}))) / 365
        `.mapWith(Number),
      })
      .from(companyContractors)
      .where(
        and(
          eq(companyContractors.companyId, company.id),
          gt(
            db.$count(
              invoices,
              and(eq(invoices.companyContractorId, companyContractors.id), eq(invoices.status, "paid")),
            ),
            2,
          ),
        ),
      );

    const result = await db
      .select({
        totalHours: sql<number>`SUM(${invoices.totalMinutes} / 60.0)`.mapWith(Number),
        hoursPerWeek: companyContractors.hoursPerWeek,
      })
      .from(invoices)
      .innerJoin(companyContractors, eq(companyContractors.id, invoices.companyContractorId))
      .where(
        and(
          eq(companyContractors.companyId, company.id),
          isNull(companyContractors.endedAt),
          eq(companyContractors.payRateType, PayRateType.Hourly),
          gte(invoices.createdAt, subYears(new Date(), 1)),
          isNotNull(companyContractors.hoursPerWeek),
        ),
      )
      .groupBy(companyContractors.id)
      .having(sql`COUNT(${invoices.id}) > 2`);

    return c.json({
      ...response,
      stats: {
        freelancers: result.length,
        avgWeeksPerYear:
          result.reduce((sum, row) => sum + row.totalHours / (row.hoursPerWeek ?? 1), 0) / result.length,
        avgHoursPerWeek: result.reduce((sum, row) => sum + (row.hoursPerWeek ?? 0), 0) / result.length,
        avgTenure: assertDefined(avgTenure).avg,
        attritionRate: 1,
      },
    });
  },
);

export { app as companiesRouter };
