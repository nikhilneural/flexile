import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { requestId } from "hono/request-id";
import type { Env } from "./env";
import type { MessageBatch } from "@cloudflare/workers-types";
import { routes } from "./routes";
import { webhooksRouter } from "./routes/webhooks";
import { internalRouter } from "./routes/internal";
import { adminRouter } from "./routes/admin";
import { apiV1Router } from "./routes/api/v1";
import { handleQueueBatch } from "./queues/consumer";
import type { QueueMessage } from "./queues/types";

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

// Mount all API routes (tRPC-migrated REST endpoints)
app.route("/", routes);

// Webhook routes (no auth, signature verification per-handler)
app.route("/webhooks", webhooksRouter);

// Internal routes (Rails internal controllers)
app.route("/internal", internalRouter);

// Admin routes (Administrate dashboard)
app.route("/admin", adminRouter);

// Public API v1 routes
app.route("/api/v1", apiV1Router);

export default {
  fetch: app.fetch,
  async queue(batch: MessageBatch<QueueMessage>, env: Env): Promise<void> {
    await handleQueueBatch(batch, env);
  },
};
