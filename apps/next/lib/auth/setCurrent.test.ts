import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { companies, companyInvestors, dividendRounds, dividends, tosAgreements, users } from "@/db/schema";
import { assertDefined } from "@/utils/assert";
import { type ClerkIdentity, setCurrentUser } from "./setCurrent";

const suffix = () => Math.random().toString(36).slice(2, 10);
const createdUserIds: bigint[] = [];

const identity = (overrides: Partial<ClerkIdentity> = {}): ClerkIdentity => ({
  clerkUserId: `user_${suffix()}`,
  sessionIssuedAt: null,
  getPrimaryEmail: vi.fn(() => Promise.resolve(`${suffix()}@example.com`)),
  ...overrides,
});

const track = <T extends { id: bigint } | null>(user: T) => {
  if (user) createdUserIds.push(user.id);
  return user;
};

describe("setCurrentUser (Rails SetCurrent port)", () => {
  beforeEach(() => vi.clearAllMocks());

  afterAll(async () => {
    if (createdUserIds.length) {
      await db.delete(tosAgreements).where(inArray(tosAgreements.userId, createdUserIds));
      await db.delete(users).where(inArray(users.id, createdUserIds));
    }
  });

  it("returns null when signed out, without touching Clerk or the DB", async () => {
    expect(await setCurrentUser(null, { ipAddress: "1.1.1.1" })).toBeNull();
  });

  it("resolves an existing user by clerk_id without fetching the Clerk email", async () => {
    const existing = assertDefined(
      (
        await db
          .insert(users)
          .values({ email: `${suffix()}@example.com`, clerkId: `user_${suffix()}` })
          .returning()
      )[0],
    );
    track(existing);
    const id = identity({ clerkUserId: assertDefined(existing.clerkId) });

    const user = await setCurrentUser(id, { ipAddress: "1.1.1.1" });

    expect(user?.id).toBe(existing.id);
    expect(id.getPrimaryEmail).not.toHaveBeenCalled();
  });

  it("creates an unknown Clerk user with a TOS agreement recording the request IP", async () => {
    const email = `${suffix()}@example.com`;
    const id = identity({ getPrimaryEmail: () => Promise.resolve(email) });

    const user = assertDefined(track(await setCurrentUser(id, { ipAddress: "203.0.113.9" })));

    expect(user).toMatchObject({ email, clerkId: id.clerkUserId });
    expect(user.externalId).toMatch(/^[0-9a-z]{13}$/u);
    const agreements = await db.query.tosAgreements.findMany({ where: eq(tosAgreements.userId, user.id) });
    expect(agreements.map((a) => a.ipAddress)).toEqual(["203.0.113.9"]);
  });

  it("is idempotent: a second request for the same Clerk user reuses the record", async () => {
    const id = identity();
    const first = track(await setCurrentUser(id, { ipAddress: "1.1.1.1" }));
    const second = await setCurrentUser(id, { ipAddress: "1.1.1.1" });
    expect(second?.id).toBe(first?.id);
  });

  it("links an existing user by email only in development", async () => {
    const email = `${suffix()}@example.com`;
    const existing = assertDefined((await db.insert(users).values({ email }).returning())[0]);
    track(existing);

    const linked = await setCurrentUser(identity({ getPrimaryEmail: () => Promise.resolve(email) }), {
      ipAddress: "1.1.1.1",
      isDevelopment: true,
    });
    expect(linked?.id).toBe(existing.id);
    expect(linked?.clerkId).toBeTruthy();
    expect(await db.query.tosAgreements.findFirst({ where: eq(tosAgreements.userId, existing.id) })).toBeUndefined();
  });

  it("returns null when Clerk has no primary email", async () => {
    expect(
      await setCurrentUser(identity({ getPrimaryEmail: () => Promise.resolve(null) }), { ipAddress: "" }),
    ).toBeNull();
  });

  it("syncs current_sign_in_at from the session iat and issues pending-signup dividends on first sign in", async () => {
    const id = identity({ sessionIssuedAt: 1_700_000_000 });
    const company = assertDefined(
      (
        await db
          .insert(companies)
          .values({ email: `${suffix()}@example.com`, countryCode: "US" })
          .returning()
      )[0],
    );
    const user = assertDefined(
      (
        await db
          .insert(users)
          .values({ email: `${suffix()}@example.com`, clerkId: id.clerkUserId })
          .returning()
      )[0],
    );
    track(user);
    const investor = assertDefined(
      (
        await db
          .insert(companyInvestors)
          .values({ companyId: company.id, userId: user.id, investmentAmountInCents: 0n })
          .returning()
      )[0],
    );
    const round = assertDefined(
      (
        await db
          .insert(dividendRounds)
          .values({
            companyId: company.id,
            issuedAt: new Date(),
            numberOfShareholders: 1n,
            numberOfShares: 1n,
            totalAmountInCents: 100n,
            status: "Issued",
            returnOfCapital: false,
          })
          .returning()
      )[0],
    );
    const dividend = assertDefined(
      (
        await db
          .insert(dividends)
          .values({
            companyId: company.id,
            dividendRoundId: round.id,
            companyInvestorId: investor.id,
            totalAmountInCents: 100n,
            qualifiedAmountCents: 0n,
            status: "Pending signup",
          })
          .returning()
      )[0],
    );

    try {
      const signedIn = await setCurrentUser(id, { ipAddress: "1.1.1.1" });
      expect(signedIn?.currentSignInAt?.getTime()).toBe(1_700_000_000_000);
      const refreshed = await db.query.dividends.findFirst({ where: eq(dividends.id, dividend.id) });
      expect(refreshed?.status).toBe("Issued");

      // A new session only bumps the timestamp; dividends are only issued on the very first sign in.
      await db.update(dividends).set({ status: "Pending signup" }).where(eq(dividends.id, dividend.id));
      const again = await setCurrentUser({ ...id, sessionIssuedAt: 1_700_000_500 }, { ipAddress: "1.1.1.1" });
      expect(again?.currentSignInAt?.getTime()).toBe(1_700_000_500_000);
      const untouched = await db.query.dividends.findFirst({ where: eq(dividends.id, dividend.id) });
      expect(untouched?.status).toBe("Pending signup");
    } finally {
      await db.delete(dividends).where(eq(dividends.id, dividend.id));
      await db.delete(dividendRounds).where(eq(dividendRounds.id, round.id));
      await db.delete(companyInvestors).where(eq(companyInvestors.id, investor.id));
      await db.delete(companies).where(eq(companies.id, company.id));
    }
  });
});
