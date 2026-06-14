import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { Decimal } from "decimal.js";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { Env } from "@/env";
import { createDb, type Database } from "@/db";
import { equityAllocations } from "@/db/schema";
import { authMiddleware } from "@/middleware/auth";
import { companyMiddleware, type CompanyContext } from "@/middleware/company";
import { getUniqueUnvestedEquityGrantForYear } from "./equity-grants";

type CalculateEquityResult = {
  equityCents: number;
  equityOptions: number;
  selectedPercentage: number | null;
  equityPercentage: number;
  isEquityAllocationLocked: boolean | null;
} | null;

export const calculateInvoiceEquity = async ({
  db,
  companyContractor,
  serviceAmountCents,
  invoiceYear,
  equityCompensationEnabled,
  providedEquityPercentage,
}: {
  db: Database;
  companyContractor: CompanyContext["companyContractor"];
  serviceAmountCents: number | bigint;
  invoiceYear: number;
  equityCompensationEnabled: boolean;
  providedEquityPercentage?: number;
}): Promise<CalculateEquityResult> => {
  if (companyContractor === undefined) return null;

  let isEquityAllocationLocked = null;
  let selectedPercentage = null;
  let equityPercentage = 0;

  const serviceAmountCentsNumber =
    typeof serviceAmountCents === "bigint" ? Number(serviceAmountCents) : serviceAmountCents;

  if (providedEquityPercentage !== undefined) {
    equityPercentage = providedEquityPercentage;
    selectedPercentage = providedEquityPercentage;
  } else if (equityCompensationEnabled) {
    const equityAllocation = await db.query.equityAllocations.findFirst({
      where: and(
        eq(equityAllocations.companyContractorId, companyContractor.id),
        eq(equityAllocations.year, invoiceYear),
      ),
    });
    isEquityAllocationLocked = equityAllocation?.locked ?? null;
    if (equityAllocation?.equityPercentage) {
      selectedPercentage = equityAllocation.equityPercentage;
      equityPercentage = equityAllocation.equityPercentage;
    } else {
      equityPercentage = 0;
    }
  }

  const unvestedGrant = await getUniqueUnvestedEquityGrantForYear(db, companyContractor, invoiceYear);
  if (equityPercentage !== 0 && !unvestedGrant) return null;

  let equityAmountInCents = Decimal.mul(serviceAmountCentsNumber, equityPercentage).div(100).round().toNumber();
  let equityAmountInOptions = 0;

  if (equityPercentage !== 0 && unvestedGrant) {
    equityAmountInOptions = Decimal.div(equityAmountInCents, Decimal.mul(unvestedGrant.sharePriceUsd, 100))
      .round()
      .toNumber();
  }

  if (equityAmountInOptions <= 0) {
    equityPercentage = 0;
    equityAmountInCents = 0;
    equityAmountInOptions = 0;
  }

  return {
    equityCents: equityAmountInCents,
    equityOptions: equityAmountInOptions,
    selectedPercentage,
    equityPercentage,
    isEquityAllocationLocked,
  };
};

const app = new Hono<{ Bindings: Env }>();

// GET /api/companies/:companyId/equity-calculations
app.get(
  "/:companyId/equity-calculations",
  authMiddleware,
  companyMiddleware,
  zValidator(
    "query",
    z.object({
      servicesInCents: z.coerce.number(),
      invoiceYear: z.coerce.number().optional(),
    }),
  ),
  async (c) => {
    const ctx = c.get("company");
    const input = c.req.valid("query");

    if (!ctx.companyContractor) return c.json({ error: "Forbidden" }, 403);

    const result = await calculateInvoiceEquity({
      db: ctx.db,
      companyContractor: ctx.companyContractor,
      serviceAmountCents: input.servicesInCents,
      invoiceYear: input.invoiceYear ?? new Date().getFullYear(),
      equityCompensationEnabled: ctx.company.equityCompensationEnabled,
    });

    if (!result) {
      return c.json({ error: "Something went wrong. Please contact the company administrator." }, 400);
    }

    return c.json({
      amountInCents: result.equityCents,
      isEquityAllocationLocked: result.isEquityAllocationLocked,
      selectedPercentage: result.selectedPercentage,
    });
  },
);

export { app as equityCalculationsRouter };
