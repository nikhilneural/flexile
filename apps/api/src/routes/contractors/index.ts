import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { isFuture } from "date-fns";
import { and, asc, desc, eq, gt, gte, isNotNull, isNull, lt, not, or } from "drizzle-orm";
import { pick } from "lodash-es";
import { z } from "zod";
import type { Env } from "@/env";
import { byExternalId, pagination } from "@/db";
import { PayRateType } from "@/db/enums";
import {
  companyContractors,
  companyRoles,
  equityAllocations,
  users,
} from "@/db/schema";
import { authMiddleware } from "@/middleware/auth";
import { companyMiddleware } from "@/middleware/company";
import { assertDefined } from "@/utils/assert";
import { simpleUser, latestUserComplianceInfo } from "../users/helpers";

export const isActive = (contractor: typeof companyContractors.$inferSelect | null): boolean =>
  !!contractor && (!contractor.endedAt || isFuture(contractor.endedAt));

const app = new Hono<{ Bindings: Env }>();

// GET /api/companies/:companyId/contractors
app.get(
  "/:companyId/contractors",
  authMiddleware,
  companyMiddleware,
  zValidator(
    "query",
    z.object({
      type: z.enum(["onboarding", "alumni", "active", "not_alumni"]).optional(),
      roleId: z.string().optional(),
      order: z.enum(["asc", "desc"]).default("asc"),
      page: z.coerce.number().optional(),
      perPage: z.coerce.number().optional(),
    }),
  ),
  async (c) => {
    const ctx = c.get("company");
    const input = c.req.valid("query");

    if (!ctx.companyAdministrator) return c.json({ error: "Forbidden" }, 403);

    const onboarding = assertDefined(
      or(gt(companyContractors.startedAt, new Date()), eq(companyContractors.onTrial, true)),
    );
    const where = and(
      eq(companyContractors.companyId, ctx.company.id),
      input.type
        ? input.type === "alumni"
          ? and(isNotNull(companyContractors.endedAt), lt(companyContractors.endedAt, new Date()))
          : or(isNull(companyContractors.endedAt), gte(companyContractors.endedAt, new Date()))
        : undefined,
      input.type === "onboarding" ? onboarding : input.type === "active" ? not(onboarding) : undefined,
      input.type === "not_alumni" ? isNull(companyContractors.endedAt) : undefined,
      input.roleId ? eq(companyContractors.companyRoleId, byExternalId(companyRoles, input.roleId)) : undefined,
    );

    const paginationInput = input.page && input.perPage ? { page: input.page, perPage: input.perPage } : {};
    const rows = await ctx.db.query.companyContractors.findMany({
      where,
      with: {
        user: {
          with: {
            userComplianceInfos: latestUserComplianceInfo,
            wiseRecipients: { columns: { id: true }, limit: 1 },
          },
        },
        role: true,
      },
      orderBy: (input.order === "asc" ? asc : desc)(companyContractors.id),
      ...pagination(paginationInput),
    });
    const total = await ctx.db.$count(companyContractors, where);

    const workers = rows.map((worker) => ({
      ...pick(worker, ["startedAt", "payRateInSubunits", "hoursPerWeek", "onTrial", "endedAt"]),
      id: worker.externalId,
      user: {
        ...simpleUser(worker.user),
        ...pick(worker.user, "countryCode", "invitationAcceptedAt"),
      },
      role: { id: worker.role.externalId, name: worker.role.name },
    }));

    return c.json({ workers, total });
  },
);

// GET /api/companies/:companyId/contractors/for-team-updates
app.get("/:companyId/contractors/for-team-updates", authMiddleware, companyMiddleware, async (c) => {
  const ctx = c.get("company");

  if (!ctx.companyAdministrator && !isActive(ctx.companyContractor)) return c.json({ error: "Forbidden" }, 403);

  const contractors = await ctx.db.query.companyContractors.findMany({
    columns: { id: true },
    with: { user: { columns: simpleUser.columns } },
    where: and(
      eq(companyContractors.companyId, ctx.company.id),
      or(isNull(companyContractors.endedAt), gte(companyContractors.endedAt, new Date())),
    ),
    orderBy: [desc(eq(companyContractors.externalId, ctx.companyContractor?.externalId ?? ""))],
  });

  return c.json(
    contractors.map((contractor) => ({
      ...contractor,
      user: simpleUser(contractor.user),
    })),
  );
});

// GET /api/companies/:companyId/contractors/:userId
app.get("/:companyId/contractors/:userId", authMiddleware, companyMiddleware, async (c) => {
  const ctx = c.get("company");
  const userId = c.req.param("userId");

  if (!ctx.companyAdministrator) return c.json({ error: "Forbidden" }, 403);

  const contractor = await ctx.db.query.companyContractors.findFirst({
    where: and(
      eq(companyContractors.companyId, ctx.company.id),
      eq(companyContractors.userId, byExternalId(users, userId)),
    ),
    with: {
      equityAllocations: { where: eq(equityAllocations.year, new Date().getFullYear()) },
      role: { columns: { externalId: true } },
    },
  });
  if (!contractor) return c.json({ error: "Not Found" }, 404);

  return c.json({
    ...pick(contractor, ["payRateInSubunits", "hoursPerWeek", "endedAt", "onTrial"]),
    id: contractor.externalId,
    role: contractor.role.externalId,
    payRateType: contractor.payRateType,
    equityPercentage: contractor.equityAllocations[0]?.equityPercentage ?? 0,
  });
});

