import "server-only";
import { auth, clerkClient } from "@clerk/nextjs/server";
import type { ClerkIdentity } from "./setCurrent";

/**
 * Reads the Clerk session for the current request (populated by `clerkMiddleware`).
 * Returns null when signed out or when no Clerk context is available.
 */
export async function getClerkIdentity(): Promise<ClerkIdentity | null> {
  let session: Awaited<ReturnType<typeof auth>>;
  try {
    session = await auth();
  } catch {
    return null;
  }
  const { userId, sessionClaims } = session;
  if (!userId) return null;

  return {
    clerkUserId: userId,
    sessionIssuedAt: typeof sessionClaims?.iat === "number" ? sessionClaims.iat : null,
    getPrimaryEmail: async () => {
      const clerkUser = await (await clerkClient()).users.getUser(userId);
      return (
        clerkUser.emailAddresses.find((address) => address.id === clerkUser.primaryEmailAddressId)?.emailAddress ?? null
      );
    },
  };
}
