import { Hono } from "hono";
import type { Env } from "@/env";

const searchRouter = new Hono<{ Bindings: Env }>();

/** GET /internal/companies/:companyId/search?query=... - Search within company */
searchRouter.get("/", async (c) => {
  const query = c.req.query("query") || "";
  // Business logic: SearchService
  return c.json({ results: [] });
});

export { searchRouter };
