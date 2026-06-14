import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { pick } from "lodash-es";
import { z } from "zod";
import type { Env } from "@/env";
import { byExternalId, createDb } from "@/db";
import { PayRateType, RoleApplicationStatus } from "@/db/enums";
import { companies, companyRoleApplications, companyRoleRates, companyRoles, expenseCards } from "@/db/schema";
import { authMiddleware } from "@/middleware/auth";
import { companyMiddleware } from "@/middleware/company";
import { assertDefined } from "@/utils/assert";

const app = new Hono<{ Bindings: Env }>();

// GET /api/companies/:companyId/roles
app.get("/:companyId/roles", authMiddleware, companyMiddleware, async (c) => {
  const ctx = c.get("company");
  if (!ctx.companyAdministrator) return c.json({ error: "Forbidden" }, 403);

  const roles = await ctx.db.query.companyRoles.findMany({
    where: and(eq(companyRoles.companyId, ctx.company.id), isNull(companyRoles.deletedAt)),
    with: {
      rates: { orderBy: [desc(companyRoleRates.createdAt)], limit: 1 },
    },
    orderBy: [desc(companyRoles.createdAt)],
  });

  return c.json(
    roles.map((role) => {
      const rate = assertDefined(role.rates[0]);
      return {
        id: role.externalId,
        ...pick(
          role,
          "name",
          "jobDescription",
          "activelyHiring",
          "capitalizedExpense",
          "expenseAccountId",
          "expenseCardEnabled",
          "expenseCardSpendingLimitCents",
          "trialEnabled",
        ),
        ...pick(rate, "payRateType", "payRateInSubunits", "trialPayRateInSubunits"),
      };
    }),
  );
});

// GET /api/companies/:companyId/roles/:id
app.get("/:companyId/roles/:id", authMiddleware, companyMiddleware, async (c) => {
  const ctx = c.get("company");
  const id = c.req.param("id");

  if (!ctx.companyAdministrator) return c.json({ error: "Forbidden" }, 403);

  const [role] = await ctx.db
    .select({
      ...pick(companyRoles, "id", "name", "jobDescription", "activelyHiring", "capitalizedExpense"),
      ...pick(companyRoleRates, "payRateType", "payRateInSubunits", "trialPayRateInSubunits"),
    })
    .from(companyRoles)
    .innerJoin(companyRoleRates, eq(companyRoles.id, companyRoleRates.companyRoleId))
    .where(and(eq(companyRoles.companyId, ctx.company.id), eq(companyRoles.externalId, id)))
    .orderBy(desc(companyRoleRates.createdAt))
    .limit(1);

  if (!role) return c.json({ error: "Not Found" }, 404);

  return c.json(role);
});

// POST /api/companies/:companyId/roles
app.post(
  "/:companyId/roles",
  authMiddleware,
  companyMiddleware,
  zValidator(
    "json",
    z.object({
      name: z.string(),
      jobDescription: z.string().optional(),
      activelyHiring: z.boolean(),
      capitalizedExpense: z.boolean().optional(),
      expenseAccountId: z.string().optional(),
      expenseCardEnabled: z.boolean().optional(),
      expenseCardSpendingLimitCents: z.number().optional(),
      trialEnabled: z.boolean().optional(),
      payRateInSubunits: z.number(),
      payRateType: z.nativeEnum(PayRateType),
      trialPayRateInSubunits: z.number().optional(),
    }),
  ),
  async (c) => {
    const ctx = c.get("company");
    const input = c.req.valid("json");

    if (!ctx.companyAdministrator) return c.json({ error: "Forbidden" }, 403);

    const externalId = await ctx.db.transaction(async (tx) => {
      const result = await tx
        .insert(companyRoles)
        .values({
          companyId: ctx.company.id,
          ...pick(
            input,
            "name",
            "jobDescription",
            "activelyHiring",
            "capitalizedExpense",
            "expenseAccountId",
            "expenseCardEnabled",
            "expenseCardSpendingLimitCents",
            "trialEnabled",
          ),
        })
        .returning(pick(companyRoles, "id", "externalId"));

      const role = assertDefined(result[0]);
      await tx.insert(companyRoleRates).values({
        companyRoleId: role.id,
        ...pick(input, "payRateType", "payRateInSubunits", "trialPayRateInSubunits"),
        payRateCurrency: "usd",
      });

      return role.externalId;
    });

    return c.json({ id: externalId }, 201);
  },
);

