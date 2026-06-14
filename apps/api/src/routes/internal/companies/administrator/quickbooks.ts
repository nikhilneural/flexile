import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { Env } from "@/env";

const adminQuickbooksRouter = new Hono<{ Bindings: Env }>();

const connectSchema = z.object({
  code: z.string(),
  state: z.string(),
  realmId: z.string(),
});

/** POST /internal/companies/:companyId/administrator/quickbooks/connect - Connect QuickBooks */
adminQuickbooksRouter.post("/connect", zValidator("json", connectSchema), async (c) => {
  const { code, state, realmId } = c.req.valid("json");
  // Business logic: IntegrationApi::Quickbooks OAuth flow
  return c.json({
    success: true,
    quickbooks_integration: {},
    expense_accounts: [],
    bank_accounts: [],
  });
});

/** POST /internal/companies/:companyId/administrator/quickbooks/disconnect - Disconnect QuickBooks */
adminQuickbooksRouter.post("/disconnect", async (c) => {
  // Business logic: revoke token and mark integration as deleted
  return c.json({ success: true });
});

const updateSchema = z.object({
  quickbooks_integration: z.object({
    consulting_services_expense_account_id: z.string().optional(),
    flexile_fees_expense_account_id: z.string().optional(),
    default_bank_account_id: z.string().optional(),
    equity_compensation_expense_account_id: z.string().optional(),
  }),
  company: z
    .object({
      expense_categories_attributes: z
        .array(
          z.object({
            id: z.string().optional(),
            expense_account_id: z.string().optional(),
          }),
        )
        .optional(),
    })
    .optional(),
});

/** PUT /internal/companies/:companyId/administrator/quickbooks - Update QuickBooks settings */
adminQuickbooksRouter.put("/", zValidator("json", updateSchema), async (c) => {
  const body = c.req.valid("json");
  // Business logic: update integration + company expense categories
  return c.json({ success: true, quickbooks_integration: {} });
});

/** GET /internal/companies/:companyId/administrator/quickbooks/accounts - List expense accounts */
adminQuickbooksRouter.get("/accounts", async (c) => {
  // Business logic: QuickBooks API get_expense_accounts
  return c.json({ accounts: [] });
});

export { adminQuickbooksRouter };
