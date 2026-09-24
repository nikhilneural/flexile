import "server-only";
import Bugsnag from "@bugsnag/js";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { tosAgreements, users } from "@/db/schema";

/**
 * Native replacement for the Rails `SetCurrent` concern / `internal_userid` endpoint.
 *
 * Resolves the current Clerk session to an internal `users.id`:
 *   1. Read the authenticated Clerk user id from the request (via Clerk middleware).
 *   2. Look the user up by `clerk_id`.
 *   3. If absent, create the user from the Clerk profile (email), plus a TOS agreement,
 *      mirroring the Rails behaviour. In development we additionally adopt a pre-existing
 *      user that matches by email (Rails did the same for `Rails.env.development?`).
 *   4. Keep `current_sign_in_at` in sync with the Clerk session `iat` claim.
 *
 * Returns the internal numeric user id, or `null` when there is no signed-in user.
 */
export async function resolveClerkUserId(ipAddress: string): Promise<number | null> {
  try {
    const { userId: clerkUserId, sessionClaims } = await auth();
    if (!clerkUserId) return null;

    let user = await db.query.users.findFirst({ where: eq(users.clerkId, clerkUserId) });

    if (!user) {
      const client = await clerkClient();
      const clerkUser = await client.users.getUser(clerkUserId);
      const email =
        clerkUser.emailAddresses.find((address) => address.id === clerkUser.primaryEmailAddressId)?.emailAddress ??
        clerkUser.emailAddresses[0]?.emailAddress;
      if (!email) return null;

      const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
      if (existing) {
        [user] = await db.update(users).set({ clerkId: clerkUserId }).where(eq(users.id, existing.id)).returning();
      }

      if (!user) {
        [user] = await db.insert(users).values({ clerkId: clerkUserId, email }).returning();
        if (user) await db.insert(tosAgreements).values({ userId: user.id, ipAddress: ipAddress || "127.0.0.1" });
      }
    }

    if (!user) return null;

    const iat = typeof sessionClaims?.iat === "number" ? sessionClaims.iat : null;
    if (iat != null && Math.floor((user.currentSignInAt?.getTime() ?? 0) / 1000) !== iat) {
      await db
        .update(users)
        .set({ currentSignInAt: new Date(iat * 1000) })
        .where(eq(users.id, user.id));
    }

    return Number(user.id);
  } catch (error) {
    console.error("resolveClerkUserId failed:", error);
    try {
      Bugsnag.notify(error instanceof Error ? error : new Error(String(error)));
    } catch {
      // Ignore bugsnag
    }
    return null;
  }
}
