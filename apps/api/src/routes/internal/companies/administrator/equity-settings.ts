import { Hono } from "hono";
import type { Env } from "@/env";

const adminEquitySettingsRouter = new Hono<{ Bindings: Env }>();

/** GET /internal/companies/:companyId/administrator/equity-settings - Get equity settings */
adminEquitySettingsRouter.get("/", async (c) => {
  return c.json({ settings: {} });
});

export { adminEquitySettingsRouter };
