import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, eq, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { pick } from "lodash-es";
import { z } from "zod";
import type { Env } from "@/env";
import { byExternalId, createDb } from "@/db";
import { companies, companyContractors, companyRoles, contractorProfiles, users } from "@/db/schema";
import { authMiddleware } from "@/middleware/auth";

const app = new Hono<{ Bindings: Env }>();

// GET /api/contractor-profiles
app.get(
  "/",
  authMiddleware,
  zValidator("query", z.object({ excludeCompanyId: z.string().optional() })),
  async (c) => {
    const input = c.req.valid("query");
    const db = createDb(c.env);

    const sameCompanyContractor = alias(companyContractors, "same_company_contractor");
    const results = await db
      .select({
        ...pick(contractorProfiles, "availableHoursPerWeek", "description"),
        id: contractorProfiles.externalId,
        ...pick(users, "preferredName", "countryCode"),
        role: companyRoles.name,
        ...pick(companyContractors, "payRateInSubunits", "payRateType"),
      })
      .from(contractorProfiles)
      .innerJoin(users, eq(contractorProfiles.userId, users.id))
      .innerJoin(companyContractors, and(eq(users.id, companyContractors.userId), isNull(companyContractors.endedAt)))
      .innerJoin(companyRoles, eq(companyContractors.companyRoleId, companyRoles.id))
      .leftJoin(
        sameCompanyContractor,
        and(
          eq(users.id, sameCompanyContractor.userId),
          isNull(sameCompanyContractor.endedAt),
          eq(sameCompanyContractor.companyId, byExternalId(companies, input.excludeCompanyId ?? "")),
        ),
      )
      .where(
        and(
          eq(contractorProfiles.availableForHire, true),
          isNull(sameCompanyContractor.id).if(!!input.excludeCompanyId),
        ),
      );

    return c.json(results);
  },
);

// GET /api/contractor-profiles/:id
app.get("/:id", authMiddleware, async (c) => {
  const id = c.req.param("id");
  const db = createDb(c.env);
  const auth = c.get("auth");

  const user = await db.query.users.findFirst({
    where: eq(users.clerkId, auth.clerkUserId),
  });
  if (!user) return c.json({ error: "Not Found" }, 404);

  const [result] = await db
    .select({
      id: contractorProfiles.externalId,
      ...pick(contractorProfiles, "availableHoursPerWeek", "description", "availableForHire"),
      ...pick(users, "preferredName", "countryCode", "email"),
      role: companyRoles.name,
      ...pick(companyContractors, "payRateInSubunits", "payRateType"),
    })
    .from(contractorProfiles)
    .innerJoin(users, eq(contractorProfiles.userId, users.id))
    .innerJoin(companyContractors, eq(users.id, companyContractors.userId))
    .innerJoin(companyRoles, eq(companyContractors.companyRoleId, companyRoles.id))
    .where(
      id === "me"
        ? eq(contractorProfiles.userId, user.id)
        : and(eq(contractorProfiles.externalId, id), eq(contractorProfiles.availableForHire, true)),
    );

  if (!result) return c.json({ error: "Not Found" }, 404);
  return c.json(result);
});

export { app as contractorProfilesRouter };