// PUT /api/companies/:companyId/contractors/:id
app.put(
  "/:companyId/contractors/:id",
  authMiddleware,
  companyMiddleware,
  zValidator(
    "json",
    z.object({
      payRateInSubunits: z.number().optional(),
      payRateType: z.nativeEnum(PayRateType).optional(),
      hoursPerWeek: z.number().optional(),
      roleId: z.string().optional(),
    }),
  ),
  async (c) => {
    const ctx = c.get("company");
    const id = c.req.param("id");
    const input = c.req.valid("json");

    if (!ctx.companyAdministrator) return c.json({ error: "Forbidden" }, 403);

    const contractor = await ctx.db.query.companyContractors.findFirst({
      where: and(eq(companyContractors.companyId, ctx.company.id), eq(companyContractors.externalId, id)),
      with: { user: true },
    });
    if (!contractor) return c.json({ error: "Not Found" }, 404);

    let roleId: bigint | undefined;
    if (input.roleId) {
      const role = await ctx.db.query.companyRoles.findFirst({
        where: and(eq(companyRoles.companyId, ctx.company.id), eq(companyRoles.externalId, input.roleId)),
      });
      if (!role) return c.json({ error: "Not Found" }, 404);
      roleId = role.id;
    }

    await ctx.db
      .update(companyContractors)
      .set({
        ...pick(input, ["payRateInSubunits", "payRateType", "hoursPerWeek"]),
        companyRoleId: roleId,
      })
      .where(eq(companyContractors.id, contractor.id));

    return c.json({ success: true });
  },
);

// POST /api/companies/:companyId/contractors/:id/end-contract
app.post(
  "/:companyId/contractors/:id/end-contract",
  authMiddleware,
  companyMiddleware,
  zValidator("json", z.object({ endDate: z.string() })),
  async (c) => {
    const ctx = c.get("company");
    const id = c.req.param("id");
    const { endDate } = c.req.valid("json");

    if (!ctx.companyAdministrator) return c.json({ error: "Forbidden" }, 403);

    const activeContractor = await ctx.db.query.companyContractors.findFirst({
      with: { user: true },
      where: and(
        eq(companyContractors.externalId, id),
        eq(companyContractors.companyId, ctx.company.id),
        isNull(companyContractors.endedAt),
      ),
    });
    if (!activeContractor) return c.json({ error: "Not Found" }, 404);

    await ctx.db
      .update(companyContractors)
      .set({ endedAt: new Date(endDate) })
      .where(eq(companyContractors.id, activeContractor.id));

    return c.json({ success: true });
  },
);

// POST /api/companies/:companyId/contractors/:id/cancel-end
app.post("/:companyId/contractors/:id/cancel-end", authMiddleware, companyMiddleware, async (c) => {
  const ctx = c.get("company");
  const id = c.req.param("id");

  if (!ctx.companyAdministrator) return c.json({ error: "Forbidden" }, 403);

  const contractor = await ctx.db.query.companyContractors.findFirst({
    with: { user: true },
    where: and(
      eq(companyContractors.externalId, id),
      eq(companyContractors.companyId, ctx.company.id),
      isNotNull(companyContractors.endedAt),
    ),
  });
  if (!contractor) return c.json({ error: "Not Found" }, 404);

  await ctx.db
    .update(companyContractors)
    .set({ endedAt: null })
    .where(eq(companyContractors.id, contractor.id));

  return c.json({ success: true });
});

// POST /api/companies/:companyId/contractors/:id/complete-trial
app.post("/:companyId/contractors/:id/complete-trial", authMiddleware, companyMiddleware, async (c) => {
  const ctx = c.get("company");
  const id = c.req.param("id");

  if (!ctx.companyAdministrator) return c.json({ error: "Forbidden" }, 403);

  const contractor = await ctx.db.query.companyContractors.findFirst({
    with: {
      user: true,
      role: { with: { rates: { orderBy: [desc(companyContractors.id)], limit: 1 } } },
    },
    where: and(
      eq(companyContractors.externalId, id),
      eq(companyContractors.companyId, ctx.company.id),
      eq(companyContractors.onTrial, true),
    ),
  });
  if (!contractor) return c.json({ error: "Not Found" }, 404);

  await ctx.db
    .update(companyContractors)
    .set({
      onTrial: false,
      payRateInSubunits: contractor.role.rates[0]?.payRateInSubunits,
      hoursPerWeek: 40,
    })
    .where(eq(companyContractors.id, contractor.id));

  return c.json({ success: true });
});

export { app as contractorsRouter };
