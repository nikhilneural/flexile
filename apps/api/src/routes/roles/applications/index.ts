import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, exists, isNull } from "drizzle-orm";
import { pick } from "lodash-es";
import { z } from "zod";
import type { Env } from "@/env";
import { createDb } from "@/db";
import { RoleApplicationStatus } from "@/db/enums";
import { companyRoleApplications, companyRoleRates, companyRoles } from "@/db/schema";
import { authMiddleware } from "@/middleware/auth";
import { companyMiddleware } from "@/middleware/company";

const app = new Hono<{ Bindings: Env }>();

// GET /api/companies/:companyId/roles/applications
app.get(
  "/:companyId/roles/applications",
  authMiddleware,
  companyMiddleware,
  zValidator("query", z.object({ roleId: z.coerce.number() })),
  async (c) => {
    const ctx = c.get("company");
    const { roleId } = c.req.valid("query");

    if (!ctx.companyAdministrator) return c.json({ error: "Forbidden" }, 403);

    const results = await ctx.db
      .select(pick(companyRoleApplications, "id", "name", "createdAt", "hoursPerWeek"))
      .from(companyRoleApplications)
      .innerJoin(companyRoles, eq(companyRoleApplications.companyRoleId, companyRoles.id))
      .where(
        and(
          eq(companyRoles.companyId, ctx.company.id),
          eq(companyRoleApplications.companyRoleId, BigInt(roleId)),
          eq(companyRoleApplications.status, RoleApplicationStatus.Pending),
          isNull(companyRoleApplications.deletedAt),
        ),
      );

    return c.json(results);
  },
);

// GET /api/companies/:companyId/roles/applications/:id
app.get("/:companyId/roles/applications/:id", authMiddleware, companyMiddleware, async (c) => {
  const ctx = c.get("company");
  const id = c.req.param("id");

  if (!ctx.companyAdministrator) return c.json({ error: "Forbidden" }, 403);

  const [application] = await ctx.db
    .select({
      ...pick(
        companyRoleApplications,
        "name",
        "description",
        "hoursPerWeek",
        "weeksPerYear",
        "countryCode",
        "email",
        "createdAt",
        "equityPercent",
      ),
      role: {
        id: companyRoles.externalId,
        ...pick(companyRoleRates, "payRateInSubunits", "trialPayRateInSubunits", "payRateType"),
      },
    })
    .from(companyRoleApplications)
    .innerJoin(companyRoles, eq(companyRoleApplications.companyRoleId, companyRoles.id))
    .innerJoin(companyRoleRates, eq(companyRoles.id, companyRoleRates.companyRoleId))
    .orderBy(desc(companyRoleRates.createdAt))
    .limit(1)
    .where(
      and(
        eq(companyRoles.companyId, ctx.company.id),
        eq(companyRoleApplications.id, BigInt(id)),
        isNull(companyRoleApplications.deletedAt),
      ),
    );
  if (!application) return c.json({ error: "Not Found" }, 404);

  return c.json(application);
});

// POST /api/companies/:companyId/roles/applications/:id/reject
app.post("/:companyId/roles/applications/:id/reject", authMiddleware, companyMiddleware, async (c) => {
  const ctx = c.get("company");
  const id = c.req.param("id");

  if (!ctx.companyAdministrator) return c.json({ error: "Forbidden" }, 403);

  const [result] = await ctx.db
    .update(companyRoleApplications)
    .set({ status: RoleApplicationStatus.Denied })
    .where(
      and(
        eq(companyRoleApplications.id, BigInt(id)),
        exists(
          ctx.db
            .select()
            .from(companyRoles)
            .where(
              and(
                eq(companyRoles.id, companyRoleApplications.companyRoleId),
                eq(companyRoles.companyId, ctx.company.id),
              ),
            ),
        ),
      ),
    )
    .returning();
  if (!result) return c.json({ error: "Not Found" }, 404);

  return c.json(result);
});

// POST /api/roles/applications (public)
app.post(
  "/applications",
  zValidator(
    "json",
    z.object({
      companyRoleId: z.string(),
      name: z.string(),
      email: z.string(),
      description: z.string(),
      countryCode: z.string(),
      hoursPerWeek: z.number(),
      weeksPerYear: z.number(),
      equityPercent: z.number(),
    }),
  ),
  async (c) => {
    const input = c.req.valid("json");
    const db = createDb(c.env);

    const role = await db.query.companyRoles.findFirst({
      where: and(eq(companyRoles.externalId, input.companyRoleId), eq(companyRoles.activelyHiring, true)),
      with: { company: true },
    });
    if (!role) return c.json({ error: "Not Found" }, 404);

    const [application] = await db
      .insert(companyRoleApplications)
      .values({
        ...input,
        companyRoleId: role.id,
        status: RoleApplicationStatus.Pending,
      })
      .returning();

    return c.json({ id: application?.id }, 201);
  },
);

export { app as roleApplicationsRouter };
