import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { Env } from "@/env";
import { authMiddleware } from "@/middleware/auth";

const settingsRouter = new Hono<{ Bindings: Env }>();

settingsRouter.use("*", authMiddleware);

// Bank Accounts

/** GET /internal/settings/bank-accounts - List bank accounts */
settingsRouter.get("/bank-accounts", async (c) => {
  return c.json({ bank_accounts: [] });
});

const bankAccountUpdateSchema = z.object({
  bank_account: z.object({
    used_for_invoices: z.boolean().optional(),
    used_for_dividends: z.boolean().optional(),
  }),
});

/** PUT /internal/settings/bank-accounts/:id - Update bank account preferences */
settingsRouter.put("/bank-accounts/:id", zValidator("json", bankAccountUpdateSchema), async (c) => {
  const bankAccountId = c.req.param("id");
  const { bank_account } = c.req.valid("json");
  // Business logic: toggle used_for_invoices / used_for_dividends
  return c.json({ success: true });
});

// Dividend settings

/** GET /internal/settings/dividend - Get dividend settings */
settingsRouter.get("/dividend", async (c) => {
  return c.json({ settings: {} });
});

const dividendUpdateSchema = z.object({
  user: z.object({
    minimum_dividend_payment_in_cents: z.number(),
  }),
});

/** PUT /internal/settings/dividend - Update dividend settings */
settingsRouter.put("/dividend", zValidator("json", dividendUpdateSchema), async (c) => {
  const { user } = c.req.valid("json");
  return c.json({ success: true });
});

// Tax settings

/** GET /internal/settings/tax - Get tax settings */
settingsRouter.get("/tax", async (c) => {
  return c.json({ settings: {} });
});

const taxUpdateSchema = z.object({
  birth_date: z.string().optional(),
  business_entity: z.boolean().optional(),
  business_name: z.string().optional(),
  business_type: z.string().optional(),
  tax_classification: z.string().optional(),
  citizenship_country_code: z.string().optional(),
  city: z.string().optional(),
  country_code: z.string().optional(),
  legal_name: z.string().optional(),
  signature: z.string().optional(),
  state: z.string().optional(),
  street_address: z.string().optional(),
  tax_id: z.string().optional(),
  zip_code: z.string().optional(),
});

/** PUT /internal/settings/tax - Update tax settings */
settingsRouter.put("/tax", zValidator("json", taxUpdateSchema), async (c) => {
  const body = c.req.valid("json");
  // Business logic: UpdateUser with confirm_tax_info, regenerate consulting contracts if needed
  return c.json({ documentIds: [] });
});

export { settingsRouter };
