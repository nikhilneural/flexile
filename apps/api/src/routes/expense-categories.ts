import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { Env } from "@/env";
import { expenseCategories } from "@/db/schema";
import { authMiddleware } from "@/middleware/auth";
import { companyMiddleware } from "@/middleware/company";

const app = new Hono<{ Bindings: Env }>();

// GET /api/companies/:companyId/expense-categories
app.get("/:companyId/expense-categories", authMiddleware, companyMiddleware, async (c) => {
  const ctx = c.get("company");
  if (!ctx.companyAdministrator && !ctx.companyContractor) return c.json({ error: "Forbidden" }, 403);

  const results = await ctx.db.query.expenseCategories.findMany({
    where: eq(expenseCategories.companyId, ctx.company.id),
    columns: { id: true, name: true, expenseAccountId: true },
  });

  return c.json(results);
});

// PUT /api/companies/:companyId/expense-categories/:id
app.put(
  "/:companyId/expense-categories/:id",
  authMiddleware,
  companyMiddleware,
  zValidator("json", z.object({ expenseAccountId: z.string() })),
  async (c) => {
    const ctx = c.get("company");
    const id = c.req.param("id");
    const { expenseAccountId } = c.req.valid("json");

    if (!ctx.companyAdministrator) return c.json({ error: "Forbidden" }, 403);

    const [row] = await ctx.db
      .update(expenseCategories)
      .set({ expenseAccountId })
      .where(and(eq(expenseCategories.id, BigInt(id)), eq(expenseCategories.companyId, ctx.company.id)))
      .returning();
    if (!row) return c.json({ error: "Not Found" }, 404);

    return c.json({ success: true });
  },
);

export { app as expenseCategoriesRouter };
