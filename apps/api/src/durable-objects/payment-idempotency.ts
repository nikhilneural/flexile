/**
 * Payment Idempotency Durable Object
 *
 * Provides distributed locking and idempotency guarantees for payment operations.
 * Ensures that duplicate payment requests (from retries, webhooks, etc.) are
 * processed exactly once.
 *
 * Replaces: Rails lock_manager.rb + Redis-based distributed locks
 *
 * Usage (from a Worker):
 *   const id = env.PAYMENT_IDEMPOTENCY.idForName(paymentId);
 *   const stub = env.PAYMENT_IDEMPOTENCY.get(id);
 *   const response = await stub.fetch(request);
 *
 * Note: Durable Objects require additional wrangler.toml configuration:
 *   [durable_objects]
 *   bindings = [
 *     { name = "PAYMENT_IDEMPOTENCY", class_name = "PaymentIdempotencyDO" }
 *   ]
 *
 *   [[migrations]]
 *   tag = "v1"
 *   new_classes = ["PaymentIdempotencyDO"]
 */

interface PaymentState {
  status: "pending" | "processing" | "completed" | "failed";
  startedAt: string;
  completedAt?: string;
  result?: unknown;
}

export class PaymentIdempotencyDO {
  private state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    switch (url.pathname) {
      case "/acquire":
        return this.acquireLock(request);
      case "/release":
        return this.releaseLock(request);
      case "/status":
        return this.getStatus();
      default:
        return new Response("Not found", { status: 404 });
    }
  }

  private async acquireLock(request: Request): Promise<Response> {
    const existing = await this.state.storage.get<PaymentState>("payment");

    // If already completed, return the result (idempotent)
    if (existing?.status === "completed") {
      return Response.json({ acquired: false, status: "completed", result: existing.result });
    }

    // If currently processing and not timed out (5 min), reject
    if (existing?.status === "processing") {
      const startedAt = new Date(existing.startedAt).getTime();
      const elapsed = Date.now() - startedAt;
      if (elapsed < 5 * 60 * 1000) {
        return Response.json({ acquired: false, status: "processing" });
      }
      // Timed out, allow re-acquisition
    }

    // Acquire the lock
    const state: PaymentState = {
      status: "processing",
      startedAt: new Date().toISOString(),
    };
    await this.state.storage.put("payment", state);

    return Response.json({ acquired: true, status: "processing" });
  }

  private async releaseLock(request: Request): Promise<Response> {
    const body = (await request.json()) as { status: "completed" | "failed"; result?: unknown };

    const state: PaymentState = {
      status: body.status,
      startedAt: ((await this.state.storage.get<PaymentState>("payment"))?.startedAt ??
        new Date().toISOString()) as string,
      completedAt: new Date().toISOString(),
      result: body.result,
    };
    await this.state.storage.put("payment", state);

    // Auto-delete after 24 hours for failed states
    if (body.status === "failed") {
      this.state.storage.setAlarm(Date.now() + 24 * 60 * 60 * 1000);
    }

    return Response.json({ status: state.status });
  }

  private async getStatus(): Promise<Response> {
    const existing = await this.state.storage.get<PaymentState>("payment");
    if (!existing) {
      return Response.json({ status: "unknown" });
    }
    return Response.json(existing);
  }

  async alarm(): Promise<void> {
    // Clean up expired lock state
    await this.state.storage.deleteAll();
  }
}
