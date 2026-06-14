import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { isFuture } from "date-fns";
import { z } from "zod";
import type { Env } from "@/env";
import { byExternalId } from "@/db";
import { companyContractorAbsences, companyContractors } from "@/db/schema";
import { authMiddleware } from "@/middleware/auth";
import { companyMiddleware } from "@/middleware/company";
import { assert } from "@/utils/assert";

const isActive = (contractor: typeof companyContractors.$inferSelect | null): boolean =>
  !!contractor && (!contractor.endedAt || isFuture(contractor.endedAt));

const app = new Hono<{ Bindings: Env }>();

// GET /api/companies/:companyId/worker-absences
app.get(
  "/:companyId/worker-absences",
  authMiddleware,
  companyMiddleware,
  zValidator(
    "query",
    z.object({
      contractorId: z.string().optional(),
      from: z.string().optional(),
      to: z.string().optional(),
    }),
  ),
  async (c) => {
    const ctx = c.get("company");
    const input = c.req.valid("query");

    if (!ctx.companyAdministrator && !isActive(ctx.companyContractor)) return c.json({ error: "Forbidden" }, 403);

    const results = await ctx.db.query.companyContractorAbsences.findMany({
      columns: { id: true, startsOn: true, endsOn: true, companyContractorId: true },
      where: and(
        eq(companyContractorAbsences.companyId, ctx.company.id),
        input.from ? gte(companyContractorAbsences.endsOn, input.from) : undefined,
        input.to ? lte(companyContractorAbsences.startsOn, input.to) : undefined,
        input.contractorId
          ? eq(companyContractorAbsences.companyContractorId, byExternalId(companyContractors, input.contractorId))
          : undefined,
      ),
      orderBy: asc(companyContractorAbsences.startsOn),
    });

    return c.json(results);
  },
);

// POST /api/companies/:companyId/worker-absences
app.post(
  "/:companyId/worker-absences",
  authMiddleware,
  companyMiddleware,
  zValidator(
    "json",
    z.object({
      startsOn: z.string(),
      endsOn: z.string(),
      notes: z.string().optional(),
    }),
  ),
  async (c) => {
    const ctx = c.get("company");
    const input = c.req.valid("json");

    if (!isActive(ctx.companyContractor)) return c.json({ error: "Forbidden" }, 403);

    const [absence] = await ctx.db
      .insert(companyContractorAbsences)
      .values({
        companyId: ctx.company.id,
        companyContractorId: ctx.companyContractor!.id,
        startsOn: input.startsOn,
        endsOn: input.endsOn,
        notes: input.notes,
      })
      .returning();
    assert(absence != null);

    return c.json({ id: absence.id }, 201);
  },
);

// PUT /api/companies/:companyId/worker-absences/:id
app.put(
  "/:companyId/worker-absences/:id",
  authMiddleware,
  companyMiddleware,
  zValidator(
    "json",
    z.object({
      startsOn: z.string().optional(),
      endsOn: z.string().optional(),
      notes: z.string().optional(),
    }),
  ),
  async (c) => {
    const ctx = c.get("company");
    const id = c.req.param("id");
    const input = c.req.valid("json");

    if (!isActive(ctx.companyContractor)) return c.json({ error: "Forbidden" }, 403);

    const [updated] = await ctx.db
      .update(companyContractorAbsences)
      .set(input)
      .where(
        and(
          eq(companyContractorAbsences.id, BigInt(id)),
          eq(companyContractorAbsences.companyContractorId, ctx.companyContractor!.id),
        ),
      )
      .returning();
    if (!updated) return c.json({ error: "Not Found" }, 404);

    return c.json({ success: true });
  },
);

// DELETE /api/companies/:companyId/worker-absences/:id
app.delete("/:companyId/worker-absences/:id", authMiddleware, companyMiddleware, async (c) => {
  const ctx = c.get("company");
  const id = c.req.param("id");

  if (!isActive(ctx.companyContractor)) return c.json({ error: "Forbidden" }, 403);

  const [deleted] = await ctx.db
    .delete(companyContractorAbsences)
    .where(
      and(
        eq(companyContractorAbsences.id, BigInt(id)),
        eq(companyContractorAbsences.companyContractorId, ctx.companyContractor!.id),
      ),
    )
    .returning();
  if (!deleted) return c.json({ error: "Not Found" }, 404);

  return c.json({ success: true });
});

export { app as workerAbsencesRouter };
