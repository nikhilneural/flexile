import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { Env } from "@/env";
import { expenseCards, users } from "@/db/schema";
import { authMiddleware } from "@/middleware/auth";
import { companyMiddleware } from "@/middleware/company";

const app = new Hono<{ Bindings: Env }>();

// GET /api/companies/:companyId/expense-cards/active
app.get("/:companyId/expense-cards/active", authMiddleware, companyMiddleware, async (c) => {
  const ctx = c.get("company");

  if (!ctx.companyContractor || !ctx.company.expenseCardsEnabled) return c.json({ error: "Forbidden" }, 403);

  const card = await ctx.db.query.expenseCards.findFirst({
    columns: {
      processorReference: true,
      processor: true,
      cardLast4: true,
      cardExpMonth: true,
      cardExpYear: true,
      cardBrand: true,
    },
    where: and(eq(expenseCards.companyContractorId, ctx.companyContractor.id), eq(expenseCards.active, true)),
  });

  return c.json({ card: card ?? null });
});

// POST /api/companies/:companyId/expense-cards
app.post("/:companyId/expense-cards", authMiddleware, companyMiddleware, async (c) => {
  const ctx = c.get("company");

  if (!ctx.companyContractor || !ctx.company.expenseCardsEnabled) return c.json({ error: "Forbidden" }, 403);

  const activeCardRow = await ctx.db.query.expenseCards.findFirst({
    where: and(eq(expenseCards.companyContractorId, ctx.companyContractor.id), eq(expenseCards.active, true)),
  });
  if (activeCardRow) return c.json({ error: "Already has an active card" }, 403);

  // In production this would call Stripe Issuing API
  // For now just create the record
  await ctx.db.insert(expenseCards).values({
    companyContractorId: ctx.companyContractor.id,
    companyRoleId: ctx.companyContractor.companyRoleId,
    processorReference: `card_${globalThis.crypto.randomUUID()}`,
    processor: "stripe",
    cardLast4: "0000",
    cardExpMonth: "12",
    cardExpYear: "2030",
    cardBrand: "visa",
    active: true,
  });

  return c.json({ success: true }, 201);
});

// POST /api/companies/:companyId/expense-cards/ephemeral-key
app.post(
  "/:companyId/expense-cards/ephemeral-key",
  authMiddleware,
  companyMiddleware,
  zValidator("json", z.object({ nonce: z.string(), processorReference: z.string() })),
  async (c) => {
    const ctx = c.get("company");
    const input = c.req.valid("json");

    if (!ctx.companyContractor || !ctx.company.expenseCardsEnabled) return c.json({ error: "Forbidden" }, 403);

    const cardRow = await ctx.db.query.expenseCards.findFirst({
      where: and(
        eq(expenseCards.companyContractorId, ctx.companyContractor.id),
        eq(expenseCards.processorReference, input.processorReference),
        eq(expenseCards.processor, "stripe"),
      ),
    });
    if (!cardRow) return c.json({ error: "Forbidden" }, 403);

    // In production this would call Stripe's ephemeral key API
    return c.json({ secret: `ek_${globalThis.crypto.randomUUID()}` });
  },
);

export { app as expenseCardsRouter };
