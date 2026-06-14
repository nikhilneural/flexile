import { Hono } from "hono";
import type { Env } from "@/env";

const signeeSearchRouter = new Hono<{ Bindings: Env }>();

/** GET /internal/companies/:companyId/signee-search?query=... - Search for signees */
signeeSearchRouter.get("/", async (c) => {
  const query = c.req.query("query") || "";
  // Business logic: SigneeSearchService
  return c.json({ results: [] });
});

export { signeeSearchRouter };
