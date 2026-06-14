import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, eq, notInArray } from "drizzle-orm";
import { z } from "zod";
import type { Env } from "@/env";
import { users, wallets } from "@/db/schema";
import { authMiddleware } from "@/middleware/auth";
import { companyMiddleware } from "@/middleware/company";

const isEthereumAddress = (address: string) => /^0x[a-fA-F0-9]{40}$/u.test(address);

const supportedCountries: Record<string, string> = { US: "United States" };

const app = new Hono<{ Bindings: Env }>();

// PUT /api/companies/:companyId/wallets
app.put(
  "/:companyId/wallets",
  authMiddleware,
  companyMiddleware,
  zValidator(
    "json",
    z.object({
      walletAddress: z.string().refine(isEthereumAddress, { message: "Invalid Ethereum address" }),
    }),
  ),
  async (c) => {
    const ctx = c.get("company");
    const input = c.req.valid("json");

    if (!ctx.companyInvestor) return c.json({ error: "Forbidden" }, 403);

    const user = await ctx.db.query.users.findFirst({
      where: and(eq(users.id, ctx.user.id), notInArray(users.countryCode, Object.keys(supportedCountries))),
    });

    if (!user) return c.json({ error: "Forbidden" }, 403);

    const wallet = await ctx.db.query.wallets.findFirst({
      where: eq(wallets.userId, user.id),
    });

    if (!wallet) {
      await ctx.db.insert(wallets).values({
        userId: user.id,
        walletAddress: input.walletAddress,
      });
    } else {
      await ctx.db
        .update(wallets)
        .set({ walletAddress: input.walletAddress })
        .where(eq(wallets.id, wallet.id));
    }

    return c.json({ success: true });
  },
);

export { app as walletsRouter };
