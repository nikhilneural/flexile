import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { companyInvestors, dividends, tosAgreements, users } from "@/db/schema";

/**
 * Native port of the user-resolution half of Rails `SetCurrent#set_current`
 * (apps/rails/app/controllers/concerns/set_current.rb), including the model
 * callbacks it triggers on `User`.
 *
 * Rails behaviour mirrored here:
 * 1. Look up the user by `clerk_id`.
 * 2. If missing, fetch the Clerk primary email.
 *    - In development only, adopt an existing user with that email (`update!(clerk_id:)`).
 *    - Otherwise create the user and record a `TosAgreement` with the request IP.
 * 3. If the Clerk session `iat` differs from `current_sign_in_at`, update it.
 *    `User#update_dividend_status` (after_update_commit) runs when `current_sign_in_at`
 *    was previously nil: all "Pending signup" dividends become "Issued".
 *
 * Company/role resolution stays in tRPC `protectedProcedure` (it is driven by `companyId`).
 */

export type ClerkIdentity = {
  clerkUserId: string;
  /** Clerk session `iat` claim, in seconds. */
  sessionIssuedAt: number | null;
  /** Lazily resolves the Clerk primary email; only called when the user is not yet linked. */
  getPrimaryEmail: () => Promise<string | null>;
};

export type SetCurrentOptions = {
  ipAddress: string;
  /** Mirrors `Rails.env.development?`. */
  isDevelopment?: boolean;
};

export type CurrentUser = typeof users.$inferSelect;

const PENDING_SIGNUP = "Pending signup";
const ISSUED = "Issued";
const PG_UNIQUE_VIOLATION = "23505";

const isUniqueViolation = (error: unknown) =>
  typeof error === "object" && error !== null && "code" in error && error.code === PG_UNIQUE_VIOLATION;

const findByClerkId = (clerkId: string) => db.query.users.findFirst({ where: eq(users.clerkId, clerkId) });

async function findOrCreateUser(identity: ClerkIdentity, options: SetCurrentOptions): Promise<CurrentUser | null> {
  const existing = await findByClerkId(identity.clerkUserId);
  if (existing) return existing;

  const email = await identity.getPrimaryEmail();
  // Rails raises on a missing primary email; we treat it as signed out instead of 500ing every request.
  if (!email) return null;

  if (options.isDevelopment) {
    const byEmail = await db.query.users.findFirst({ where: eq(users.email, email) });
    if (byEmail) {
      const [linked] = await db
        .update(users)
        .set({ clerkId: identity.clerkUserId })
        .where(eq(users.id, byEmail.id))
        .returning();
      return linked ?? null;
    }
  }

  try {
    return await db.transaction(async (tx) => {
      const [created] = await tx.insert(users).values({ clerkId: identity.clerkUserId, email }).returning();
      if (!created) throw new Error("Failed to create user");
      await tx.insert(tosAgreements).values({ userId: created.id, ipAddress: options.ipAddress });
      return created;
    });
  } catch (error) {
    // Concurrent first requests for the same Clerk user race on the unique email / clerk_id index.
    if (isUniqueViolation(error)) return (await findByClerkId(identity.clerkUserId)) ?? null;
    throw error;
  }
}

async function syncCurrentSignInAt(user: CurrentUser, sessionIssuedAt: number | null): Promise<CurrentUser> {
  if (sessionIssuedAt === null) return user;
  const previous = user.currentSignInAt ? Math.floor(user.currentSignInAt.getTime() / 1000) : null;
  if (previous === sessionIssuedAt) return user;

  const currentSignInAt = new Date(sessionIssuedAt * 1000);
  return db.transaction(async (tx) => {
    const [updated] = await tx.update(users).set({ currentSignInAt }).where(eq(users.id, user.id)).returning();

    // User#update_dividend_status
    if (user.currentSignInAt === null) {
      await tx
        .update(dividends)
        .set({ status: ISSUED })
        .where(
          and(
            eq(dividends.status, PENDING_SIGNUP),
            inArray(
              dividends.companyInvestorId,
              tx.select({ id: companyInvestors.id }).from(companyInvestors).where(eq(companyInvestors.userId, user.id)),
            ),
          ),
        );
    }
    return updated ?? { ...user, currentSignInAt };
  });
}

export async function setCurrentUser(
  identity: ClerkIdentity | null,
  options: SetCurrentOptions,
): Promise<CurrentUser | null> {
  if (!identity) return null;
  const user = await findOrCreateUser(identity, options);
  if (!user) return null;
  return syncCurrentSignInAt(user, identity.sessionIssuedAt);
}
