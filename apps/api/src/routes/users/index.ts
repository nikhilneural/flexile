import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { z } from "zod";
import type { Env } from "@/env";
import { createDb } from "@/db";
import { users } from "@/db/schema";
import { authMiddleware } from "@/middleware/auth";
import { latestUserComplianceInfo, userDisplayEmail, userDisplayName, withRoles } from "./helpers";

const app = new Hono<{ Bindings: Env }>();

// GET /api/users/:id
app.get("/:id", authMiddleware, async (c) => {
  const id = c.req.param("id");
  const auth = c.get("auth");
  const db = createDb(c.env);

  const user = await db.query.users.findFirst({
    where: eq(users.clerkId, auth.clerkUserId),
    with: { userComplianceInfos: latestUserComplianceInfo },
  });

  if (!user) {
    return c.json({ error: "Not Found" }, 404);
  }

  let targetUser = user;
  if (id !== user.externalId) {
    const data = await db.query.users.findFirst({
      where: eq(users.externalId, id),
      with: { userComplianceInfos: latestUserComplianceInfo },
    });
    if (!data) return c.json({ error: "Not Found" }, 404);
    targetUser = data;
  }

  return c.json({
    id: targetUser.externalId,
    email: userDisplayEmail(targetUser),
    preferredName: targetUser.preferredName,
    legalName: targetUser.legalName,
    businessName: targetUser.userComplianceInfos[0]?.businessName,
    address: {
      streetAddress: targetUser.streetAddress,
      city: targetUser.city,
      zipCode: targetUser.zipCode,
      countryCode: targetUser.countryCode,
      stateCode: targetUser.state,
    },
    displayName: userDisplayName(targetUser),
  });
});

// PUT /api/users
app.put(
  "/",
  authMiddleware,
  zValidator(
    "json",
    z.object({
      email: z.string(),
      preferredName: z.string().nullable(),
    }),
  ),
  async (c) => {
    const auth = c.get("auth");
    const input = c.req.valid("json");
    const db = createDb(c.env);

    const user = await db.query.users.findFirst({
      where: eq(users.clerkId, auth.clerkUserId),
    });
    if (!user) return c.json({ error: "Not Found" }, 404);

    await db
      .update(users)
      .set({
        email: input.email,
        preferredName: input.preferredName,
      })
      .where(eq(users.id, user.id));

    return c.json({ success: true });
  },
);

export { app as usersRouter };
export * from "./helpers";
