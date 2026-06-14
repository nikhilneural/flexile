import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import type { Env } from "@/env";
import { integrations } from "@/db/schema";
import { authMiddleware } from "@/middleware/auth";
import { companyMiddleware } from "@/middleware/company";
import { assert, assertDefined } from "@/utils/assert";

const app = new Hono<{ Bindings: Env }>();

const companyIntegration = async (db: any, companyId: bigint) => {
  const integration = await db.query.integrations.findFirst({
    where: and(
      eq(integrations.companyId, companyId),
      eq(integrations.type, "QuickbooksIntegration"),
      isNull(integrations.deletedAt),
    ),
  });
  if (!integration) return null;
  assert(!!integration.configuration && "default_bank_account_id" in integration.configuration);
  return { ...integration, configuration: integration.configuration };
};

// GET /api/companies/:companyId/quickbooks
app.get("/:companyId/quickbooks", authMiddleware, companyMiddleware, async (c) => {
  const ctx = c.get("company");
  if (!ctx.companyAdministrator) return c.json({ error: "Forbidden" }, 403);

  const integration = await companyIntegration(ctx.db, ctx.company.id);
  if (!integration) return c.json(null);

  return c.json({
    status: integration.status,
    consultingServicesExpenseAccountId: integration.configuration.consulting_services_expense_account_id,
    flexileFeesExpenseAccountId: integration.configuration.flexile_fees_expense_account_id,
    equityCompensationExpenseAccountId: integration.configuration.equity_compensation_expense_account_id,
    defaultBankAccountId: integration.configuration.default_bank_account_id,
  });
});

// POST /api/companies/:companyId/quickbooks/connect
app.post(
  "/:companyId/quickbooks/connect",
  authMiddleware,
  companyMiddleware,
  zValidator("json", z.object({ code: z.string(), state: z.string(), realmId: z.string() })),
  async (c) => {
    const ctx = c.get("company");
    const input = c.req.valid("json");

    if (!ctx.companyAdministrator) return c.json({ error: "Forbidden" }, 403);

    // Encode state for OAuth verification (globalThis.btoa is available in Workers)
    const stateStr = `${ctx.company.id}:${ctx.company.name}`;
    const expectedState = globalThis.btoa(stateStr);
    if (input.state !== expectedState) return c.json({ error: "Invalid OAuth state" }, 400);

    const integration = await companyIntegration(ctx.db, ctx.company.id);

    if (integration) {
      await ctx.db
        .update(integrations)
        .set({
          status: integration.status === "out_of_sync" ? "active" : integration.status,
          configuration: { ...integration.configuration },
        })
        .where(eq(integrations.id, integration.id));
    } else {
      await ctx.db.insert(integrations).values({
        type: "QuickbooksIntegration",
        accountId: input.realmId,
        companyId: ctx.company.id,
        status: "initialized",
        configuration: {
          consulting_services_expense_account_id: null,
          flexile_fees_expense_account_id: null,
          default_bank_account_id: null,
          equity_compensation_expense_account_id: null,
        },
      });
    }

    return c.json({ success: true });
  },
);

// POST /api/companies/:companyId/quickbooks/disconnect
app.post("/:companyId/quickbooks/disconnect", authMiddleware, companyMiddleware, async (c) => {
  const ctx = c.get("company");
  if (!ctx.companyAdministrator) return c.json({ error: "Forbidden" }, 403);

  const integration = await companyIntegration(ctx.db, ctx.company.id);
  if (!integration) return c.json({ error: "Not Found" }, 404);

  await ctx.db
    .update(integrations)
    .set({ deletedAt: new Date(), status: "deleted" })
    .where(eq(integrations.id, integration.id));

  return c.json({ success: true });
});

// PUT /api/companies/:companyId/quickbooks/configuration
app.put(
  "/:companyId/quickbooks/configuration",
  authMiddleware,
  companyMiddleware,
  zValidator(
    "json",
    z.object({
      consultingServicesExpenseAccountId: z.string(),
      flexileFeesExpenseAccountId: z.string(),
      equityCompensationExpenseAccountId: z.string().optional(),
      defaultBankAccountId: z.string(),
    }),
  ),
  async (c) => {
    const ctx = c.get("company");
    const input = c.req.valid("json");

    if (!ctx.companyAdministrator) return c.json({ error: "Forbidden" }, 403);

    const integration = await companyIntegration(ctx.db, ctx.company.id);
    if (!integration) return c.json({ error: "Not Found" }, 404);

    await ctx.db
      .update(integrations)
      .set({
        configuration: {
          ...integration.configuration,
          consulting_services_expense_account_id: input.consultingServicesExpenseAccountId,
          flexile_fees_expense_account_id: input.flexileFeesExpenseAccountId,
          equity_compensation_expense_account_id: input.equityCompensationExpenseAccountId ?? null,
          default_bank_account_id: input.defaultBankAccountId,
        },
      })
      .where(eq(integrations.id, integration.id));

    return c.json({ success: true });
  },
);

export { app as quickbooksRouter };
