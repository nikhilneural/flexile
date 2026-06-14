import { createMiddleware } from "hono/factory";
import { eq } from "drizzle-orm";
import type { Env } from "@/env";
import { createDb, type Database } from "@/db";
import { companies, companyAdministrators, companyContractors, companyInvestors, companyLawyers, users } from "@/db/schema";
import type { AuthUser } from "./auth";

export interface CompanyContext {
  db: Database;
  user: typeof users.$inferSelect;
  company: typeof companies.$inferSelect;
  companyAdministrator: typeof companyAdministrators.$inferSelect | null;
  companyContractor: typeof companyContractors.$inferSelect | null;
  companyInvestor: typeof companyInvestors.$inferSelect | null;
  companyLawyer: typeof companyLawyers.$inferSelect | null;
}

type CompanyEnv = {
  Bindings: Env;
  Variables: {
    auth: AuthUser;
    company: CompanyContext;
  };
};

/**
 * Company context middleware that:
 * 1. Resolves the companyId from URL params
 * 2. Looks up the authenticated user
 * 3. Validates that the user has a role in the company
 * 4. Sets the company context with user roles
 */
export const companyMiddleware = createMiddleware<CompanyEnv>(async (c, next) => {
  const companyId = c.req.param("companyId");
  if (!companyId) {
    return c.json({ error: "Bad Request", message: "Missing companyId parameter" }, 400);
  }

  const auth = c.get("auth");
  if (!auth) {
    return c.json({ error: "Unauthorized", message: "Authentication required" }, 401);
  }

  const db = createDb(c.env);

  // Look up user by Clerk ID
  const user = await db.query.users.findFirst({
    where: eq(users.clerkId, auth.clerkUserId),
  });

  if (!user) {
    return c.json({ error: "Forbidden", message: "User not found" }, 403);
  }

  // Look up company by external ID
  const company = await db.query.companies.findFirst({
    where: eq(companies.externalId, companyId),
  });

  if (!company) {
    return c.json({ error: "Forbidden", message: "Company not found" }, 403);
  }

  // Check user roles in the company
  const [administrator, contractor, investor, lawyer] = await Promise.all([
    db.query.companyAdministrators.findFirst({
      where: (table, { and, eq: eqFn }) => and(eqFn(table.userId, user.id), eqFn(table.companyId, company.id)),
    }),
    db.query.companyContractors.findFirst({
      where: (table, { and, eq: eqFn }) => and(eqFn(table.userId, user.id), eqFn(table.companyId, company.id)),
    }),
    db.query.companyInvestors.findFirst({
      where: (table, { and, eq: eqFn }) => and(eqFn(table.userId, user.id), eqFn(table.companyId, company.id)),
    }),
    db.query.companyLawyers.findFirst({
      where: (table, { and, eq: eqFn }) => and(eqFn(table.userId, user.id), eqFn(table.companyId, company.id)),
    }),
  ]);

  // User must have at least one role in the company
  if (!administrator && !contractor && !investor && !lawyer) {
    return c.json({ error: "Forbidden", message: "No access to this company" }, 403);
  }

  c.set("company", {
    db,
    user,
    company,
    companyAdministrator: administrator ?? null,
    companyContractor: contractor ?? null,
    companyInvestor: investor ?? null,
    companyLawyer: lawyer ?? null,
  });

  await next();
});
