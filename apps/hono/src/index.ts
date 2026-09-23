import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import type { AppEnv } from "./types";

import auth from "./routes/auth";
import companies from "./routes/companies";
import invoices from "./routes/invoices";
import documents from "./routes/documents";
import equity from "./routes/equity";
import people from "./routes/people";

const app = new Hono<AppEnv>();

app.use("*", logger());
app.use(
  "/api/*",
  cors({
    origin: (origin) => origin ?? "*",
    credentials: true,
    allowMethods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  }),
);

// Health check
app.get("/api/health", (c) =>
  c.json({ status: "ok", app: c.env.APP_NAME, stack: "Hono + Cloudflare Workers + D1", time: new Date().toISOString() }),
);

// API routes (Flexile domain ported to Hono)
app.route("/api/auth", auth);
app.route("/api/companies", companies);
app.route("/api/invoices", invoices);
app.route("/api/documents", documents);
app.route("/api/equity", equity);
app.route("/api/people", people);

// API 404 fallback (so SPA fallback below doesn't swallow unknown API routes)
app.all("/api/*", (c) => c.json({ error: "Not found" }, 404));

// Everything else -> static assets (frontend SPA). The ASSETS binding serves
// ./public and falls back to index.html for client-side routing.
app.get("*", async (c) => {
  const res = await c.env.ASSETS.fetch(c.req.raw);
  if (res.status === 404) {
    const indexReq = new Request(new URL("/index.html", c.req.url), c.req.raw);
    return c.env.ASSETS.fetch(indexReq);
  }
  return res;
});

export default app;
