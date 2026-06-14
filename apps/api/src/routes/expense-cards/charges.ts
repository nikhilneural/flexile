import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, desc, eq } from "drizzle-orm";
import { pick } from "lodash-es";
import { z } from "zod";
import type { Env } from "@/env";
import { paginate } from "@/db";
import { companyContractors, companyRoles, expenseCardCharges, expenseCards, users } from "@/db/schema";
import { authMiddleware } from "@/middleware/auth";
import { companyMiddleware } from "@/middleware/company";
import { simpleUser } from "../users/helpers";

const app = new Hono<{ Bindings: Env }>();

// GET /api/companies/:companyId/expense-cards/charges
app.get(
  "/:companyId/expense-cards/charges",
  authMiddleware,
  companyMiddleware,
  zValidator(
    "query",
    z.object({
      contractorId: z.string().optional(),
      page: z.coerce.number().optional(),
      perPage: z.coerce.number().optional(),
    }),
  ),
  async (c) => {
    const ctx = c.get("company");
    const input = c.req.valid("query");

    if (!ctx.company.expenseCardsEnabled) return c.json({ error: "Forbidden" }, 403);
    if (!ctx.companyAdministrator && input.contractorId !== ctx.companyContractor?.externalId)
      return c.json({ error: "Forbidden" }, 403);

    const query = ctx.db
      .select({
        expenseCardCharge: pick(expenseCardCharges, [
          "id",
          "totalAmountInCents",
          "description",
          "processorTransactionData",
          "createdAt",
          "companyId",
        ]),
        contractor: pick(companyContractors, ["externalId"]),
        role: pick(companyRoles, ["name"]),
        user: users,
      })
      .from(expenseCardCharges)
      .innerJoin(expenseCards, eq(expenseCardCharges.expenseCardId, expenseCards.id))
      .innerJoin(companyContractors, eq(expenseCards.companyContractorId, companyContractors.id))
      .innerJoin(users, eq(companyContractors.userId, users.id))
      .innerJoin(companyRoles, eq(companyContractors.companyRoleId, companyRoles.id))
      .orderBy(desc(expenseCardCharges.createdAt))
      .where(
        and(
          input.contractorId ? eq(companyContractors.externalId, input.contractorId) : undefined,
          eq(expenseCardCharges.companyId, ctx.company.id),
        ),
      );

    const total = await ctx.db.$count(query.as("expenseCardCharges"));
    const paginationInput = input.page && input.perPage ? { page: input.page, perPage: input.perPage } : {};

    const items = (await paginate(query, paginationInput)).map((row) => ({
      ...row.expenseCardCharge,
      contractor: {
        id: row.contractor.externalId,
        role: row.role.name,
        user: simpleUser(row.user),
      },
    }));

    return c.json({ items, total });
  },
);

export { app as expenseCardChargesRouter };