// PUT /api/companies/:companyId/roles/:id
app.put(
  "/:companyId/roles/:id",
  authMiddleware,
  companyMiddleware,
  zValidator(
    "json",
    z.object({
      name: z.string().optional(),
      jobDescription: z.string().optional(),
      activelyHiring: z.boolean().optional(),
      capitalizedExpense: z.boolean().optional(),
      expenseAccountId: z.string().optional(),
      expenseCardEnabled: z.boolean().optional(),
      expenseCardSpendingLimitCents: z.number().optional(),
      trialEnabled: z.boolean().optional(),
      payRateInSubunits: z.number().optional(),
      payRateType: z.nativeEnum(PayRateType).optional(),
      trialPayRateInSubunits: z.number().optional(),
    }),
  ),
  async (c) => {
    const ctx = c.get("company");
    const id = c.req.param("id");
    const input = c.req.valid("json");

    if (!ctx.companyAdministrator) return c.json({ error: "Forbidden" }, 403);

    await ctx.db.transaction(async (tx) => {
      const [role] = await tx
        .update(companyRoles)
        .set(
          pick(
            input,
            "name",
            "jobDescription",
            "activelyHiring",
            "capitalizedExpense",
            "expenseAccountId",
            "expenseCardEnabled",
            "expenseCardSpendingLimitCents",
            "trialEnabled",
          ),
        )
        .where(and(eq(companyRoles.externalId, id), eq(companyRoles.companyId, ctx.company.id)))
        .returning({ id: companyRoles.id, externalId: companyRoles.externalId });

      if (!role) return c.json({ error: "Not Found" }, 404);

      await tx
        .update(companyRoleRates)
        .set({
          companyRoleId: role.id,
          ...pick(input, "payRateType", "payRateInSubunits", "trialPayRateInSubunits"),
          payRateCurrency: "usd",
        })
        .where(eq(companyRoleRates.companyRoleId, role.id));
    });

    return c.json({ success: true });
  },
);

// DELETE /api/companies/:companyId/roles/:id
app.delete("/:companyId/roles/:id", authMiddleware, companyMiddleware, async (c) => {
  const ctx = c.get("company");
  const id = c.req.param("id");

  if (!ctx.companyAdministrator) return c.json({ error: "Forbidden" }, 403);

  const [result] = await ctx.db
    .update(companyRoles)
    .set({ deletedAt: new Date() })
    .where(and(eq(companyRoles.externalId, id), eq(companyRoles.companyId, ctx.company.id)))
    .returning();

  if (!result) return c.json({ error: "Not Found" }, 404);
  return c.json({ success: true });
});

// GET /api/roles/public (no auth needed)
app.get(
  "/public",
  zValidator("query", z.object({ companyId: z.string() })),
  async (c) => {
    const { companyId } = c.req.valid("query");
    const db = createDb(c.env);

    const result = await db.query.companyRoles.findMany({
      where: and(
        eq(companyRoles.companyId, byExternalId(companies, companyId)),
        eq(companyRoles.activelyHiring, true),
        isNull(companyRoles.deletedAt),
      ),
      with: {
        rates: {
          columns: { payRateType: true, payRateInSubunits: true },
          orderBy: [desc(companyRoleRates.createdAt)],
          limit: 1,
        },
      },
    });

    return c.json(
      result.map((role) => {
        const rate = assertDefined(role.rates[0]);
        return { id: role.externalId, name: role.name, ...rate };
      }),
    );
  },
);

// GET /api/roles/public/:id (no auth needed)
app.get("/public/:id", async (c) => {
  const id = c.req.param("id");
  const db = createDb(c.env);

  const [result] = await db
    .select({
      ...pick(
        companyRoles,
        "name",
        "jobDescription",
        "trialEnabled",
        "activelyHiring",
        "expenseCardEnabled",
        "expenseCardSpendingLimitCents",
      ),
      id: companyRoles.externalId,
      ...pick(companyRoleRates, "payRateType", "payRateInSubunits", "trialPayRateInSubunits"),
      companyId: companies.externalId,
    })
    .from(companyRoles)
    .innerJoin(companyRoleRates, eq(companyRoleRates.companyRoleId, companyRoles.id))
    .innerJoin(companies, eq(companies.id, companyRoles.companyId))
    .where(and(eq(companyRoles.externalId, id), isNull(companyRoles.deletedAt)))
    .orderBy(desc(companyRoleRates.createdAt))
    .limit(1);
  if (!result) return c.json({ error: "Not Found" }, 404);

  return c.json(result);
});

export { app as rolesRouter };
