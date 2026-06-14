import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { requestId } from "hono/request-id";
import type { Env } from "./env";
import { routes } from "./routes";

const app = new Hono<{ Bindings: Env }>();

// Global middleware
app.use("*", requestId());
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: (origin) => origin,
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
    maxAge: 86400,
  }),
);

// Global error handler
app.onError((err, c) => {
  console.error(`[${c.get("requestId")}] Error:`, err.message);
  const status = "status" in err && typeof err.status === "number" ? err.status : 500;
  return c.json(
    {
      error: status === 500 ? "Internal Server Error" : err.message,
      requestId: c.get("requestId"),
    },
    { status },
  );
});

// Health check endpoint
app.get("/health", (c) => {
  return c.json({
    status: "ok",
    version: "0.1.0",
    timestamp: new Date().toISOString(),
  });
});

// Mount all API routes
app.route("/", routes);

export default app;
